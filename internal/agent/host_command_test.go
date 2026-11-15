package agent_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/agent"
	"github.com/luis-mc/ci-runners-shared-pool/internal/agentlink"
	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
)

// TestHostHelperProcess is the "command" the host tests run: this test binary
// again. It prints its argument, then exits or sleeps as the environment says.
func TestHostHelperProcess(t *testing.T) {
	if os.Getenv("CRSP_HOST_HELPER") != "1" {
		t.Skip("helper process only")
	}
	fmt.Println("helper says " + os.Getenv("CRSP_HOST_SAY"))
	if d, err := time.ParseDuration(os.Getenv("CRSP_HOST_SLEEP")); err == nil {
		time.Sleep(d)
	}
	code, _ := strconv.Atoi(os.Getenv("CRSP_HOST_EXIT"))
	os.Exit(code)
}

func helperArgv() []string {
	return []string{os.Args[0], "-test.run=^TestHostHelperProcess$"}
}

type hostRig struct {
	svc  *machines.Service
	lk   *agentlink.Link
	id   string
	gate *agent.Gate
}

func startHost(t *testing.T) *hostRig {
	t.Helper()
	c := startController(t)
	lk := agentlink.New(c.Svc)
	lk.Timeout = 10 * time.Second
	c.Svc.SetHostRunner(lk)
	c.Svc.SetHooks(machines.Hooks{
		OnHello: func(_ context.Context, id string, _ *agentv1.Hello) { lk.OnHello(id) },
		OnMessage: func(_ context.Context, id string, m *agentv1.SessionRequest, _ func(*agentv1.SessionResponse)) bool {
			return lk.OnMessage(id, m)
		},
	})
	code, _ := c.Svc.CreateJoinCode(context.Background(), "owner", 0)
	cfg := fastConfig(t, c, code.Code)
	cfg.Gate = agent.NewGate(cfg.Sampler)
	cfg.HeartbeatEvery = 2 * time.Second
	r := &hostRig{svc: c.Svc, lk: lk, gate: cfg.Gate}
	runAgent(t, cfg)
	waitFor(t, "online", func() bool {
		vs, _ := c.Svc.List(context.Background())
		if len(vs) == 1 && vs[0].Machine.Online && c.Svc.Connected(vs[0].Machine.ID) {
			r.id = vs[0].Machine.ID
			return true
		}
		return false
	})
	waitFor(t, "machine report", func() bool { rep, ok := lk.Reports()[r.id]; return ok && rep.GetHostCommand() })
	waitFor(t, "settings", func() bool { _, have := cfg.Gate.Settings(); return have })
	return r
}

func (r *hostRig) drain(t *testing.T) {
	t.Helper()
	if _, err := r.svc.Drain(context.Background(), "owner", r.id, "maintenance"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "drained", func() bool {
		v, _ := r.svc.Get(context.Background(), r.id)
		return v.Machine.State == machines.StateDrained
	})
}

// A drained machine runs the command; the answer holds the output, and the
// machine stays drained (the caller lifts the hold).
func TestHostCommandRunsOnADrainedMachine(t *testing.T) {
	t.Setenv("CRSP_HOST_HELPER", "1")
	t.Setenv("CRSP_HOST_SAY", "compact")
	r := startHost(t)
	r.drain(t)
	out, err := r.svc.RunHostCommand(context.Background(), "owner", r.id, helperArgv(), time.Minute)
	if err != nil || !out.OK || out.ExitCode != 0 || !strings.Contains(out.Output, "helper says compact") {
		t.Fatalf("out %+v err %v", out, err)
	}
	if v, _ := r.svc.Get(context.Background(), r.id); v.Machine.State != machines.StateDrained {
		t.Fatalf("state %s", v.Machine.State)
	}
}

func TestHostCommandFailureKeepsExitCodeAndOutput(t *testing.T) {
	t.Setenv("CRSP_HOST_HELPER", "1")
	t.Setenv("CRSP_HOST_SAY", "disk busy")
	t.Setenv("CRSP_HOST_EXIT", "3")
	r := startHost(t)
	r.drain(t)
	out, err := r.svc.RunHostCommand(context.Background(), "owner", r.id, helperArgv(), time.Minute)
	if err != nil || out.OK || out.ExitCode != 3 || !strings.Contains(out.Output, "disk busy") || !strings.Contains(out.Message, "code 3") {
		t.Fatalf("out %+v err %v", out, err)
	}
}

func TestHostCommandTimeoutStopsTheCommand(t *testing.T) {
	t.Setenv("CRSP_HOST_HELPER", "1")
	t.Setenv("CRSP_HOST_SLEEP", "1m")
	r := startHost(t)
	r.drain(t)
	out, err := r.svc.RunHostCommand(context.Background(), "owner", r.id, helperArgv(), time.Second)
	if err != nil || out.OK || out.ExitCode != -1 || !strings.Contains(out.Message, "was stopped") {
		t.Fatalf("out %+v err %v", out, err)
	}
}

// A machine that still takes jobs, or still waits for one, gets nothing: the
// controller refuses, and an agent asked directly refuses too. The running job
// is not touched.
func TestHostCommandNeverMeetsAJob(t *testing.T) {
	t.Setenv("CRSP_HOST_HELPER", "1")
	r := startHost(t)
	// Active machine: refused by the controller.
	if _, err := r.svc.RunHostCommand(context.Background(), "owner", r.id, helperArgv(), time.Minute); !errors.Is(err, machines.ErrConflict) {
		t.Fatalf("active: %v", err)
	}
	// Active machine, straight to the agent: it refuses.
	out, err := r.lk.RunHostCommand(context.Background(), r.id, helperArgv(), time.Minute)
	if err != nil || out.OK || !strings.Contains(out.Message, "drain it first") {
		t.Fatalf("agent on an active machine: %+v %v", out, err)
	}
	// A job runs; the drain waits; the command is refused until the job ends.
	jr := machines.JobRef{Repository: "o/r", RunID: 7, Job: "build", RunnerName: "r1"}
	waitFor(t, "job starts", func() bool { return r.gate.Start("j1", jr, "persistent").Go })
	if _, err := r.svc.Drain(context.Background(), "owner", r.id, "maintenance"); err != nil {
		t.Fatal(err)
	}
	if _, err := r.svc.RunHostCommand(context.Background(), "owner", r.id, helperArgv(), time.Minute); !errors.Is(err, machines.ErrConflict) {
		t.Fatalf("draining: %v", err)
	}
	out, err = r.lk.RunHostCommand(context.Background(), r.id, helperArgv(), time.Minute)
	if err != nil || out.OK || !strings.Contains(out.Message, "1 jobs still run") {
		t.Fatalf("agent with a running job: %+v %v", out, err)
	}
	// The job was not cut.
	if idle, waiting := r.gate.Hold(); idle || len(waiting) != 1 {
		t.Fatalf("the running job is gone: idle=%v waiting=%v", idle, waiting)
	}
}

func TestHostCommandRefusesEmptyAndUnknown(t *testing.T) {
	r := startHost(t)
	r.drain(t)
	if _, err := r.svc.RunHostCommand(context.Background(), "owner", r.id, nil, time.Minute); !errors.Is(err, machines.ErrInvalid) {
		t.Fatalf("empty: %v", err)
	}
	if _, err := r.svc.RunHostCommand(context.Background(), "owner", r.id, []string{"x"}, 48*time.Hour); !errors.Is(err, machines.ErrInvalid) {
		t.Fatalf("long: %v", err)
	}
	if _, err := r.svc.RunHostCommand(context.Background(), "owner", "m_nope", []string{"x"}, time.Minute); !errors.Is(err, machines.ErrNotFound) {
		t.Fatalf("unknown: %v", err)
	}
}
