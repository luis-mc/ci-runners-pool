package repos

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

func TestDesiredVariables(t *testing.T) { // R5.28
	e := newEnv(t)
	e.cap.m = map[string][]string{"Linux": {"X64", "crsp-home"}, "Windows": {"X64", "crsp-home"}}
	ctx := context.Background()
	got, err := e.svc.Desired(ctx, DefaultPolicy())
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got["CRSP_RUNS_ON_LINUX"] != `["self-hosted","Linux","X64","crsp-home"]` ||
		got["CRSP_RUNS_ON_WINDOWS"] != `["self-hosted","Windows","X64","crsp-home"]` {
		t.Fatalf("%v", got)
	}
	if _, ok := got["CRSP_RUNS_ON_MACOS"]; ok {
		t.Fatal("no variable for an OS no machine serves")
	}
	// The policy enables only the OS it names.
	got, _ = e.svc.Desired(ctx, Policy{Labels: []string{"windows", "gpu"}})
	if len(got) != 1 || got["CRSP_RUNS_ON_WINDOWS"] != `["self-hosted","Windows","X64","crsp-home","gpu"]` {
		t.Fatalf("%v", got)
	}
	// Policy that names an OS no machine serves: nothing to write.
	got, _ = e.svc.Desired(ctx, Policy{Labels: []string{"macos"}})
	if len(got) != 0 {
		t.Fatalf("%v", got)
	}
	// Valid JSON lists of strings, always.
	for _, v := range []string{`["self-hosted","Linux"]`} {
		var l []string
		if json.Unmarshal([]byte(v), &l) != nil {
			t.Fatal("json")
		}
	}
}

func TestVariableDriftRestoredAndAudited(t *testing.T) { // R5.28
	e := newEnv(t)
	e.world()
	e.turnOn(101)
	ctx := context.Background()
	good, _ := e.fake.Variable("alice/secret", "CRSP_RUNS_ON_LINUX")

	if err := e.svc.ReconcileVariables(ctx, 101); err != nil {
		t.Fatal(err)
	}
	if mv, _ := e.store.ListManagedVariables(ctx, 101); mv[0].Status != VarOK {
		t.Fatalf("%+v", mv)
	}
	writes := e.fake.Count("PATCH", "/repos/alice/secret/actions/variables")

	e.fake.SetVariable("alice/secret", "CRSP_RUNS_ON_LINUX", `["ubuntu-latest"]`) // changed outside the product
	if err := e.svc.ReconcileVariables(ctx, 101); err != nil {
		t.Fatal(err)
	}
	if v, _ := e.fake.Variable("alice/secret", "CRSP_RUNS_ON_LINUX"); v != good {
		t.Fatalf("restored: %s", v)
	}
	if e.fake.Count("PATCH", "/repos/alice/secret/actions/variables") != writes+1 {
		t.Fatal("exactly one restoring write")
	}
	found := false
	for _, ev := range e.audit.events {
		if strings.HasPrefix(ev, "variable.restored|controller|alice/secret|") && strings.Contains(ev, "ubuntu-latest") {
			found = true
		}
	}
	if !found {
		t.Fatalf("the audit log records the drift: %v", e.audit.events)
	}
	mv, _ := e.store.ListManagedVariables(ctx, 101)
	if mv[0].Status != VarWrong {
		t.Fatalf("the row shows drift until the next check finds it right: %+v", mv)
	}
	if err := e.svc.ReconcileVariables(ctx, 101); err != nil {
		t.Fatal(err)
	}
	if mv, _ := e.store.ListManagedVariables(ctx, 101); mv[0].Status != VarOK {
		t.Fatalf("%+v", mv)
	}
	v, _ := e.svc.Get(ctx, adminP, 101)
	if v.VariablesDrift {
		t.Fatal("no drift left")
	}
}

func TestMissingVariableRestored(t *testing.T) { // R5.28
	e := newEnv(t)
	e.world()
	e.turnOn(101)
	ctx := context.Background()
	e.fake.Lock(func() { delete(e.fake.Variables["alice/secret"], "CRSP_RUNS_ON_LINUX") })
	if err := e.svc.ReconcileVariables(ctx, 101); err != nil {
		t.Fatal(err)
	}
	if _, ok := e.fake.Variable("alice/secret", "CRSP_RUNS_ON_LINUX"); !ok {
		t.Fatal("deleted outside the product: written back")
	}
	if mv, _ := e.store.ListManagedVariables(ctx, 101); mv[0].Status != VarMissing {
		t.Fatalf("%+v", mv)
	}
}

func TestReconcileSkipsPoolOff(t *testing.T) { // R5.28
	e := newEnv(t)
	e.world()
	before := len(e.fake.Requests())
	if err := e.svc.ReconcileVariables(context.Background(), 101); err != nil {
		t.Fatal(err)
	}
	if len(e.fake.Requests()) != before {
		t.Fatal("a repository with the pool off is not touched")
	}
}

func TestReconcileAllStopsAtRateLimit(t *testing.T) { // R6.6
	e := newEnv(t)
	e.world()
	e.turnOn(100, 101)
	e.fake.Lock(func() { e.fake.RateRemaining = 100 })
	// One user-driven call records the low budget.
	_, _ = e.gh.ListVariables(context.Background(), 10, "alice", "web")
	e.fake.SetVariable("alice/web", "CRSP_RUNS_ON_LINUX", "[]")
	err := e.svc.ReconcileAllVariables(context.Background())
	var rl *github.RateLimitError
	if !errors.As(err, &rl) {
		t.Fatalf("background work stops past half the limit: %v", err)
	}
	if v, _ := e.fake.Variable("alice/web", "CRSP_RUNS_ON_LINUX"); v != "[]" {
		t.Fatal("no write while the budget is spent")
	}
	e.advance(3 * time.Hour)
	e.fake.Lock(func() { e.fake.RateRemaining = 5000 })
	if err := e.svc.ReconcileAllVariables(context.Background()); err != nil {
		t.Fatal(err)
	}
	if v, _ := e.fake.Variable("alice/web", "CRSP_RUNS_ON_LINUX"); v == "[]" {
		t.Fatal("restored after the reset")
	}
}
