package jobsample

import (
	"context"
	"testing"
	"time"
)

// BenchmarkSample measures one cgroup sample and one process-tree sample over 500 processes. At one
// sample per 5 s per job, the CPU share is ns/op / 5e9 of one core: R6.4 wants under 0.5 percent
// (25 ms per 5 s), so any run under 25 ms per op, with room for several jobs, holds.
func BenchmarkSample(b *testing.B) {
	files := map[string]string{"/cg/cpu.stat": "usage_usec 123456789\nuser_usec 1\n", "/cg/memory.current": "1073741824\n"}
	cs := NewCgroupSampler(fakeFS(files))
	procs := make([]Proc, 500)
	for i := range procs {
		procs[i] = Proc{PID: i + 2, PPID: i/3 + 1, CPUTicks: int64(i), RSSBytes: 4096}
	}
	ps := NewProcessTreeSampler(&fakeTable{procs: procs})
	ctx := context.Background()
	now := time.Now()
	b.Run("cgroup", func(b *testing.B) {
		b.ReportAllocs()
		tg := Target{RunnerID: "r", CgroupPath: "/cg"}
		for i := 0; i < b.N; i++ {
			_, _, _ = cs.Sample(ctx, tg, now.Add(time.Duration(i)*Interval))
		}
	})
	b.Run("process_tree", func(b *testing.B) {
		b.ReportAllocs()
		tg := Target{RunnerID: "r", RootPID: 2}
		for i := 0; i < b.N; i++ {
			_, _, _ = ps.Sample(ctx, tg, now.Add(time.Duration(i)*Interval))
		}
	})
}
