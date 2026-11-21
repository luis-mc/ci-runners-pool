package agentlink

import (
	"context"
	"testing"
	"time"

	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
	"github.com/luis-mc/ci-runners-shared-pool/internal/insights/capacity"
)

type fakeResources struct {
	jobID   int64
	machine string
	runner  string
	samples []capacity.ResourceSample
	final   bool
	reason  string
	calls   int
}

func (f *fakeResources) Add(_ context.Context, jobID int64, machineID, runnerID string, s []capacity.ResourceSample, final bool, reason string) error {
	f.calls++
	f.jobID, f.machine, f.runner, f.samples, f.final, f.reason = jobID, machineID, runnerID, s, final, reason
	return nil
}
func (f *fakeResources) Job(context.Context, int64) ([]capacity.ResourceSample, capacity.ResourceSummary, error) {
	return nil, capacity.ResourceSummary{}, nil
}

func TestResourceSinkStoresBatch(t *testing.T) {
	f := &fakeResources{}
	sink := ResourceSink{Resources: f}
	sink.JobSamples(context.Background(), "m1", &agentv1.JobResourceSamples{
		RunnerId: "r1", Job: &agentv1.JobRef{GithubJobId: 42}, Final: true, UnknownReason: "x",
		Samples: []*agentv1.JobResourceSample{{AtUnixMs: 1000, CpuMillis: 300, MemoryBytes: 7, Known: true}},
	})
	if f.jobID != 42 || f.machine != "m1" || f.runner != "r1" || !f.final || f.reason != "x" || len(f.samples) != 1 ||
		!f.samples[0].At.Equal(time.UnixMilli(1000)) || f.samples[0].CPUMillis != 300 || !f.samples[0].Known {
		t.Fatalf("%+v", f)
	}
}

func TestResourceSinkDropsUnmatched(t *testing.T) {
	f := &fakeResources{}
	ResourceSink{Resources: f}.JobSamples(context.Background(), "m", &agentv1.JobResourceSamples{Job: &agentv1.JobRef{}})
	ResourceSink{}.JobSamples(context.Background(), "m", &agentv1.JobResourceSamples{Job: &agentv1.JobRef{GithubJobId: 1}})
	if f.calls != 0 {
		t.Fatal("stored a batch with no job id")
	}
}
