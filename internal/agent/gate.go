package agent

import (
	"sync"

	"github.com/luis-mc/ci-runners-shared-pool/internal/load"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
)

// Gate is the machine's own job-started gate (machines R5.23, runner-pool
// R5.2, DL-79). A new job starts only when all hold: the state is active, a
// slot is free, the measured load is under the budget in force, the job's
// backend is allowed. It reads the newest load sample and never waits for one
// (R6.6). It only holds jobs; it never stops one (R5.21).
//
// The same lock keeps new jobs out and counts the running ones, so the idle
// check of a drain and the hold are one step (R5.32): once Hold has returned
// idle, no job can have started in between.
type Gate struct {
	mu       sync.Mutex
	settings machines.Settings
	have     bool
	state    string // active, draining or drained
	running  map[string]machines.JobRef
	sampler  *load.Sampler
}

// NewGate returns a gate over a load sampler. Until settings arrive it holds
// every job: an agent that knows no settings must not start work.
func NewGate(s *load.Sampler) *Gate {
	return &Gate{state: machines.StateActive, running: map[string]machines.JobRef{}, sampler: s}
}

// SetSettings applies settings (R5.24, R5.25): running jobs keep going even
// when the new budget is already exceeded.
func (g *Gate) SetSettings(s machines.Settings, state string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.settings, g.have = s, true
	// The controller owns the machine state; the agent follows it.
	switch state {
	case machines.StateActive, machines.StateDraining, machines.StateDrained:
		g.state = state
	}
}

// Settings returns the settings in force.
func (g *Gate) Settings() (machines.Settings, bool) {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.settings, g.have
}

// Decision is the gate's answer.
type Decision struct {
	Go      bool
	Reasons []string
}

// Start asks to start a job on a backend. When it answers Go the job counts as
// running until Finish.
func (g *Gate) Start(key string, job machines.JobRef, backend string) Decision {
	g.mu.Lock()
	defer g.mu.Unlock()
	if !g.have {
		return Decision{Reasons: []string{"settings not received yet"}}
	}
	var why []string
	if g.state != machines.StateActive {
		why = append(why, "machine_"+g.state)
	}
	if len(g.running) >= g.settings.JobSlots {
		why = append(why, "free_slot")
	}
	allowed := false
	for _, b := range g.settings.AllowedBackends {
		if b == backend {
			allowed = true
		}
	}
	if !allowed {
		why = append(why, "backend_not_allowed")
	}
	rep, ok := g.sampler.Latest()
	if good, reasons := load.Decide(rep, ok, g.settings.BudgetMemoryPct, g.settings.BudgetCPUPct); !good {
		why = append(why, reasons...)
	}
	if len(why) > 0 {
		return Decision{Reasons: why}
	}
	g.running[key] = job
	return Decision{Go: true}
}

// Finish records that a job ended.
func (g *Gate) Finish(key string) {
	g.mu.Lock()
	delete(g.running, key)
	g.mu.Unlock()
}

// Running lists the running jobs.
func (g *Gate) Running() []machines.JobRef {
	g.mu.Lock()
	defer g.mu.Unlock()
	out := make([]machines.JobRef, 0, len(g.running))
	for _, j := range g.running {
		out = append(out, j)
	}
	return out
}

// SlotsUsed is how many jobs run.
func (g *Gate) SlotsUsed() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return len(g.running)
}

// Hold keeps new jobs out and, in the same step, reports whether the machine
// is idle and which jobs it still waits for (R5.30, R5.32). Call it again and
// again until idle is true; each call is a fresh check.
func (g *Gate) Hold() (idle bool, waitingFor []machines.JobRef) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.state == machines.StateActive {
		g.state = machines.StateDraining
	}
	for _, j := range g.running {
		waitingFor = append(waitingFor, j)
	}
	return len(g.running) == 0, waitingFor
}

// Release lets new jobs start again (resume, R5.34).
func (g *Gate) Release() {
	g.mu.Lock()
	g.state = machines.StateActive
	g.mu.Unlock()
}

// State is active, draining or drained.
func (g *Gate) State() string {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.state
}

// MarkDrained records that the drain finished: the machine stays held.
func (g *Gate) MarkDrained() {
	g.mu.Lock()
	g.state = machines.StateDrained
	g.mu.Unlock()
}
