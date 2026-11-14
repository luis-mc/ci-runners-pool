package scheduler

import (
	"context"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/slots"
)

// Release frees every slot and ticket the job holds on the machine, of every
// kind, with the outcome ran (R5.28). When claims are given, a slot is freed
// only with its claim (R5.15). A job that holds nothing frees nothing.
func (e *Engine) Release(ctx context.Context, machineID string, job JobRef, claims []string) ([]Freed, error) {
	return e.freeJob(ctx, machineID, toJob(job), claims, slots.OutcomeRan)
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
