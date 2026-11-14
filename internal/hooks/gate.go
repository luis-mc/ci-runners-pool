package hooks

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/load"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/slots"
)

// Exit codes of the job-started hook.
const (
	ExitGo      = 0 // the job runs
	ExitTimeout = 1 // on timeout fail: the job fails and can be re-run (R5.20)
)

// GateConfig is everything one run of the job-started hook needs.
type GateConfig struct {
	// Client is the agent link. Nil, or a Client that fails, means the gate
	// waits on local load only (R5.23).
	Client Client
	// Machine settings used when the agent cannot say (the defaults).
	Machine slots.Settings
	Gate    slots.GateSettings
	Job     scheduler.JobRef
	// MachineID is filled from the agent's hello when empty.
	MachineID  string
	EventClass int
	Holder     scheduler.Holder
	// BudgetMemoryPct and BudgetCPUPct are a repository-lowered budget from the
	// runner environment; never above the machine's (R5.4).
	BudgetMemoryPct, BudgetCPUPct int
	GateID                        string
	// Measure reads this machine's load for the request and for the load-only wait.
	Measure func() load.Reading
	// Log writes one line; it goes to the job's Set up job step and the agent log (R5.21).
	Log func(string)
	// Top names the top processes for hold and timeout lines (R5.46); may be nil.
	Top   func() string
	Now   func() time.Time
	Sleep func(ctx context.Context, d time.Duration)
}

func (c *GateConfig) now() time.Time {
	if c.Now != nil {
		return c.Now()
	}
	return time.Now()
}

func (c *GateConfig) sleep(ctx context.Context, d time.Duration) {
	if c.Sleep != nil {
		c.Sleep(ctx, d)
		return
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
	case <-ctx.Done():
	}
}

func (c *GateConfig) logf(format string, a ...any) {
	if c.Log != nil {
		c.Log("load gate: " + fmt.Sprintf(format, a...))
	}
}

// budget is the machine's budget, lowered by the repository's, never raised (R5.4).
func (c *GateConfig) budget() load.Budget {
	lb := slots.Limits(slots.Budget{MemoryPct: c.Machine.BudgetMemoryPct, CPUPct: c.Machine.BudgetCPUPct}, c.BudgetMemoryPct, c.BudgetCPUPct)
	return load.Budget{MemoryPct: lb.MemoryPct, CPUPct: lb.CPUPct}
}

func toLoad(r load.Reading) scheduler.Load {
	return scheduler.Load{MemoryPct: r.MemoryPct, MemoryKnown: r.MemoryKnown, CPUPct: r.CPUPct, CPUKnown: r.CPUKnown, SampledAt: r.At}
}

// timedOut is true when the next poll would pass the maximum wait (R5.20).
func timedOut(elapsed, poll, maxWait time.Duration) bool { return elapsed+poll > maxWait }

// RunGate runs the job-started hook and returns its exit code (R5.12 to R5.23).
func RunGate(ctx context.Context, cfg GateConfig) int {
	start := cfg.now()
	poll := time.Duration(cfg.Gate.PollSec) * time.Second
	maxWait := time.Duration(cfg.Gate.MaxWaitMin) * time.Minute
	if cfg.Measure == nil {
		cfg.Measure = func() load.Reading { return load.Reading{} }
	}
	budget := cfg.budget()

	// Ask the agent who we are. A failure here is the load-only fallback.
	if cfg.Client != nil {
		h, err := cfg.Client.Hello(ctx)
		if err != nil {
			cfg.logf("agent not reachable (%v): waiting on this machine's load only", err)
			cfg.Client = nil
		} else {
			if cfg.MachineID == "" {
				cfg.MachineID = h.MachineID
			}
			cfg.Machine = h.Settings
			budget = cfg.budget()
		}
	}
	if cfg.Client == nil {
		return loadOnlyWait(ctx, &cfg, start, poll, maxWait, budget)
	}

	var firstQueued time.Time
	var lastReasons string
	began := false
	haveTicket := false
	for {
		reading := cfg.Measure()
		var dec scheduler.Decision
		var err error
		if haveTicket {
			dec, err = cfg.Client.Beat(ctx, cfg.MachineID, cfg.GateID, toLoad(reading))
			if errors.Is(err, scheduler.ErrTicketGone) {
				cfg.logf("our ticket was gone; queuing again and keeping our place")
				haveTicket = false
			}
		}
		if !haveTicket {
			dec, err = cfg.Client.Gate(ctx, scheduler.GateRequest{
				GateID: cfg.GateID, MachineID: cfg.MachineID, Job: cfg.Job, EventClass: cfg.EventClass, Holder: cfg.Holder,
				FirstQueued: firstQueued, Load: toLoad(reading), BudgetMemoryPct: cfg.BudgetMemoryPct, BudgetCPUPct: cfg.BudgetCPUPct})
			if err == nil {
				haveTicket = true
				if firstQueued.IsZero() {
					firstQueued = cfg.now()
				}
			}
		}
		if err != nil && !errors.Is(err, scheduler.ErrTicketGone) {
			// The agent or the controller went away: wait on local load only for what is left.
			cfg.logf("%v: waiting on this machine's load only", err)
			return loadOnlyWait(ctx, &cfg, start, poll, maxWait, budget)
		}
		if len(dec.Go) > 0 {
			g := dec.Go[len(dec.Go)-1]
			cfg.logf("slot %s taken after %.0f s", slots.SlotLabel(slots.Kind(g.Kind), g.Number), cfg.now().Sub(start).Seconds())
			return ExitGo
		}
		if dec.Timeout != "" {
			return finishTimeout(ctx, &cfg, dec.Timeout, nil, haveTicket)
		}
		// Hold.
		reasons := dec.WaitText
		if reasons == "" {
			reasons = "waiting"
		}
		if !began {
			cfg.logf("holding: %s (poll %d s, max wait %d min)", reasons, cfg.Gate.PollSec, cfg.Gate.MaxWaitMin)
			began = true
			lastReasons = reasons
		} else if reasons != lastReasons {
			cfg.logf("still holding: %s", reasons)
			lastReasons = reasons
		}
		if timedOut(cfg.now().Sub(start), poll, maxWait) {
			return finishTimeout(ctx, &cfg, cfg.Gate.OnTimeout, []string{lastReasons}, true)
		}
		cfg.sleep(ctx, poll)
		if ctx.Err() != nil {
			_ = cfg.Client.Cancel(context.Background(), cfg.MachineID, cfg.GateID)
			return ExitTimeout
		}
	}
}

// finishTimeout removes the ticket and exits by the on-timeout rule (R5.20).
func finishTimeout(ctx context.Context, cfg *GateConfig, onTimeout string, reasons []string, cancel bool) int {
	if cancel && cfg.Client != nil {
		cctx, stop := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
		defer stop()
		_ = cfg.Client.Cancel(cctx, cfg.MachineID, cfg.GateID)
	}
	line := fmt.Sprintf("timed out after waiting for %s", strings.Join(reasons, "; "))
	if cfg.Top != nil {
		if top := cfg.Top(); top != "" {
			line += " (" + top + ")"
		}
	}
	if onTimeout == slots.OnTimeoutRun {
		cfg.logf("%s; the job runs without a slot", line)
		return ExitGo
	}
	cfg.logf("%s; the job fails and can be re-run", line)
	return ExitTimeout
}

// loadOnlyWait is the fallback when the agent or controller cannot be reached:
// poll the load until under budget, with the same maximum wait and on-timeout
// rule. When the load cannot be measured the job goes and the reason is logged
// (R5.22, R5.23).
func loadOnlyWait(ctx context.Context, cfg *GateConfig, start time.Time, poll, maxWait time.Duration, b load.Budget) int {
	var last string
	began := false
	for {
		r := cfg.Measure()
		if !r.Measurable() {
			cfg.logf("the load cannot be measured: the job runs without a load check")
			return ExitGo
		}
		over, why := load.Over(r, b)
		if !over {
			cfg.logf("under budget (memory %.0f%%, CPU %.0f%%): the job runs without a slot count", r.MemoryPct, r.CPUPct)
			return ExitGo
		}
		reasons := strings.Join(why, ", ")
		if !began {
			cfg.logf("holding on load only: %s (poll %d s, max wait %d min)", reasons, cfg.Gate.PollSec, cfg.Gate.MaxWaitMin)
			began, last = true, reasons
		} else if reasons != last {
			cfg.logf("still holding: %s", reasons)
			last = reasons
		}
		if timedOut(cfg.now().Sub(start), poll, maxWait) {
			return finishTimeout(ctx, cfg, cfg.Gate.OnTimeout, []string{last}, false)
		}
		cfg.sleep(ctx, poll)
		if ctx.Err() != nil {
			return ExitTimeout
		}
	}
}
