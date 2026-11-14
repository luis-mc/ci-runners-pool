package scheduler

import (
	"context"
	"log/slog"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/slots"
)

// Release frees every slot and ticket the job holds on the machine, of every
// kind, with the outcome ran (R5.28). When claims are given, a slot is freed
// only with its claim (R5.15). A job that holds nothing frees nothing.
//
// A job-completed hook that frees nothing means the job never took a slot: its
// job-started hook did not reach the gate (crsp missing, broken or cut off from
// its agent, or the gate let the job go on its on-timeout rule). The engine
// raises AlertJobStartedMissing for it (R5.60), once per call, and still
// returns no error: the job has finished and nothing fails.
func (e *Engine) Release(ctx context.Context, machineID string, job JobRef, claims []string) ([]Freed, error) {
	freed, err := e.freeJob(ctx, machineID, toJob(job), claims, slots.OutcomeRan)
	if err == nil && len(freed) == 0 && machineID != "" && len(claims) == 0 {
		a := Alert{Kind: AlertJobStartedMissing, MachineID: machineID, Job: job, At: e.now(),
			Message: "A job ended on this machine that never took a slot, so its job-started hook did not reach crsp or the gate let it go without one. " +
				"Run 'crsp doctor --check runner.hooks' for the runner that ran it."}
		e.log.Warn("job ended without a slot", "machine", machineID, "repository", job.Repository, "run", job.RunID, "job", job.Job, "runner", job.RunnerName)
		if e.alert != nil {
			e.alert(a)
		}
	}
	return freed, err
}

// CompletedOnGitHub frees leftovers of a job GitHub reports completed, on
// every machine (R5.36).
func (e *Engine) CompletedOnGitHub(ctx context.Context, job JobRef) ([]Freed, error) {
	return e.freeJob(ctx, "", toJob(job), nil, slots.OutcomeCompletedGH)
}

func (e *Engine) freeJob(ctx context.Context, machineID string, job slots.Job, claims []string, outcome string) ([]Freed, error) {
	var freed []Freed
	err := e.store.Atomically(ctx, func(tx slots.Tx) error {
		now := e.now()
		var all []slots.Slot
		var err error
		if machineID == "" {
			all, err = tx.AllSlots()
		} else {
			all, err = tx.Slots(machineID)
		}
		if err != nil {
			return err
		}
		for _, s := range jobSlots(all, job) {
			if len(claims) > 0 && !has(claims, s.Claim) {
				continue
			}
			ok, err := tx.FreeSlot(s.MachineID, s.Kind, s.Number, s.Claim)
			if err != nil {
				return err
			}
			if ok {
				freed = append(freed, e.freedRow(tx, s, slots.EventFreed, outcome, now))
			}
		}
		var tickets []slots.Ticket
		if machineID == "" {
			tickets, err = tx.AllTickets()
		} else {
			tickets, err = tx.Tickets(machineID)
		}
		if err != nil {
			return err
		}
		for _, t := range tickets {
			if !t.Job.SameJob(job) {
				continue
			}
			if ok, err := tx.DeleteTicket(t.ID); err != nil {
				return err
			} else if ok {
				freed = append(freed, e.droppedRow(tx, t, outcome, now))
			}
		}
		if len(freed) > 0 {
			return tx.Enqueue("wake_gates", `{"machine":"`+machineID+`"}`)
		}
		return nil
	})
	e.notifyFreed(freed)
	return freed, err
}

func has(l []string, s string) bool {
	for _, x := range l {
		if x == s {
			return true
		}
	}
	return false
}

// Reconcile frees every slot and ticket of the machine whose holder is not in
// alive (agent reconnect, R5.35). A holder with an unknown process id (0)
// counts as alive: nothing is freed on a guess (R5.32). Liveness is judged by
// the agent of the holder's machine, so only slots whose holder machine is
// this machine are looked at.
func (e *Engine) Reconcile(ctx context.Context, machineID string, alive []Holder) ([]Freed, error) {
	liveSet := map[int64]time.Time{}
	for _, h := range alive {
		liveSet[h.HolderPID] = h.HolderStarted
		if h.GatePID != 0 {
			liveSet[h.GatePID] = h.HolderStarted
		}
	}
	isAlive := func(h slots.Holder) bool {
		if h.PID == 0 {
			return true
		}
		started, ok := liveSet[h.PID]
		if !ok {
			return false
		}
		// A reused pid has another start time (proto Holder.holder_started_unix_ms).
		if !started.IsZero() && !h.Started.IsZero() && !started.Equal(h.Started) {
			return false
		}
		return true
	}
	var freed []Freed
	err := e.store.Atomically(ctx, func(tx slots.Tx) error {
		now := e.now()
		all, err := tx.Slots(machineID)
		if err != nil {
			return err
		}
		for _, s := range all {
			if s.Holder.Machine != "" && s.Holder.Machine != machineID || isAlive(s.Holder) {
				continue
			}
			if ok, err := tx.FreeSlot(s.MachineID, s.Kind, s.Number, s.Claim); err != nil {
				return err
			} else if ok {
				freed = append(freed, e.freedRow(tx, s, slots.EventStaleFreed, "holder process gone", now))
			}
		}
		tickets, err := tx.Tickets(machineID)
		if err != nil {
			return err
		}
		for _, t := range tickets {
			if t.Holder.Machine != "" && t.Holder.Machine != machineID || isAlive(t.Holder) {
				continue
			}
			if ok, err := tx.DeleteTicket(t.ID); err != nil {
				return err
			} else if ok {
				freed = append(freed, e.droppedRow(tx, t, "holder process gone", now))
			}
		}
		return nil
	})
	e.notifyFreed(freed)
	return freed, err
}

// Sweep frees slots past the slot maximum age and drops expired tickets on
// every machine (R5.33, R5.34).
func (e *Engine) Sweep(ctx context.Context, now time.Time) ([]Freed, error) {
	var freed []Freed
	err := e.store.Atomically(ctx, func(tx slots.Tx) error {
		f, err := e.staleSlots(tx, "", now)
		freed = f
		return err
	})
	e.notifyFreed(freed)
	return freed, err
}

// FreeStale frees the stale slots of a machine on demand. Live slots named in
// live are freed too, because the caller asked for a yes (R5.37).
func (e *Engine) FreeStale(ctx context.Context, machineID string, live []Grant) ([]Freed, error) {
	var freed []Freed
	err := e.store.Atomically(ctx, func(tx slots.Tx) error {
		now := e.now()
		f, err := e.staleSlots(tx, machineID, now)
		if err != nil {
			return err
		}
		freed = f
		for _, g := range live {
			all, err := tx.Slots(machineID)
			if err != nil {
				return err
			}
			for _, s := range all {
				if s.Kind != slots.Kind(g.Kind) || s.Number != g.Number {
					continue
				}
				if ok, err := tx.FreeSlot(machineID, s.Kind, s.Number, s.Claim); err != nil {
					return err
				} else if ok {
					freed = append(freed, e.freedRow(tx, s, slots.EventFreed, "freed by hand", now))
				}
			}
		}
		return nil
	})
	e.notifyFreed(freed)
	return freed, err
}

// RunSweeper runs Sweep every interval until ctx ends, so slots past the slot
// maximum age and tickets past their beat limit are freed even when no gate
// polls (R5.33, R5.34). A failed sweep is logged and tried again.
func RunSweeper(ctx context.Context, q SlotQueue, log *slog.Logger, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-t.C:
			freed, err := q.Sweep(ctx, now.UTC())
			if err != nil {
				log.Warn("slot sweep failed", "err", err)
				continue
			}
			for _, f := range freed {
				log.Info("slot sweep freed", "machine", f.MachineID, "kind", f.Kind, "slot", f.Number,
					"repository", f.Job.Repository, "run", f.Job.RunID, "job", f.Job.Job, "reason", f.Reason)
			}
		}
	}
}
