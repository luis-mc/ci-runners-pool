package machines_test

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/agent"
	"github.com/luis-mc/ci-runners-shared-pool/internal/load"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines/secretstest"
)

// startLocalAgent runs the controller's own agent: the same Join call and the
// same Session, over loopback, with the one-time local credential instead of a
// typed code (machines R5.1).
func startLocalAgent(t *testing.T, e *env) (*agent.Gate, string) {
	t.Helper()
	if runtime.GOOS != "linux" {
		t.Skip("this test measures the real machine; Linux only")
	}
	ctx := context.Background()
	cred, err := e.Svc.LocalCredential(ctx)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	credFile := filepath.Join(dir, "local-join")
	if err := os.WriteFile(credFile, []byte(cred), 0o600); err != nil {
		t.Fatal(err)
	}
	sampler := load.NewSampler(load.OSProbe{})
	gate := agent.NewGate(sampler)
	cfg := agent.Config{
		Controller: e.Addr, Pin: e.CA.Fingerprint(), LocalCredentialFile: credFile, Secrets: secretstest.New(), DataDir: dir,
		Version: "test", Sampler: sampler, Gate: gate,
		HeartbeatEvery: 50 * time.Millisecond, LoadEvery: 50 * time.Millisecond, SampleEvery: 20 * time.Millisecond, DrainPollEvery: 20 * time.Millisecond,
	}
	runCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() { _ = agent.Run(runCtx, cfg); close(done) }()
	t.Cleanup(func() { cancel(); <-done })
	var id string
	waitFor(t, "the controller's own machine", func() bool {
		vs, _ := e.Svc.List(ctx)
		if len(vs) == 1 && vs[0].Machine.Online && vs[0].Load != nil {
			id = vs[0].Machine.ID
			return true
		}
		return false
	})
	return gate, id
}

// R5.1: the controller runs its own agent. At first run it joins that agent
// without a join code, over the same link and port as any other agent
// (loopback). The machine then appears like any other.
func TestControllerJoinsItsOwnAgentWithoutACode(t *testing.T) {
	e := newEnv(t)
	_, id := startLocalAgent(t, e)
	v, err := e.Svc.Get(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	if !v.Machine.IsController || v.Machine.Facts.HostName == "" || v.Machine.Facts.MemoryBytes == 0 || v.Machine.Facts.Threads == 0 {
		t.Fatalf("machine = %+v", v.Machine)
	}
	if len(v.Backends) != 9 {
		t.Fatalf("%d backends detected", len(v.Backends))
	}
	if v.Load == nil || !v.Load.MemoryKnown {
		t.Fatalf("load = %+v", v.Load)
	}
	// It used the same join path: a join in the audit log, no join code made.
	joined := false
	for _, a := range e.Repo.AuditLog() {
		if a.Action == "machine.join" && a.Subject == id {
			joined = true
		}
		if a.Action == "join_code.create" {
			t.Fatal("the local join made a join code")
		}
	}
	if !joined {
		t.Fatal("no machine.join in the audit log")
	}
	// The credential works once.
	if _, err := e.Svc.Join(context.Background(), machines.JoinInput{Code: "x", Local: true, Facts: machines.Facts{OS: "linux", Arch: "x64"}}); err == nil {
		t.Fatal("a made-up credential joined")
	}
}

// R5.2: the controller's own machine follows every rule: settings, drain, load.
func TestControllerMachineFollowsEveryRule(t *testing.T) {
	e := newEnv(t)
	gate, id := startLocalAgent(t, e)
	ctx := context.Background()
	waitFor(t, "settings applied", func() bool { _, ok := gate.Settings(); return ok })
	if _, _, err := e.Svc.UpdateSettings(ctx, "owner", id, machines.SettingsUpdate{BudgetMemoryPct: ptr(50)}); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "budget reached the agent", func() bool { s, _ := gate.Settings(); return s.BudgetMemoryPct == 50 })
	ch, err := e.Svc.Drain(ctx, "owner", id, "")
	if err != nil {
		t.Fatal(err)
	}
	waitFor(t, "drained", func() bool { c, _ := e.Svc.GetChange(ctx, id, ch.ID); return c.State == machines.ChangeDone })
	waitFor(t, "gate follows the drained state", func() bool { return gate.State() == machines.StateDrained })
}
