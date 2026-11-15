package runners

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
)

func dockerMachine(allowed bool) Machine {
	m := machine("linux", "x64", true)
	m.Backends = append(m.Backends, BackendOption{Name: backend.Docker, Usable: true, Allowed: allowed,
		Kinds: []string{"ephemeral"}, OS: []string{"linux"}})
	return m
}

var repoScope = Scope{Kind: "repository", RepositoryID: 1}

// R5.27, R5.1: an ephemeral runner is planned only on a machine whose allow
// list names the container backend, and only for Linux.
func TestEphemeralOnlyOnAllowListedMachine(t *testing.T) {
	ctx := context.Background()
	r := newRig(dockerMachine(false))
	_, err := r.svc.PlanAdd(ctx, AddRequest{OS: "linux", Kind: "ephemeral", MachineID: "m1", Count: 1, Scope: repoScope}, "u")
	var re *RefusalError
	if !errors.As(err, &re) || !strings.Contains(re.Reason, "container backend allowed") {
		t.Fatalf("not allowed: %v", err)
	}
	r = newRig(dockerMachine(true))
	if _, err := r.svc.PlanAdd(ctx, AddRequest{OS: "windows", Kind: "ephemeral", MachineID: "m1", Count: 1, Scope: repoScope}, "u"); err == nil {
		t.Error("ephemeral Windows")
	}
	p, err := r.svc.PlanAdd(ctx, AddRequest{OS: "linux", Kind: "ephemeral", MachineID: "m1", Count: 1, Scope: repoScope}, "u")
	if err != nil || len(p.Steps) != 1 || !strings.Contains(p.Steps[0].Text, "ephemeral runner box-1") || p.Adds[0].Backend != "docker" {
		t.Fatalf("plan %+v %v", p, err)
	}
	if len(r.ag.added) != 0 || r.gh.regCalls != 0 || len(r.gh.jitCalls) != 0 {
		t.Error("a plan changes nothing")
	}
	// Applying it starts one JIT runner, never a registration token.
	if _, err := r.svc.Apply(ctx, p.ID, nil, "u"); err != nil {
		t.Fatal(err)
	}
	if len(r.ag.added) != 1 || r.gh.regCalls != 0 || len(r.gh.jitCalls) != 1 || r.ag.cfgs[0].JITConfig == "" {
		t.Fatalf("added %d reg %d jit %d", len(r.ag.added), r.gh.regCalls, len(r.gh.jitCalls))
	}
}

// Slot counting and cleanup of an ephemeral runner (scheduling R5.1, R5.26).
func TestEphemeralCountAndFinish(t *testing.T) {
	ctx := context.Background()
	r := newRig(dockerMachine(true))
	rec, err := r.svc.StartJobRunner(ctx, jobRunner(), "demand")
	if err != nil {
		t.Fatal(err)
	}
	if n, _ := r.svc.EphemeralOnMachine(ctx, "m1"); n != 1 {
		t.Fatalf("count %d", n)
	}
	if n, _ := r.svc.EphemeralOnMachine(ctx, "other"); n != 0 {
		t.Fatalf("other machine %d", n)
	}
	if err := r.svc.FinishJobRunner(ctx, rec.ID, "demand"); err != nil {
		t.Fatal(err)
	}
	if n, _ := r.svc.EphemeralOnMachine(ctx, "m1"); n != 0 || len(r.ag.folders) != 1 {
		t.Fatalf("after finish: count %d cleaned %v", n, r.ag.folders)
	}
	// A persistent runner is never cleaned up this way.
	p := newRig(machine("linux", "x64", true))
	pr := p.add(t)
	if err := p.svc.FinishJobRunner(ctx, pr.ID, "demand"); err == nil {
		t.Error("finished a persistent runner")
	}
}
