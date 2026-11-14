package agent

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
	"github.com/luis-mc/ci-runners-shared-pool/internal/update"
)

// Updater is what the agent needs to follow its controller's version
// (operations R5.39): *update.Manager implements it.
type Updater interface {
	Follow(ctx context.Context, version string) (update.Status, error)
	Status(ctx context.Context) update.Status
}

// Report states of UpdateReport (agent.proto).
const (
	followIdle        = "idle"
	followPostponed   = "postponed"
	followFailed      = "failed"
	followUnsupported = "unsupported"
)

// handleUpdate runs one follow request in the background: the receive loop
// must not wait for a drain that may last an hour.
func (l *link) handleUpdate(ctx context.Context, m *agentv1.UpdateAgent) {
	l.followMu.Lock()
	if l.following {
		l.followMu.Unlock()
		return // one at a time; the controller asks again
	}
	l.following = true
	l.followMu.Unlock()
	go func() {
		defer func() { l.followMu.Lock(); l.following = false; l.followMu.Unlock() }()
		l.follow(ctx, m)
	}()
}

func (l *link) follow(ctx context.Context, m *agentv1.UpdateAgent) {
	cfg := l.cfg
	report := func(state, text string, waiting []*agentv1.JobRef) {
		_ = l.send(&agentv1.SessionRequest{Message: &agentv1.SessionRequest_UpdateReport{UpdateReport: &agentv1.UpdateReport{
			CommandId: m.GetCommandId(), Version: m.GetVersion(), State: state, Error: text, WaitingFor: waiting}}})
	}
	if cfg.Updater == nil {
		report(followUnsupported, "this agent has no updater", nil)
		return
	}
	st, err := cfg.Updater.Follow(ctx, m.GetVersion())
	switch {
	case errors.Is(err, update.ErrNoUpdate):
		report(followIdle, "", nil)
		return
	case errors.Is(err, update.ErrUnprivileged):
		report(followUnsupported, "this agent runs as an account that cannot install updates (it was installed before agents ran as root or LocalSystem); run the install command again on this machine", nil)
		return
	case errors.Is(err, update.ErrBusy), errors.Is(err, update.ErrInProgress):
		// An install runs already: report its progress below.
	case err != nil:
		report(followFailed, err.Error(), nil)
		return
	}
	var last string
	t := time.NewTicker(cfg.DrainPollEvery)
	defer t.Stop()
	for {
		state, text := followState(st)
		var waiting []*agentv1.JobRef
		for _, j := range st.RunningJobs {
			waiting = append(waiting, jobToProto(machines.JobRef{Repository: j.Repository, RunID: j.RunID, Job: j.Job}))
		}
		if key := fmt.Sprint(state, "|", text, "|", len(waiting)); key != last {
			last = key
			report(state, text, waiting)
		}
		switch st.State {
		case update.StateIdle, update.StateFailed, update.StateRestarting:
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		st = cfg.Updater.Status(ctx)
	}
}

// followState maps the manager's state to an UpdateReport state and text.
func followState(st update.Status) (string, string) {
	switch st.State {
	case update.StateIdle:
		if st.Error != "" {
			return followPostponed, st.Error
		}
		return followIdle, ""
	case update.StateFailed:
		return followFailed, st.Error
	}
	return string(st.State), ""
}

// UpdateDrainer drains the agent's machine for a follow update: it keeps new
// jobs out with the gate (the same hold as for any drain), waits until the
// gate reports idle, and then calls OnIdle, which runs the install. It never
// stops a job.
type UpdateDrainer struct {
	Gate   *Gate
	Poll   time.Duration
	OnIdle func(ctx context.Context, kind update.Kind) error

	mu     sync.Mutex
	cancel context.CancelFunc
	prior  string
}

var _ update.Drainer = (*UpdateDrainer)(nil)

// RunningJobs implements update.Drainer.
func (d *UpdateDrainer) RunningJobs(context.Context) ([]update.Job, error) {
	var out []update.Job
	for _, j := range d.Gate.Running() {
		out = append(out, update.Job{Repository: j.Repository, RunID: j.RunID, Job: j.Job})
	}
	return out, nil
}

// DrainTimeoutMinutes implements update.Drainer.
func (d *UpdateDrainer) DrainTimeoutMinutes(context.Context) int { return 60 }

// BeginDrain implements update.Drainer.
func (d *UpdateDrainer) BeginDrain(_ context.Context, kind update.Kind, _ string) error {
	poll := d.Poll
	if poll <= 0 {
		poll = 2 * time.Second
	}
	ctx, cancel := context.WithCancel(context.Background())
	d.mu.Lock()
	if d.cancel != nil {
		d.cancel()
	}
	d.cancel, d.prior = cancel, d.Gate.State()
	d.mu.Unlock()
	go func() {
		t := time.NewTicker(poll)
		defer t.Stop()
		for {
			if idle, _ := d.Gate.Hold(); idle {
				// Hold and the idle answer are one step, so no job slipped in since.
				err := d.OnIdle(ctx, kind)
				if err == nil {
					return // the service is about to stop
				}
				if !errors.Is(err, update.ErrNotIdle) {
					_ = d.CancelDrain(context.Background(), "")
					return
				}
			}
			select {
			case <-ctx.Done():
				return
			case <-t.C:
			}
		}
	}()
	return nil
}

// CancelDrain implements update.Drainer: stop waiting and let jobs start again
// (unless the controller had drained the machine before).
func (d *UpdateDrainer) CancelDrain(_ context.Context, _ string) error {
	d.mu.Lock()
	cancel, prior := d.cancel, d.prior
	d.cancel = nil
	d.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	if prior == machines.StateActive || prior == "" {
		d.Gate.Release()
	}
	return nil
}
