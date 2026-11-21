package capacity

import (
	"sort"
	"time"
)

// Summarise is the summary of one job's samples (R5.20), written when the job ends. Only samples with
// Known true count. With none known the percentiles are 0 and UnknownReason says why (the agent's reason,
// or "no samples" when the job sent none).
func Summarise(jobID int64, jobIdent, machineID string, samples []ResourceSample, unknownReason string, completedAt time.Time) ResourceSummary {
	s := ResourceSummary{JobID: jobID, JobIdent: jobIdent, MachineID: machineID, CompletedAt: completedAt}
	var cpu, mem []int64
	for _, x := range samples {
		if !x.Known {
			continue
		}
		cpu = append(cpu, x.CPUMillis)
		mem = append(mem, x.MemoryBytes)
	}
	s.Samples = len(cpu)
	if len(cpu) == 0 {
		s.UnknownReason = unknownReason
		if s.UnknownReason == "" {
			s.UnknownReason = "no samples"
		}
		return s
	}
	s.CPUP50Millis, s.CPUP95Millis, s.CPUPeakMillis = pct(cpu, 50), pct(cpu, 95), pct(cpu, 100)
	s.MemP50, s.MemP95, s.MemPeak = pct(mem, 50), pct(mem, 95), pct(mem, 100)
	return s
}

// pct is the nearest-rank percentile of integers; p in 1..100.
func pct(v []int64, p int) int64 {
	s := append([]int64(nil), v...)
	sort.Slice(s, func(a, b int) bool { return s[a] < s[b] })
	i := (p*len(s)+99)/100 - 1
	if i < 0 {
		i = 0
	}
	return s[i]
}
