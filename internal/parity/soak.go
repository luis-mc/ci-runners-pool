// Package parity holds the parity gate of the old runner pool: the soak
// definition, the checks against a pool snapshot and the pass or fail logic of
// the report (parity-plan section 6, release v0.7.0).
//
// The package has no network and no clock of its own. The CLI feeds it
// snapshots and observations; tests and the dry run feed it fakes.
package parity

import (
	"errors"
	"fmt"
	"time"
)

// Class is one class of job the soak runs.
type Class string

// The three classes of the soak. A kind of the parity plan (J1 to J13) belongs
// to exactly one class: containers (J1 to J10, J13), Windows (J12), VM (J11).
const (
	ClassLinuxContainer Class = "linux-container"
	ClassWindows        Class = "windows"
	ClassVM             Class = "vm"
)

// Classes lists the classes in report order.
func Classes() []Class {
	return []Class{ClassLinuxContainer, ClassWindows, ClassVM}
}

// SoakPlan is the soak test definition: how many jobs of each class run over
// how long, and the bound the queue wait must stay under.
type SoakPlan struct {
	// JobsPerClass is N: the jobs of each class the soak submits.
	JobsPerClass int `json:"jobs_per_class"`
	// Duration is the window the N jobs are spread over.
	Duration time.Duration `json:"duration"`
	// P95WaitBound is the most the 95th percentile of the queue wait may be.
	P95WaitBound time.Duration `json:"p95_wait_bound"`
}

// DefaultPlan is the plan of the parity plan's P1 to P6: the 7 day window,
// 200 jobs of each class, and a 5 minute bound on the queue wait of the 95th
// percentile (the target of runners R6.5 is 15 s to start; the bound also
// covers waiting behind a heavy slot).
func DefaultPlan() SoakPlan {
	return SoakPlan{JobsPerClass: 200, Duration: 7 * 24 * time.Hour, P95WaitBound: 5 * time.Minute}
}

// Validate says what is wrong with a plan, or returns nil.
func (p SoakPlan) Validate() error {
	var errs []error
	if p.JobsPerClass < 1 {
		errs = append(errs, errors.New("jobs per class must be at least 1"))
	}
	if p.Duration <= 0 {
		errs = append(errs, errors.New("duration must be positive"))
	}
	if p.P95WaitBound <= 0 {
		errs = append(errs, errors.New("the p95 queue wait bound must be positive"))
	}
	return errors.Join(errs...)
}

// Job is one job the soak watched, as the report needs it.
type Job struct {
	ID    string `json:"id"`
	Class Class  `json:"class"`
	// QueuedAt and StartedAt give the queue wait. A zero StartedAt means the
	// job never started.
	QueuedAt  time.Time `json:"queued_at"`
	StartedAt time.Time `json:"started_at"`
	// Finished is true when the job ended with a result the controller
	// recorded. A job that was submitted and never finished is lost, and so is
	// one the controller itself marked lost.
	Finished bool `json:"finished"`
	Lost     bool `json:"lost"`
	// Listeners names every runner that took the job. More than one is a
	// duplicate.
	Listeners []string `json:"listeners"`
}

// Wait is the queue wait of a started job.
func (j Job) Wait() (time.Duration, bool) {
	if j.StartedAt.IsZero() || j.QueuedAt.IsZero() || j.StartedAt.Before(j.QueuedAt) {
		return 0, false
	}
	return j.StartedAt.Sub(j.QueuedAt), true
}

// Listener is one runner listener seen online, with how many times.
type Listener struct {
	Name  string `json:"name"`
	Class Class  `json:"class"`
	// Count is how many listener processes answered to the name.
	Count int `json:"count"`
}

// Observation is everything the soak saw.
type Observation struct {
	Jobs      []Job      `json:"jobs"`
	Listeners []Listener `json:"listeners"`
}

// Source gives the observation of a plan. The live source reads the
// controller; FakeSource makes one up.
type Source interface {
	Observe(plan SoakPlan) (Observation, error)
}

// ErrNoSource is returned when a soak has no source of observations.
var ErrNoSource = errors.New("no observation source")

// Run asks the source for the observation of the plan and judges it.
func Run(plan SoakPlan, src Source) (ClassResults, error) {
	if err := plan.Validate(); err != nil {
		return nil, fmt.Errorf("soak plan: %w", err)
	}
	if src == nil {
		return nil, ErrNoSource
	}
	obs, err := src.Observe(plan)
	if err != nil {
		return nil, fmt.Errorf("soak observation: %w", err)
	}
	return Judge(plan, obs), nil
}
