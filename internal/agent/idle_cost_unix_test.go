//go:build unix

package agent_test

import (
	"runtime"
	"syscall"
	"testing"
	"time"
)

func cpuTime(t *testing.T) time.Duration {
	t.Helper()
	var ru syscall.Rusage
	if err := syscall.Getrusage(syscall.RUSAGE_SELF, &ru); err != nil {
		t.Skip("no getrusage")
	}
	return time.Duration(ru.Utime.Nano() + ru.Stime.Nano())
}

// R6.5: an idle agent stays under 1% of one core and 50 MB. The window is short
// (the 10-minute mean is a manual soak) and runs at the real intervals, so the
// check is on the cost per second of one connected, idle agent.
func TestIdleAgentCostIsSmall(t *testing.T) {
	if testing.Short() {
		t.Skip("short")
	}
	c := startController(t)
	code, _ := c.Svc.CreateJoinCode(t.Context(), "owner", 0)
	cfg := fastConfig(t, c, code.Code)
	// Production intervals: heartbeat 10 s, load 15 s, sample 5 s.
	cfg.HeartbeatEvery, cfg.LoadEvery, cfg.SampleEvery, cfg.DrainPollEvery = 0, 0, 0, 0
	runAgent(t, cfg)
	waitFor(t, "agent online", func() bool {
		ms, _ := c.Svc.List(t.Context())
		return len(ms) == 1 && ms[0].Machine.Online
	})
	var before, after runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&before)
	cpu0, wall0 := cpuTime(t), time.Now()
	time.Sleep(3 * time.Second)
	cpu := cpuTime(t) - cpu0
	wall := time.Since(wall0)
	runtime.GC()
	runtime.ReadMemStats(&after)
	if pct := float64(cpu) / float64(wall) * 100; pct >= 1 {
		t.Errorf("idle cpu %.2f%% of one core, want under 1%% (agent and controller share this process)", pct)
	}
	if after.HeapAlloc > 50<<20 {
		t.Errorf("idle heap %d MB, want under 50 MB", after.HeapAlloc>>20)
	}
}
