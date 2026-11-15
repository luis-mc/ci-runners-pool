package repos

import (
	"context"
	"strings"
	"sync"
	"testing"
)

type fakeFleet struct {
	mu      sync.Mutex
	removed []int64
}

func (f *fakeFleet) RemoveRepositoryRunners(_ context.Context, id int64, _ string) ([]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.removed = append(f.removed, id)
	return []string{"crsp-job-1"}, nil
}

func publicEnv(t *testing.T) (*env, *fakeLight, *fakeFleet) {
	t.Helper()
	l, f := &fakeLight{}, &fakeFleet{}
	e := newEnv(t)
	e.svc.cfg.Light, e.svc.cfg.Fleet = l, f
	e.world()
	e.turnOn(101)
	return e, l, f
}

func (e *env) variable(name string) string {
	var v string
	e.fake.Lock(func() { v = e.fake.Variables["alice/secret"][name] })
	return v
}

// CRSP82: a served repository that turns public stops at once: pool off,
// RUNS_ON hosted, runners removed, the reason in the audit log.
func TestPublicizedStopsServing(t *testing.T) {
	e, light, fleet := publicEnv(t)
	ctx := context.Background()
	if v := e.variable("RUNS_ON_LINUX"); !strings.Contains(v, "crsp-home") {
		t.Fatalf("setup: the variable is %q", v)
	}
	e.fake.Lock(func() { e.fake.Repos[101].Private = false })
	if err := e.svc.Publicized(ctx, "Alice/Secret"); err != nil {
		t.Fatal(err)
	}
	r, _ := e.store.GetRepository(ctx, 101)
	if r.PoolOn || r.Visibility != "public" {
		t.Errorf("pool on %v, visibility %q", r.PoolOn, r.Visibility)
	}
	if v := e.variable("RUNS_ON_LINUX"); v != `["ubuntu-latest"]` {
		t.Errorf("RUNS_ON_LINUX = %s, want the hosted label", v)
	}
	if len(light.removed) != 1 || len(fleet.removed) != 1 || fleet.removed[0] != 101 {
		t.Errorf("light %v fleet %v", light.removed, fleet.removed)
	}
	if !e.audit.has("pool.off|controller|alice/secret|the repository is public") || !e.audit.has("runners.removed") {
		t.Errorf("the log does not say why: %v", e.audit.events)
	}
	// A second event changes nothing and does not fail.
	if err := e.svc.Publicized(ctx, "alice/secret"); err != nil {
		t.Fatal(err)
	}
	if len(fleet.removed) != 1 {
		t.Errorf("a repeat removed runners again: %v", fleet.removed)
	}
	// An unknown repository is ignored.
	if err := e.svc.Publicized(ctx, "nobody/nothing"); err != nil {
		t.Fatal(err)
	}
}

// CRSP82: the periodic visibility check (reconcile) finds a repository that
// turned public while the webhook was missed.
func TestReconcileStopsAPublicRepository(t *testing.T) {
	e, _, fleet := publicEnv(t)
	ctx := context.Background()
	e.fake.Lock(func() { e.fake.Repos[101].Private = false })
	if err := e.svc.ReconcileInstallations(ctx); err != nil {
		t.Fatal(err)
	}
	if r, _ := e.store.GetRepository(ctx, 101); r.PoolOn {
		t.Fatal("a public repository is still served")
	}
	if v := e.variable("RUNS_ON_LINUX"); v != `["ubuntu-latest"]` || len(fleet.removed) != 1 {
		t.Errorf("variable %s, fleet %v", v, fleet.removed)
	}
}

// A private repository is left alone by both paths.
func TestPrivateRepositoryStaysServed(t *testing.T) {
	e, _, fleet := publicEnv(t)
	ctx := context.Background()
	if err := e.svc.ReconcileInstallations(ctx); err != nil {
		t.Fatal(err)
	}
	if r, _ := e.store.GetRepository(ctx, 101); !r.PoolOn || len(fleet.removed) != 0 {
		t.Fatalf("pool on %v, fleet %v", r.PoolOn, fleet.removed)
	}
}
