package agent

import (
	"context"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/agent/jobsample"
	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
)

func TestHelloAckHasJobSamples(t *testing.T) {
	for v, want := range map[agentv1.ProtocolVersion]bool{
		agentv1.ProtocolVersion_PROTOCOL_VERSION_1: false,
		agentv1.ProtocolVersion_PROTOCOL_VERSION_3: false,
		agentv1.ProtocolVersion_PROTOCOL_VERSION_4: true,
	} {
		if got := HelloAckHasJobSamples(&agentv1.HelloAck{ProtocolVersion: v}); got != want {
			t.Errorf("%v: %v", v, got)
		}
	}
}

func TestJobSampleSenderV3SendsNothing(t *testing.T) {
	var s JobSampleSender
	var sent []*agentv1.SessionRequest
	send := func(r *agentv1.SessionRequest) error { sent = append(sent, r); return nil }
	smp := []jobsample.Sample{{At: time.UnixMilli(5000), CPUMillis: 250, MemoryBytes: 10, Known: true}}
	tg := jobsample.Target{RunnerID: "r", Repository: "o/n", RunID: 1, JobID: 9, Job: "build"}

	detach := s.Attach(send, false) // controller on version 3
	if s.Enabled() {
		t.Fatal("enabled on v3")
	}
	_ = s.Send(context.Background(), tg, jobsample.Cgroup, smp, true, "")
	detach()
	if len(sent) != 0 {
		t.Fatalf("v3 sent %d messages", len(sent))
	}

	detach = s.Attach(send, true)
	if !s.Enabled() {
		t.Fatal("not enabled on v4")
	}
	_ = s.Send(context.Background(), tg, jobsample.Cgroup, smp, true, "why")
	m := sent[0].GetJobResourceSamples()
	if m.GetRunnerId() != "r" || m.GetJob().GetGithubJobId() != 9 || m.GetSource() != "cgroup" || !m.GetFinal() ||
		m.GetUnknownReason() != "why" || len(m.GetSamples()) != 1 || m.GetSamples()[0].GetAtUnixMs() != 5000 || m.GetSamples()[0].GetCpuMillis() != 250 {
		t.Fatalf("message %+v", m)
	}
	_ = s.Send(context.Background(), tg, jobsample.Cgroup, nil, false, "") // empty non-final: skipped
	if len(sent) != 1 {
		t.Fatal("empty batch sent")
	}
	detach()
	if s.Enabled() {
		t.Fatal("enabled after detach")
	}
}
