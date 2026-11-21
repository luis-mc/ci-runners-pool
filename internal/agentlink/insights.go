package agentlink

import (
	"context"
	"time"

	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
	"github.com/luis-mc/ci-runners-shared-pool/internal/insights/capacity"
)

// MinJobSamplesProtocol is the first protocol version with JobResourceSamples (R5.19).
const MinJobSamplesProtocol = agentv1.ProtocolVersion_PROTOCOL_VERSION_4

// JobSampleSink takes the sample batches of agents on the controller. It never answers: a lost batch only
// leaves a gap.
type JobSampleSink interface {
	JobSamples(ctx context.Context, machineID string, m *agentv1.JobResourceSamples)
}

// ResourceSink stores batches through capacity.Resources (CIX13). A batch with no GitHub job id cannot be
// matched to a job and is dropped.
type ResourceSink struct {
	Resources capacity.Resources
	Timeout   time.Duration
}

var _ JobSampleSink = ResourceSink{}

// JobSamples implements JobSampleSink.
func (r ResourceSink) JobSamples(ctx context.Context, machineID string, m *agentv1.JobResourceSamples) {
	id := m.GetJob().GetGithubJobId()
	if r.Resources == nil || id == 0 {
		return
	}
	to := r.Timeout
	if to == 0 {
		to = 10 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, to)
	defer cancel()
	samples := make([]capacity.ResourceSample, 0, len(m.GetSamples()))
	for _, s := range m.GetSamples() {
		samples = append(samples, capacity.ResourceSample{
			At: time.UnixMilli(s.GetAtUnixMs()).UTC(), CPUMillis: s.GetCpuMillis(), MemoryBytes: s.GetMemoryBytes(), Known: s.GetKnown(),
		})
	}
	_ = r.Resources.Add(ctx, id, machineID, m.GetRunnerId(), samples, m.GetFinal(), m.GetUnknownReason())
}
