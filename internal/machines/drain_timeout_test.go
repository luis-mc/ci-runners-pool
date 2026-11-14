package machines_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
)

type stopper struct{ stopped []machines.JobRef }

func (s *stopper) StopJobs(_ context.Context, _ string, jobs []machines.JobRef) error {
	s.stopped = append(s.stopped, jobs...)
	return nil
}

// R5.33: when the drain timeout passes with jobs still running, the change does
// not run and nothing is stopped. The machine shows "needs you" with the jobs
// and three choices: wait longer, cancel the change, or stop those jobs now
// (which names each job and asks for a yes).
func TestDrainTimeoutNeedsYouAndStopsNothing(t *testing.T) {
	st := &stopper{}
	e := newEnv(t, func(o *machines.Options) { o.Stopper = st })
	r, _ := e.joined("box-1")
	id := r.GetMachineId()
	fa, _ := e.session(id, r.GetMachineCredential(), &agentv1.Hello{Holders: &agentv1.HolderReport{Running: []*agentv1.JobRef{oneJob}}})
	ch, _ := e.Svc.Drain(context.Background(), "owner", id, "")
	fa.Next(isDrain)
	fa.Send(drainStatus(ch.ID, false, oneJob))

	e.Clk.Add(59 * time.Minute)
	if err := e.Svc.Tick(context.Background()); err != nil {
		t.Fatal(err)
	}
	if c, _ := e.Svc.GetChange(context.Background(), id, ch.ID); c.State != machines.ChangeWaiting {
		t.Fatalf("before the timeout: %v", c.State)
	}
	e.Clk.Add(2 * time.Minute)
	_ = e.Svc.Tick(context.Background())
	c, _ := e.Svc.GetChange(context.Background(), id, ch.ID)
	if c.State != machines.ChangeNeedsYou {
		t.Fatalf("after the timeout: %v, want needs_you", c.State)
	}
	if len(st.stopped) != 0 {
		t.Fatal("a job was stopped by the timeout")
	}
	if v, _ := e.Svc.Get(context.Background(), id); v.Machine.State != machines.StateDraining || len(v.RunningJobs) != 1 {
		t.Fatalf("machine = %v, jobs = %d", v.Machine.State, len(v.RunningJobs))
	}

	// Choice 3 names each job and asks for a yes first.
	_, err := e.Svc.DecideChange(context.Background(), "owner", id, ch.ID, machines.StopJobs, 0, false)
	var nc *machines.NeedsConfirmationError
	if !errors.As(err, &nc) || len(nc.Names) != 1 || !strings.Contains(nc.Names[0], "o/r") {
		t.Fatalf("stop without yes: %v", err)
	}
	if len(st.stopped) != 0 {
		t.Fatal("jobs stopped without a yes")
	}
	// Choice 1: wait longer.
	c, err = e.Svc.DecideChange(context.Background(), "owner", id, ch.ID, machines.WaitLonger, 30, false)
	if err != nil || c.State != machines.ChangeWaiting || !c.Deadline.After(e.Clk.Now().Add(29*time.Minute)) {
		t.Fatalf("wait longer: %+v %v", c, err)
	}
	fa.Next(isDrain) // the agent hears the new timeout
	if _, err := e.Svc.DecideChange(context.Background(), "owner", id, ch.ID, machines.WaitLonger, 2, false); !errors.Is(err, machines.ErrInvalid) {
		t.Fatalf("a wait under 5 minutes: %v", err)
	}
	// Stop with a yes goes to the runners feature.
	if _, err := e.Svc.DecideChange(context.Background(), "owner", id, ch.ID, machines.StopJobs, 0, true); err != nil || len(st.stopped) != 1 {
		t.Fatalf("stop with yes: %v, stopped=%d", err, len(st.stopped))
	}
	// Choice 2: cancel puts the machine back to active.
	c, err = e.Svc.DecideChange(context.Background(), "owner", id, ch.ID, machines.CancelIt, 0, false)
	if err != nil || c.State != machines.ChangeCancel {
		t.Fatalf("cancel: %+v %v", c, err)
	}
	fa.Next(isResume)
	if v, _ := e.Svc.Get(context.Background(), id); v.Machine.State != machines.StateActive {
		t.Fatalf("state = %v", v.Machine.State)
	}
}

func TestStopJobsWithoutRunnersFeatureSaysSo(t *testing.T) {
	e, id, fa := running(t)
	ch, _ := e.Svc.Drain(context.Background(), "owner", id, "")
	fa.Next(isDrain)
	e.Clk.Add(2 * time.Hour)
	_ = e.Svc.Tick(context.Background())
	if _, err := e.Svc.DecideChange(context.Background(), "owner", id, ch.ID, machines.StopJobs, 0, true); !errors.Is(err, machines.ErrNotSupported) {
		t.Fatalf("err = %v", err)
	}
}
