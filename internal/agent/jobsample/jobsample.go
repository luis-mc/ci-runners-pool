// Package jobsample samples the CPU and memory of each running job on the agent (docs/features/ci-run-insights
// R5.19, R6.4): the job's container cgroup for the container and VM backends, the runner process tree for a
// persistent runner. Samples go to the controller as JobResourceSamples over the agent link (protocol
// version 4), only when the controller's HelloAck says version 4 or more. CIX8 contract: types and
// interfaces only.
package jobsample

import (
	"context"
	"time"
)

// Interval is the sampling period; Batch is how often a batch is sent (R5.19).
const (
	Interval = 5 * time.Second
	Batch    = 15 * time.Second
)

// Source is what a sampler measures.
type Source string

// Sources.
const (
	Cgroup      Source = "cgroup"
	ProcessTree Source = "process_tree"
)

// Sample is one reading of one job. CPUMillis is CPU cores used since the previous sample, times 1000.
type Sample struct {
	At          time.Time
	CPUMillis   int64
	MemoryBytes int64
	Known       bool
}

// Target is one running job the agent knows: its runner and where its processes live.
type Target struct {
	RunnerID   string
	Repository string
	RunID      int64
	RunAttempt int
	Job        string
	JobID      int64
	// CgroupPath is set for a container or VM backend; RootPID for a persistent runner.
	CgroupPath string
	RootPID    int
}

// Sampler reads one target. It returns Known false and a reason when the value cannot be read (R5.19);
// it never fails the job. It uses under 0.5 percent of one CPU core per machine (R6.4).
type Sampler interface {
	Source() Source
	Sample(ctx context.Context, t Target, now time.Time) (Sample, string, error)
}

// Sender sends batches over the agent link.
type Sender interface {
	Send(ctx context.Context, t Target, src Source, samples []Sample, final bool, unknownReason string) error
}
