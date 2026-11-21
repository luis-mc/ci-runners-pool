package agent

import (
	"context"
	"sync/atomic"

	"github.com/luis-mc/ci-runners-shared-pool/internal/agent/jobsample"
	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
)

// HelloAckHasJobSamples says whether the controller's HelloAck allows JobResourceSamples (protocol
// version 4, R5.19). An agent on a controller that answers version 3 or less sends nothing new.
func HelloAckHasJobSamples(ack *agentv1.HelloAck) bool {
	return ack.GetProtocolVersion() >= agentv1.ProtocolVersion_PROTOCOL_VERSION_4
}

// JobSampleSender sends sample batches over the session. It implements jobsample.Sender. It sends only
// after Attach said the controller is on version 4; before that, and after Detach, Send does nothing.
type JobSampleSender struct {
	cur atomic.Pointer[jobSampleSession]
}

type jobSampleSession struct {
	send func(*agentv1.SessionRequest) error
}

var _ jobsample.Sender = (*JobSampleSender)(nil)

// Attach opens the sender on a session; supported is HelloAckHasJobSamples of its ack. It returns the
// function that closes it.
func (s *JobSampleSender) Attach(send func(*agentv1.SessionRequest) error, supported bool) (detach func()) {
	if !supported {
		s.cur.Store(nil)
		return func() {}
	}
	ses := &jobSampleSession{send: send}
	s.cur.Store(ses)
	return func() { s.cur.CompareAndSwap(ses, nil) }
}

// Enabled reports whether a version 4 session is open; it is the Collector's Enabled func.
func (s *JobSampleSender) Enabled() bool { return s.cur.Load() != nil }

// Send implements jobsample.Sender.
func (s *JobSampleSender) Send(_ context.Context, t jobsample.Target, src jobsample.Source, samples []jobsample.Sample, final bool, unknownReason string) error {
	ses := s.cur.Load()
	if ses == nil || (len(samples) == 0 && !final) {
		return nil
	}
	m := &agentv1.JobResourceSamples{
		RunnerId: t.RunnerID,
		Job: &agentv1.JobRef{
			Repository: t.Repository, RunId: t.RunID, RunAttempt: int32(t.RunAttempt), //nolint:gosec // small count
			Job: t.Job, GithubJobId: t.JobID, RunnerName: t.RunnerID,
		},
		Source: string(src), Final: final, UnknownReason: unknownReason,
		Samples: make([]*agentv1.JobResourceSample, 0, len(samples)),
	}
	for _, sm := range samples {
		m.Samples = append(m.Samples, &agentv1.JobResourceSample{
			AtUnixMs: sm.At.UnixMilli(), CpuMillis: sm.CPUMillis, MemoryBytes: sm.MemoryBytes, Known: sm.Known,
		})
	}
	return ses.send(&agentv1.SessionRequest{Message: &agentv1.SessionRequest_JobResourceSamples{JobResourceSamples: m}})
}
