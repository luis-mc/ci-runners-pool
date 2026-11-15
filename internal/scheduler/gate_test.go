package scheduler_test

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/slots"
)

// R5.12. Ported from test_machine.py Gate test_free_slot_and_quiet_machine_goes_at_once.
func TestFreeSlotQuietMachineGoesAtOnce(t *testing.T) {
	e := newEnv(t)
	g := goes(t, e.gate(e.req("g1", job("o/r", 1, "build"), 1, quiet)))
	if g.Kind != scheduler.SlotCI || g.Number != 1 || g.Claim == "" {
		t.Fatalf("grant %+v", g)
	}
	if s := e.status(m1); len(s.Slots) != 1 || len(s.Tickets) != 0 {
		t.Fatalf("status %+v", s)
	}
}

// R5.13. Ported from test_machine.py Gate test_a_ticket_ahead_holds_this_job_even_with_a_free_slot and
// test_waits_for_load_then_goes_and_keeps_the_wait_marker_while_waiting.
func TestTicketAheadHoldsEvenWithFreeSlot(t *testing.T) {
	e := newEnv(t)
	// the first job waits on load, so its ticket stays; a second job must wait behind it
	hot := scheduler.Load{MemoryPct: 95, MemoryKnown: true}
	d := e.gate(e.req("a", job("o/r", 1, "build"), 1, hot))
	waits(t, d, scheduler.WaitLoadOverBudget)
	if d.WaitText != "memory 95% > 85%" {
		t.Fatalf("text %q", d.WaitText)
	}
	e.advance(time.Millisecond)
	d = e.gate(e.req("b", job("o/r", 2, "build"), 1, quiet))
	waits(t, d, scheduler.WaitFreeSlot)
	if d.WaitText != "1 ahead in the queue" || d.Place != 2 {
		t.Fatalf("got %q place %d", d.WaitText, d.Place)
	}
	// load drops: a goes, b still waits for load-free check of its own turn, then goes with the second slot
	goes(t, e.gate(e.req("a", job("o/r", 1, "build"), 1, quiet)))
	goes(t, e.gate(e.req("b", job("o/r", 2, "build"), 1, quiet)))
}

// R5.45: the strictly-above rule and both figures named.
func TestOverNamesTheNumbers(t *testing.T) {
	e := newEnv(t)
	d := e.gate(e.req("a", job("o/r", 1, "x"), 1, scheduler.Load{MemoryPct: 91, MemoryKnown: true, CPUPct: 70, CPUKnown: true}))
	if d.WaitText != "memory 91% > 85%, CPU 70% > 60%" {
		t.Fatalf("text %q", d.WaitText)
	}
	// at the budget is not over
	if err := e.eng.Cancel(context.Background(), m1, "a"); err != nil {
		t.Fatal(err)
	}
	goes(t, e.gate(e.req("b", job("o/r", 2, "x"), 1, scheduler.Load{MemoryPct: 85, MemoryKnown: true, CPUPct: 60, CPUKnown: true})))
}

// R5.14. Ported from test_machine.py Slots test_take_until_full_free_and_take_again.
func TestTakeUntilFullFreeAndTakeAgain(t *testing.T) {
	e := newEnv(t)
	gs := e.fill(2)
	if gs[0].Number != 1 || gs[1].Number != 2 {
		t.Fatalf("numbers %v", gs)
	}
	d := e.gate(e.req("third", job("o/r", 3, "build"), 1, quiet))
	waits(t, d, scheduler.WaitFreeSlot)
	if d.WaitText != "no free slot (all 2 busy)" {
		t.Fatalf("text %q", d.WaitText)
	}
	if _, err := e.eng.Release(context.Background(), m1, job("o/r", 900, "build"), nil); err != nil {
		t.Fatal(err)
	}
	g := goes(t, e.gate(e.req("third", job("o/r", 3, "build"), 1, quiet)))
	if g.Number != 1 {
		t.Fatalf("took slot %d, want the freed 1", g.Number)
	}
}

// R5.15. Ported from test_machine.py Slots test_free_with_a_wrong_token_keeps_the_lock.
func TestFreeWithWrongClaimKeepsTheSlot(t *testing.T) {
	e := newEnv(t)
	goes(t, e.gate(e.req("g", job("o/r", 1, "build"), 1, quiet)))
	freed, err := e.eng.Release(context.Background(), m1, job("o/r", 1, "build"), []string{"not-the-claim"})
	if err != nil || len(freed) != 0 {
		t.Fatalf("freed %v err %v", freed, err)
	}
	if len(e.status(m1).Slots) != 1 {
		t.Fatal("slot was freed with a wrong claim")
	}
}

// R5.16. Ported from test_machine.py Gate test_a_stale_slot_is_freed_while_waiting.
func TestStaleSlotFreedWhileWaiting(t *testing.T) {
	e := newEnv(t)
	e.fill(2)
	e.advance(121 * time.Minute)
	g := goes(t, e.gate(e.req("late", job("o/r", 5, "build"), 1, quiet)))
	if g.Number != 1 {
		t.Fatalf("slot %d", g.Number)
	}
}

// R5.17: a freed slot wakes a waiting gate at once.
func TestFreedSlotWakesWaitingGate(t *testing.T) {
	e := newEnv(t)
	e.fill(2)
	ch, cancel := e.eng.Wake(m1)
	defer cancel()
	if _, err := e.eng.Release(context.Background(), m1, job("o/r", 900, "build"), nil); err != nil {
		t.Fatal(err)
	}
	select {
	case <-ch:
	case <-time.After(time.Second):
		t.Fatal("no wake")
	}
}

// R5.18. Ported from test_dl292_ticket_heartbeat.py test_beat_keeps_the_file_name,
// test_beat_does_not_recreate_a_missing_ticket.
func TestBeatKeepsPlaceNeverRecreates(t *testing.T) {
	e := newEnv(t)
	e.fill(2)
	waits(t, e.gate(e.req("a", job("o/r", 1, "x"), 1, quiet)), scheduler.WaitFreeSlot)
	waits(t, e.gate(e.req("b", job("o/r", 2, "x"), 1, quiet)), scheduler.WaitFreeSlot)
	before := e.status(m1).Tickets
	e.advance(20 * time.Second)
	d, err := e.eng.Beat(context.Background(), m1, "a", quiet)
	if err != nil || d.Place != 1 {
		t.Fatalf("beat %+v %v", d, err)
	}
	after := e.status(m1).Tickets
	if after[0].GateID != before[0].GateID || !after[0].BeatAt.After(before[0].BeatAt) || !after[0].QueuedAt.Equal(before[0].QueuedAt) {
		t.Fatalf("before %+v after %+v", before[0], after[0])
	}
	if _, err := e.eng.Beat(context.Background(), m1, "never-existed", quiet); err != scheduler.ErrTicketGone {
		t.Fatalf("want ErrTicketGone, got %v", err)
	}
	if len(e.status(m1).Tickets) != 2 {
		t.Fatal("a beat made a ticket")
	}
}

// R5.19. Ported from test_dl200_gate_vanished_ticket.py
// test_dropped_ticket_is_queued_again_and_the_job_gets_a_slot.
func TestDroppedTicketQueuedAgainKeepsPlace(t *testing.T) {
	e := newEnv(t)
	e.fill(2)
	first := e.req("a", job("o/r", 1, "x"), 1, quiet)
	waits(t, e.gate(first), scheduler.WaitFreeSlot)
	e.advance(time.Second)
	waits(t, e.gate(e.req("b", job("o/r", 2, "x"), 1, quiet)), scheduler.WaitFreeSlot)
	queuedA := e.status(m1).Tickets[0].QueuedAt
	if err := e.eng.Cancel(context.Background(), m1, "a"); err != nil {
		t.Fatal(err)
	}
	// the gate finds its ticket gone and writes it again with its first queued time
	first.FirstQueued = queuedA
	waits(t, e.gate(first), scheduler.WaitFreeSlot)
	st := e.status(m1).Tickets
	if st[0].GateID != "a" || !st[0].QueuedAt.Equal(queuedA) {
		t.Fatalf("a lost its place: %+v", st)
	}
	// an older ticket than the slot maximum age queues as new
	if err := e.eng.Cancel(context.Background(), m1, "a"); err != nil {
		t.Fatal(err)
	}
	first.FirstQueued = e.now.Add(-3 * time.Hour)
	e.gate(first)
	for _, tk := range e.status(m1).Tickets {
		if tk.GateID == "a" && e.now.Sub(tk.QueuedAt) > 50*time.Millisecond {
			t.Fatalf("old ticket kept place: %v", tk.QueuedAt)
		}
	}
}

// R5.22 (decision D53): this differs from the old pool on purpose. A load that
// cannot be measured holds the job; it never counts as under budget.
func TestUnmeasurableLoadHolds(t *testing.T) {
	e := newEnv(t)
	d := e.gate(e.req("a", job("o/r", 1, "x"), 1, scheduler.Load{}))
	waits(t, d, scheduler.WaitLoadNotMeasured)
	if d.WaitText != scheduler.LoadNotMeasuredText {
		t.Fatalf("wait text %q", d.WaitText)
	}
	// the job keeps its place and takes no slot
	if len(e.status(m1).Tickets) != 1 || len(e.status(m1).Slots) != 0 {
		t.Fatalf("status %+v", e.status(m1))
	}
	// the same job goes once the load is measured
	goes(t, e.gate(e.req("a", job("o/r", 1, "x"), 1, quiet)))
	// a light job is held too
	l := e.gate(e.req("l", job("o/r", 2, "smoke"), 1, scheduler.Load{}))
	waits(t, l, scheduler.WaitLoadNotMeasured)
	// memory known, CPU unknown: memory decides
	waits(t, e.gate(e.req("b", job("o/r", 3, "x"), 1, scheduler.Load{MemoryPct: 99, MemoryKnown: true})), scheduler.WaitLoadOverBudget)
}

// R5.48: every reason has its words, and the figures of the gate's line stay.
func TestWaitWordsForEveryReason(t *testing.T) {
	cases := []struct {
		r    scheduler.WaitReason
		text string
		want string
	}{
		{scheduler.WaitLoadNotMeasured, "load not measured yet", "Load not measured yet."},
		{scheduler.WaitLoadOverBudget, "memory 91% > 85%", "Over the load budget: memory 91% > 85%."},
		{scheduler.WaitLoadOverBudget, "", "Over the memory or CPU budget."},
		{scheduler.WaitFreeSlot, "2 ahead in the queue", "No free slot: 2 ahead in the queue."},
		{scheduler.WaitLostRace, "", "No free slot."},
		{scheduler.WaitNoRunnerLabels, "", "No machine has this OS and these labels."},
		{scheduler.WaitMachineDrained, "", "The machine is drained."},
		{scheduler.WaitUnknown, "", "Waiting. The reason is not known yet."},
	}
	for _, c := range cases {
		if got := scheduler.WaitWords(c.r, c.text); !strings.HasPrefix(got, c.want) {
			t.Errorf("%s %q: got %q, want prefix %q", c.r, c.text, got, c.want)
		}
	}
}

// R5.4: a repository budget lowers, never raises.
func TestRepositoryBudgetLowersNeverRaises(t *testing.T) {
	e := newEnv(t)
	r := e.req("a", job("o/r", 1, "x"), 1, scheduler.Load{MemoryPct: 70, MemoryKnown: true})
	r.BudgetMemoryPct = 60
	waits(t, e.gate(r), scheduler.WaitLoadOverBudget)
	if err := e.eng.Cancel(context.Background(), m1, "a"); err != nil {
		t.Fatal(err)
	}
	r = e.req("b", job("o/r", 2, "x"), 1, scheduler.Load{MemoryPct: 90, MemoryKnown: true})
	r.BudgetMemoryPct = 99 // above the machine's 85: ignored
	waits(t, e.gate(r), scheduler.WaitLoadOverBudget)
}

// R5.24. Ported from test_dl267_light_slot.py test_light_job_takes_light_1_while_both_ci_slots_are_held,
// test_second_light_job_takes_a_free_ci_slot, test_second_light_job_waits_when_no_slot_is_free.
func TestLightSlots(t *testing.T) {
	e := newEnv(t)
	e.fill(2)
	g := goes(t, e.gate(e.req("l1", job("o/r", 10, "smoke"), 1, quiet)))
	if g.Kind != scheduler.SlotLight || g.Number != 1 {
		t.Fatalf("grant %+v", g)
	}
	if len(e.status(m1).Tickets) != 0 {
		t.Fatal("a light job took a ticket")
	}
	// the light slot is busy and both job slots held: the second light job queues
	waits(t, e.gate(e.req("l2", job("o/r", 11, "smoke"), 1, quiet)), scheduler.WaitFreeSlot)
	if len(e.status(m1).Tickets) != 1 {
		t.Fatal("second light job did not queue")
	}
	// free a job slot: the second light job takes it
	if _, err := e.eng.Release(context.Background(), m1, job("o/r", 900, "build"), nil); err != nil {
		t.Fatal(err)
	}
	g = goes(t, e.gate(e.req("l2", job("o/r", 11, "smoke"), 1, quiet)))
	if g.Kind != scheduler.SlotCI {
		t.Fatalf("grant %+v", g)
	}
	// job-completed frees light-1
	freed, err := e.eng.Release(context.Background(), m1, job("o/r", 10, "smoke"), nil)
	if err != nil || len(freed) != 1 || freed[0].Kind != scheduler.SlotLight {
		t.Fatalf("freed %+v %v", freed, err)
	}
}

// R5.65: a job on a light runner takes a light slot whatever its job key is,
// and when the light slot is busy it waits for it, never for a job slot.
func TestLightRunnerTakesLightSlotOnly(t *testing.T) {
	e := newEnv(t)
	lj := func(run int64, name string) scheduler.JobRef {
		j := job("o/r", run, name)
		j.RunnerName = "crsp-light-r-linux"
		return j
	}
	g := goes(t, e.gate(e.req("a", lj(1, "build"), 1, quiet)))
	if g.Kind != scheduler.SlotLight || g.Number != 1 {
		t.Fatalf("grant %+v", g)
	}
	// the light slot is busy, both job slots are free: still no job slot
	waits(t, e.gate(e.req("b", lj(2, "build"), 1, quiet)), scheduler.WaitFreeSlot)
	if len(e.status(m1).Tickets) != 0 {
		t.Fatal("a light runner job took a ticket")
	}
	if _, err := e.eng.Release(context.Background(), m1, lj(1, "build"), nil); err != nil {
		t.Fatal(err)
	}
	if g = goes(t, e.gate(e.req("b", lj(2, "build"), 1, quiet))); g.Kind != scheduler.SlotLight {
		t.Fatalf("grant %+v", g)
	}
}

// R5.24: light slots at 0 mean no light handling.
func TestLightOffMeansNormalQueue(t *testing.T) {
	e := newEnv(t)
	e.settings(m1, func(s *slots.Settings) { s.LightSlots = 0 })
	g := goes(t, e.gate(e.req("l1", job("o/r", 10, "smoke"), 1, quiet)))
	if g.Kind != scheduler.SlotCI {
		t.Fatalf("grant %+v", g)
	}
}

// R5.26. Ported from test_dl327_heavy_slots.py test_heavy_takes_both_slots_and_release_frees_both,
// test_second_heavy_waits_and_holds_no_ci_slot, test_normal_job_flows_while_heavy_waits.
func TestHeavySlots(t *testing.T) {
	e := newEnv(t)
	// three job slots: an e2e job weighs 2 of them (R5.69), so a normal job still fits beside it
	e.settings(m1, func(s *slots.Settings) { s.JobSlots = 3; s.HeavyJobs = []string{"e2e", "o/other:*"} })
	d := e.gate(e.req("h1", job("o/r", 1, "e2e"), 1, quiet))
	if len(d.Go) != 2 || d.Go[0].Kind != scheduler.SlotHeavy || d.Go[1].Kind != scheduler.SlotCI {
		t.Fatalf("decision %+v", d)
	}
	// the second heavy job waits for a heavy slot and holds no job slot and no ticket
	waits(t, e.gate(e.req("h2", job("o/r", 2, "e2e"), 1, quiet)), scheduler.WaitFreeSlot)
	st := e.status(m1)
	if len(st.Tickets) != 0 || len(st.Slots) != 2 {
		t.Fatalf("status %+v", st)
	}
	// a normal job flows while a heavy job waits
	goes(t, e.gate(e.req("n", job("o/r", 3, "build"), 1, quiet)))
	// release frees both slots of the heavy job
	freed, _ := e.eng.Release(context.Background(), m1, job("o/r", 1, "e2e"), nil)
	if len(freed) != 2 {
		t.Fatalf("freed %+v", freed)
	}
}

// R5.26: a heavy job that gets no job slot frees its heavy slot (no-ci-slot).
func TestHeavyFreedWhenNoCISlot(t *testing.T) {
	e := newEnv(t)
	e.settings(m1, func(s *slots.Settings) { s.HeavyJobs = []string{"e2e"} })
	e.fill(2)
	d := e.gate(e.req("h1", job("o/r", 1, "e2e"), 1, quiet))
	waits(t, d, scheduler.WaitFreeSlot)
	if len(e.status(m1).Slots) != 3 {
		t.Fatalf("slots %+v", e.status(m1).Slots)
	}
	if err := e.eng.Cancel(context.Background(), m1, "h1"); err != nil {
		t.Fatal(err)
	}
	st := e.status(m1)
	if len(st.Slots) != 2 || len(st.Tickets) != 0 {
		t.Fatalf("status %+v", st)
	}
}

// R5.9 and R5.10 through the gate: repository at its parallel limit is passed over.
func TestParallelLimitPassesOverInTheGate(t *testing.T) {
	e := newEnv(t)
	e.settings(m1, func(s *slots.Settings) { s.JobSlots = 3 })
	if err := e.st.SetRepoPolicyForTests(context.Background(), 1, "o/a", slots.Policy{MaxParallel: 1}); err != nil {
		t.Fatal(err)
	}
	goes(t, e.gate(e.req("a1", job("o/a", 1, "x"), 1, quiet)))
	d := e.gate(e.req("a2", job("o/a", 2, "x"), 1, quiet))
	waits(t, d, scheduler.WaitRepoParallelLimit)
	// another repository behind it takes the free slot; a2 keeps its place
	goes(t, e.gate(e.req("b1", job("o/b", 1, "x"), 1, quiet)))
	st := e.status(m1)
	if len(st.Tickets) != 1 || st.Tickets[0].GateID != "a2" || st.Tickets[0].Place != 1 {
		t.Fatalf("tickets %+v", st.Tickets)
	}
}

// R5.8: repository priority first, then event class, then fair share.
func TestPriorityAndFairShareThroughTheGate(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	if err := e.st.SetRepoPolicyForTests(ctx, 1, "o/low", slots.Policy{Priority: 0, MaxParallel: 5}); err != nil {
		t.Fatal(err)
	}
	if err := e.st.SetRepoPolicyForTests(ctx, 2, "o/high", slots.Policy{Priority: 10, MaxParallel: 5}); err != nil {
		t.Fatal(err)
	}
	e.fill(2)
	waits(t, e.gate(e.req("low", job("o/low", 1, "x"), 0, quiet)), scheduler.WaitFreeSlot)
	e.advance(time.Second)
	waits(t, e.gate(e.req("high", job("o/high", 1, "x"), 1, quiet)), scheduler.WaitFreeSlot)
	st := e.status(m1).Tickets
	if st[0].GateID != "high" || st[1].GateID != "low" {
		t.Fatalf("order %+v", st)
	}
}

// R5.28. Ported from test_machine.py Slots test_find_held_matches_the_job.
func TestFreesEveryKindHeldByTheJob(t *testing.T) {
	e := newEnv(t)
	goes(t, e.gate(e.req("a", job("o/r", 1, "build"), 1, quiet)))
	goes(t, e.gate(e.req("b", job("o/r", 2, "build"), 1, quiet)))
	// a different run attempt is a different job
	other := job("o/r", 1, "build")
	other.RunAttempt = 2
	freed, err := e.eng.Release(context.Background(), m1, other, nil)
	if err != nil || len(freed) != 0 {
		t.Fatalf("freed %v %v", freed, err)
	}
	freed, _ = e.eng.Release(context.Background(), m1, job("o/r", 1, "build"), nil)
	if len(freed) != 1 || freed[0].Reason != slots.OutcomeRan {
		t.Fatalf("freed %+v", freed)
	}
	// a job that held no slot frees nothing and does not fail
	freed, err = e.eng.Release(context.Background(), m1, job("o/r", 77, "build"), nil)
	if err != nil || len(freed) != 0 {
		t.Fatalf("freed %v %v", freed, err)
	}
}

// R5.32 and R5.35. Ported from test_machine.py Slots test_dead_holder_is_freed_at_once_and_logged and
// test_live_holder_and_other_host_stay_old_slot_is_freed.
func TestReconcileOnAgentReconnect(t *testing.T) {
	e := newEnv(t)
	r1 := e.req("a", job("o/r", 1, "x"), 1, quiet)
	r1.Holder = scheduler.Holder{Machine: m1, HolderPID: 100, GatePID: 101}
	r2 := e.req("b", job("o/r", 2, "x"), 1, quiet)
	r2.Holder = scheduler.Holder{Machine: m1, HolderPID: 200, GatePID: 201}
	goes(t, e.gate(r1))
	goes(t, e.gate(r2))
	// a waiting job whose holder is gone loses its ticket too
	r3 := e.req("c", job("o/r", 3, "x"), 1, quiet)
	r3.Holder = scheduler.Holder{Machine: m1, HolderPID: 300, GatePID: 301}
	waits(t, e.gate(r3), scheduler.WaitFreeSlot)
	freed, err := e.eng.Reconcile(context.Background(), m1, []scheduler.Holder{{HolderPID: 200}})
	if err != nil {
		t.Fatal(err)
	}
	if len(freed) != 2 {
		t.Fatalf("freed %+v", freed)
	}
	st := e.status(m1)
	if len(st.Slots) != 1 || st.Slots[0].Job.RunID != 2 || len(st.Tickets) != 0 {
		t.Fatalf("status %+v", st)
	}
}

// R5.32: an unknown process id counts as alive; nothing is freed on a guess.
func TestUnknownHolderCountsAsAlive(t *testing.T) {
	e := newEnv(t)
	r := e.req("a", job("o/r", 1, "x"), 1, quiet)
	r.Holder = scheduler.Holder{Machine: m1}
	goes(t, e.gate(r))
	freed, _ := e.eng.Reconcile(context.Background(), m1, nil)
	if len(freed) != 0 {
		t.Fatalf("freed %+v", freed)
	}
}

// R5.32: liveness of another machine's holder is judged by that machine, not by this reconcile.
func TestReconcileLooksOnlyAtItsOwnHolders(t *testing.T) {
	e := newEnv(t)
	r := e.req("a", job("o/r", 1, "x"), 1, quiet)
	r.Holder = scheduler.Holder{Machine: "m2", HolderPID: 55}
	goes(t, e.gate(r))
	freed, _ := e.eng.Reconcile(context.Background(), m1, nil)
	if len(freed) != 0 {
		t.Fatalf("freed %+v", freed)
	}
	freed, _ = e.eng.Reconcile(context.Background(), "m2", nil)
	_ = freed
}

// R5.33. Ported from test_machine.py Slots test_live_holder_and_other_host_stay_old_slot_is_freed.
func TestOldSlotFreedByAge(t *testing.T) {
	e := newEnv(t)
	goes(t, e.gate(e.req("a", job("o/r", 1, "x"), 1, quiet)))
	e.advance(119 * time.Minute)
	freed, _ := e.eng.Sweep(context.Background(), e.now)
	if len(freed) != 0 {
		t.Fatalf("freed too early %+v", freed)
	}
	e.advance(2 * time.Minute)
	freed, _ = e.eng.Sweep(context.Background(), e.now)
	if len(freed) != 1 || freed[0].Reason != "older than 120 min" {
		t.Fatalf("freed %+v", freed)
	}
}

// R5.34. Ported from test_machine.py Queue test_dead_gate_and_old_tickets_are_dropped and
// test_dl292_ticket_heartbeat.py test_other_host_old_beat_dropped_and_logged.
func TestTicketExpiry(t *testing.T) {
	e := newEnv(t)
	e.fill(2)
	waits(t, e.gate(e.req("a", job("o/r", 1, "x"), 1, quiet)), scheduler.WaitFreeSlot)
	// a fresh beat keeps it
	e.advance(100 * time.Second)
	freed, _ := e.eng.Sweep(context.Background(), e.now)
	if len(freed) != 0 {
		t.Fatalf("freed %+v", freed)
	}
	if _, err := e.eng.Beat(context.Background(), m1, "a", quiet); err != nil {
		t.Fatal(err)
	}
	e.advance(100 * time.Second)
	freed, _ = e.eng.Sweep(context.Background(), e.now)
	if len(freed) != 0 {
		t.Fatalf("a beat did not keep the ticket: %+v", freed)
	}
	// no beat for longer than max(4 polls, 120 s)
	e.advance(30 * time.Second)
	freed, _ = e.eng.Sweep(context.Background(), e.now)
	if len(freed) != 1 || freed[0].Reason != "no heartbeat" {
		t.Fatalf("freed %+v", freed)
	}
}

// R5.36: cancelled-job leftovers.
func TestCompletedOnGitHubFreesLeftovers(t *testing.T) {
	e := newEnv(t)
	e.fill(2)
	waits(t, e.gate(e.req("a", job("o/r", 1, "x"), 1, quiet)), scheduler.WaitFreeSlot)
	freed, err := e.eng.CompletedOnGitHub(context.Background(), job("o/r", 900, "build"))
	if err != nil || len(freed) != 1 || freed[0].Reason != slots.OutcomeCompletedGH {
		t.Fatalf("freed %+v %v", freed, err)
	}
	freed, _ = e.eng.CompletedOnGitHub(context.Background(), job("o/r", 1, "x"))
	if len(freed) != 1 || freed[0].Number != 0 {
		t.Fatalf("ticket leftover %+v", freed)
	}
}

// R5.37: free stale on demand; a live slot only when named.
func TestFreeStaleCommand(t *testing.T) {
	e := newEnv(t)
	e.fill(2)
	freed, err := e.eng.FreeStale(context.Background(), m1, nil)
	if err != nil || len(freed) != 0 {
		t.Fatalf("freed %+v %v", freed, err)
	}
	freed, _ = e.eng.FreeStale(context.Background(), m1, []scheduler.Grant{{Kind: scheduler.SlotCI, Number: 2}})
	if len(freed) != 1 || freed[0].Job.RunID != 901 {
		t.Fatalf("freed %+v", freed)
	}
	e.advance(3 * time.Hour)
	freed, _ = e.eng.FreeStale(context.Background(), m1, nil)
	if len(freed) != 1 || freed[0].Reason != "older than 120 min" {
		t.Fatalf("freed %+v", freed)
	}
}

// R5.58. Ported from test_machine.py SlotsCommand test_slots_command_prints_holders_queue_and_waits and
// test_dl270_light_slot_listing.py test_light_slots_after_ci_slots.
func TestStatus(t *testing.T) {
	e := newEnv(t)
	e.fill(2)
	goes(t, e.gate(e.req("l", job("o/r", 5, "smoke"), 1, quiet)))
	waits(t, e.gate(e.req("w", job("o/r", 6, "x"), 1, quiet)), scheduler.WaitFreeSlot)
	e.advance(10 * time.Minute)
	st := e.status(m1)
	if len(st.Slots) != 3 || st.Slots[0].Kind != scheduler.SlotCI || st.Slots[2].Kind != scheduler.SlotLight {
		t.Fatalf("slots %+v", st.Slots)
	}
	if len(st.Tickets) != 1 || st.Tickets[0].Place != 1 || st.Tickets[0].Reason != scheduler.WaitFreeSlot {
		t.Fatalf("tickets %+v", st.Tickets)
	}
	if scheduler.Age(e.now, st.Slots[0].TakenAt) != 600 {
		t.Fatal("age")
	}
}

// R6.2. Ported from test_machine.py Slots test_race_two_processes_never_share_one_slot.
func TestTwoTakersNeverShareASlot(t *testing.T) {
	e := newEnv(t)
	e.settings(m1, func(s *slots.Settings) { s.JobSlots = 4 })
	var wg sync.WaitGroup
	got := make(chan scheduler.Grant, 16)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			d, err := e.eng.Gate(context.Background(), e.req("g"+string(rune('a'+i)), job("o/r", int64(i), "x"), 1, quiet))
			if err == nil && len(d.Go) > 0 {
				got <- d.Go[0]
			}
		}(i)
	}
	wg.Wait()
	close(got)
	seen := map[int]bool{}
	for g := range got {
		if seen[g.Number] {
			t.Fatalf("slot %d taken twice", g.Number)
		}
		seen[g.Number] = true
	}
	if len(seen) != 4 {
		t.Fatalf("%d slots taken, want 4", len(seen))
	}
}

// R6.4: ages are the controller's; an agent's clock cannot expire a live ticket.
func TestSkewedAgentClockKeepsTicket(t *testing.T) {
	e := newEnv(t)
	e.fill(2)
	r := e.req("a", job("o/r", 1, "x"), 1, quiet)
	r.FirstQueued = e.now.Add(-5 * time.Hour) // a skewed agent clock: older than the maximum age
	waits(t, e.gate(r), scheduler.WaitFreeSlot)
	freed, _ := e.eng.Sweep(context.Background(), e.now)
	if len(freed) != 0 {
		t.Fatalf("a skewed clock expired the ticket: %+v", freed)
	}
	r.FirstQueued = e.now.Add(5 * time.Hour) // from the future
	e.advance(time.Second)
	r.GateID = "b" // the same job under a new gate id replaces its ticket
	r.FirstQueued = e.now.Add(5 * time.Hour)
	e.gate(r)
	if len(e.status(m1).Tickets) != 1 {
		t.Fatalf("one job, one ticket: %+v", e.status(m1).Tickets)
	}
	for _, tk := range e.status(m1).Tickets {
		if tk.QueuedAt.After(e.now) {
			t.Fatalf("future queued time kept: %v", tk.QueuedAt)
		}
	}
}

// R5.38 and R5.39. Ported from test_machine.py SlotLog test_log_lines_and_trim. The log is read through
// a second engine call path: a log row per take and per free.
func TestLogRowsAndTrim(t *testing.T) {
	e := newEnv(t)
	goes(t, e.gate(e.req("a", job("o/r", 1, "x"), 1, quiet)))
	if _, err := e.eng.Release(context.Background(), m1, job("o/r", 1, "x"), nil); err != nil {
		t.Fatal(err)
	}
	n, events, err := e.st.SlotLogForTests(context.Background(), m1)
	if err != nil || n != 2 || events[0] != slots.EventTaken || events[1] != slots.EventFreed {
		t.Fatalf("log %d %v %v", n, events, err)
	}
	// keep the newest 5000
	for i := 0; i < slots.LogKeep+10; i++ {
		goes(t, e.gate(e.req("g", job("o/r", int64(10+i), "x"), 1, quiet)))
		_, _ = e.eng.Release(context.Background(), m1, job("o/r", int64(10+i), "x"), nil)
	}
	n, _, _ = e.st.SlotLogForTests(context.Background(), m1)
	if n != slots.LogKeep {
		t.Fatalf("log rows %d, want %d", n, slots.LogKeep)
	}
}
