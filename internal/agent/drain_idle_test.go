package agent_test

import (
	"sync"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
)

// R5.32: the idle check and the hold are one step. After Hold has said "idle",
// no job can start; before it, a job that started is named.
func TestHoldIsTheIdleCheckAndKeepsNewJobsOut(t *testing.T) {
	g, _, _ := gateWith(t, "700000", nil)
	if d := g.Start("a", job, "persistent"); !d.Go {
		t.Fatal(d.Reasons)
	}
	idle, waiting := g.Hold()
	if idle || len(waiting) != 1 || waiting[0].Repository != "o/r" {
		t.Fatalf("hold with a running job: idle=%v waiting=%v", idle, waiting)
	}
	if d := g.Start("b", job, "persistent"); d.Go || d.Reasons[0] != "machine_draining" {
		t.Fatalf("a job started during the drain: %+v", d)
	}
	g.Finish("a")
	idle, waiting = g.Hold() // a fresh check, never a cached one
	if !idle || len(waiting) != 0 {
		t.Fatalf("idle = %v waiting = %v", idle, waiting)
	}
	if d := g.Start("c", job, "persistent"); d.Go {
		t.Fatal("a job started after the idle check")
	}
	// Resume lets jobs start again (R5.34).
	g.Release()
	if d := g.Start("c", job, "persistent"); !d.Go {
		t.Fatalf("after resume: %v", d.Reasons)
	}
}

// Racing starts against Hold: once Hold reported idle, nothing may be running,
// whatever the interleaving.
func TestHoldAndStartNeverRace(t *testing.T) {
	for i := 0; i < 200; i++ {
		g, _, _ := gateWith(t, "700000", func(s *machines.Settings) { s.JobSlots = 64 })
		var wg sync.WaitGroup
		wg.Add(2)
		var idle bool
		go func() { defer wg.Done(); idle, _ = g.Hold() }()
		go func() { defer wg.Done(); g.Start("x", job, "persistent") }()
		wg.Wait()
		if idle && g.SlotsUsed() != 0 {
			t.Fatalf("round %d: Hold said idle but a job started", i)
		}
	}
}
