package parity

import (
	"fmt"
	"time"
)

// Fault is a thing a FakeSource breaks, to prove the report fails on it.
type Fault string

// The faults a fake can add. FaultNone gives a clean soak.
const (
	FaultNone      Fault = ""
	FaultLostJob   Fault = "lost"
	FaultDuplicate Fault = "duplicate"
	FaultSlow      Fault = "slow"
)

// FakeSource makes up an observation of a plan, with no controller and no
// clock. It is the dry run of the soak and the fixture of the tests.
type FakeSource struct {
	// Epoch is the time the first job is queued.
	Epoch time.Time
	// Wait is the queue wait of every job (a quarter of the plan's bound when
	// zero).
	Wait time.Duration
	// Fault breaks the class named in FaultClass (all of them when empty).
	Fault      Fault
	FaultClass Class
}

// Observe builds the jobs: JobsPerClass for each class, spread over the plan's
// duration, each started after Wait, each taken by one runner.
func (f FakeSource) Observe(plan SoakPlan) (Observation, error) {
	if err := plan.Validate(); err != nil {
		return Observation{}, err
	}
	wait := f.Wait
	if wait == 0 {
		wait = plan.P95WaitBound / 4
	}
	step := plan.Duration / time.Duration(plan.JobsPerClass)
	var obs Observation
	for _, class := range Classes() {
		hit := f.Fault != FaultNone && (f.FaultClass == "" || f.FaultClass == class)
		runner := fmt.Sprintf("fake-%s-1", class)
		obs.Listeners = append(obs.Listeners, Listener{Name: runner, Class: class, Count: 1})
		for i := range plan.JobsPerClass {
			queued := f.Epoch.Add(time.Duration(i) * step)
			j := Job{
				ID:        fmt.Sprintf("%s-%d", class, i+1),
				Class:     class,
				QueuedAt:  queued,
				StartedAt: queued.Add(wait),
				Finished:  true,
				Listeners: []string{runner},
			}
			if hit && i == 0 {
				switch f.Fault {
				case FaultLostJob:
					j.Finished = false
					j.StartedAt = time.Time{}
				case FaultDuplicate:
					j.Listeners = append(j.Listeners, runner+"-copy")
				case FaultSlow:
					// Slow is applied to every job below.
				}
			}
			if hit && f.Fault == FaultSlow {
				j.StartedAt = queued.Add(plan.P95WaitBound * 2)
			}
			obs.Jobs = append(obs.Jobs, j)
		}
	}
	return obs, nil
}
