package parity

import (
	"fmt"
	"math"
	"sort"
	"time"
)

// Reason names why a class failed.
type Reason string

// The reasons a class can fail the soak.
const (
	ReasonTooFewJobs    Reason = "too_few_jobs"
	ReasonLostJob       Reason = "lost_job"
	ReasonDuplicate     Reason = "duplicate_listener"
	ReasonWaitOverBound Reason = "p95_wait_over_bound"
	ReasonNoWait        Reason = "no_wait_measured"
)

// ClassResult is the verdict of the soak for one class.
type ClassResult struct {
	Class     Class `json:"class"`
	Submitted int   `json:"submitted"`
	Finished  int   `json:"finished"`
	// Lost counts jobs that never finished or that the controller marked lost.
	Lost int `json:"lost"`
	// DuplicateListeners counts runner names answered by more than one
	// listener, plus jobs taken by more than one runner.
	DuplicateListeners int `json:"duplicate_listeners"`
	// P95WaitSeconds is the 95th percentile (nearest rank) of the queue wait
	// of the jobs that started.
	P95WaitSeconds float64  `json:"p95_wait_seconds"`
	Pass           bool     `json:"pass"`
	Reasons        []Reason `json:"reasons,omitempty"`
}

// ClassResults is one result per class, in Classes order.
type ClassResults []ClassResult

// Pass is true when every class passed. An empty list never passes.
func (r ClassResults) Pass() bool {
	if len(r) == 0 {
		return false
	}
	for _, c := range r {
		if !c.Pass {
			return false
		}
	}
	return true
}

// Percentile95 is the nearest-rank 95th percentile of the waits. It is zero
// for no waits.
func Percentile95(waits []time.Duration) time.Duration {
	if len(waits) == 0 {
		return 0
	}
	s := append([]time.Duration(nil), waits...)
	sort.Slice(s, func(i, j int) bool { return s[i] < s[j] })
	rank := int(math.Ceil(0.95 * float64(len(s))))
	if rank < 1 {
		rank = 1
	}
	return s[rank-1]
}

// Judge applies the pass criteria of the plan to an observation. A class
// passes only when all of these hold:
//
//   - at least JobsPerClass jobs of the class were submitted;
//   - no job is lost (a lost job is one that never finished, or that the
//     controller marked lost);
//   - no duplicate listener (a runner name answered by two listeners, or a job
//     taken by two runners);
//   - the p95 queue wait is at most P95WaitBound, measured on at least one
//     started job.
func Judge(plan SoakPlan, obs Observation) ClassResults {
	out := make(ClassResults, 0, len(Classes()))
	for _, class := range Classes() {
		r := ClassResult{Class: class}
		var waits []time.Duration
		for _, j := range obs.Jobs {
			if j.Class != class {
				continue
			}
			r.Submitted++
			if j.Finished && !j.Lost {
				r.Finished++
			} else {
				r.Lost++
			}
			if len(distinct(j.Listeners)) > 1 {
				r.DuplicateListeners++
			}
			if w, ok := j.Wait(); ok {
				waits = append(waits, w)
			}
		}
		for _, l := range obs.Listeners {
			if l.Class == class && l.Count > 1 {
				r.DuplicateListeners++
			}
		}
		p95 := Percentile95(waits)
		r.P95WaitSeconds = p95.Seconds()
		if r.Submitted < plan.JobsPerClass {
			r.Reasons = append(r.Reasons, ReasonTooFewJobs)
		}
		if r.Lost > 0 {
			r.Reasons = append(r.Reasons, ReasonLostJob)
		}
		if r.DuplicateListeners > 0 {
			r.Reasons = append(r.Reasons, ReasonDuplicate)
		}
		switch {
		case len(waits) == 0:
			r.Reasons = append(r.Reasons, ReasonNoWait)
		case p95 > plan.P95WaitBound:
			r.Reasons = append(r.Reasons, ReasonWaitOverBound)
		}
		r.Pass = len(r.Reasons) == 0
		out = append(out, r)
	}
	return out
}

func distinct(names []string) map[string]struct{} {
	m := make(map[string]struct{}, len(names))
	for _, n := range names {
		m[n] = struct{}{}
	}
	return m
}

// Describe is one line a person can read for a class result.
func (r ClassResult) Describe() string {
	state := "pass"
	if !r.Pass {
		state = fmt.Sprintf("FAIL %v", r.Reasons)
	}
	return fmt.Sprintf("%s: %d submitted, %d finished, %d lost, %d duplicate, p95 wait %.0f s, %s",
		r.Class, r.Submitted, r.Finished, r.Lost, r.DuplicateListeners, r.P95WaitSeconds, state)
}
