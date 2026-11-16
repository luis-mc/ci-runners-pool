package runners

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

func lightRig(t *testing.T) *rig {
	t.Helper()
	r := newRig(machine("linux", "x64", true))
	r.svc.Light = fakeLightPlacer{"linux": {{MachineID: "m1", LightSlots: 1}}}
	return r
}

// The owner's bug: every round added a new failed record, with repeated names.
func TestEnsureLightFailureDoesNotPileUp(t *testing.T) { // scheduling R5.65, UX-19
	r := lightRig(t)
	r.ag.addErr, r.ag.errRef = errors.New("service did not start"), "actions.runner.luis-mc-demo.crsp-light-demo-linux"
	ctx := context.Background()
	for round := 0; round < 40; round++ {
		res, err := r.svc.EnsureLight(ctx, 1, "demo", []string{"linux"}, "luis-mc")
		if round == 0 && err == nil {
			t.Fatal("the first try fails and says so")
		}
		if len(res) != 1 || res[0].Runner != "" {
			t.Fatalf("round %d: %+v", round, res)
		}
		recs, lerr := r.svc.LightRunners(ctx, 1)
		if lerr != nil || len(recs) > 1 {
			t.Fatalf("round %d: %d light records %v", round, len(recs), lerr)
		}
		if len(recs) == 1 && recs[0].State != Failed {
			t.Fatalf("round %d: %+v", round, recs[0])
		}
		r.clock = r.clock.Add(10 * time.Minute)
	}
	if got := len(r.ag.added); got != LightMaxTries {
		t.Fatalf("tried %d times, the cap is %d", got, LightMaxTries)
	}
	for _, a := range r.ag.added {
		if a.Name != "crsp-light-demo-linux" {
			t.Fatalf("name %s changed between tries", a.Name)
		}
	}
	// Each new try cleaned the leftover service first.
	if len(r.ag.folders) != LightMaxTries-1 {
		t.Fatalf("clean ups %d: %v", len(r.ag.folders), r.ag.folders)
	}
	res, _ := r.svc.EnsureLight(ctx, 1, "demo", []string{"linux"}, "luis-mc")
	if !strings.Contains(res[0].Why, "service did not start") || !strings.Contains(res[0].Why, "Remove it") {
		t.Fatalf("the reason is shown: %q", res[0].Why)
	}
}

func TestEnsureLightWaitsForTheBackoff(t *testing.T) { // UX-19
	r := lightRig(t)
	r.ag.addErr = errors.New("boom")
	ctx := context.Background()
	if _, err := r.svc.EnsureLight(ctx, 1, "demo", []string{"linux"}, "x"); err == nil {
		t.Fatal("first try fails")
	}
	res, err := r.svc.EnsureLight(ctx, 1, "demo", []string{"linux"}, "x")
	if err != nil || !strings.Contains(res[0].Why, "next try at 10:01 UTC") || !strings.Contains(res[0].Why, "boom") || len(r.ag.added) != 1 {
		t.Fatalf("%+v %v added %d", res, err, len(r.ag.added))
	}
	r.clock = r.clock.Add(time.Minute)
	r.ag.addErr = nil
	res, err = r.svc.EnsureLight(ctx, 1, "demo", []string{"linux"}, "x")
	if err != nil || !res[0].Added || res[0].Runner != "crsp-light-demo-linux" {
		t.Fatalf("retry %+v %v", res, err)
	}
	if recs, _ := r.svc.LightRunners(ctx, 1); len(recs) != 1 || recs[0].State != Idle {
		t.Fatalf("one idle record: %+v", recs)
	}
}

func TestEnsureLightOneRecordPerOS(t *testing.T) { // scheduling R5.65
	r := newRig(machine("linux", "x64", true))
	r.svc.Light = fakeLightPlacer{"linux": {{MachineID: "m1", LightSlots: 2}}}
	ctx := context.Background()
	// A pile left by the old loop: three failed records.
	for i, n := range []string{"crsp-light-demo-1-linux", "crsp-light-demo-1-linux-b", "crsp-light-demo-linux"} {
		rec := Record{ID: "old" + string(rune('a'+i)), Name: n, MachineID: "m1", OS: "linux", Kind: "persistent", Managed: true,
			Route: Route{Queue: QueueLight}, Scope: Scope{Kind: "repository", RepositoryID: 1}, State: Failed, Reason: "old failure",
			CreatedAt: r.clock.Add(time.Duration(i) * time.Second), ServiceName: "actions.runner.luis-mc-demo." + n}
		if err := r.store.InsertRunner(ctx, rec); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := r.svc.EnsureLight(ctx, 1, "demo", []string{"linux"}, "x"); err != nil {
		t.Fatal(err)
	}
	recs, _ := r.svc.LightRunners(ctx, 1)
	if len(recs) != 1 || recs[0].State != Idle {
		t.Fatalf("one working record: %+v", recs)
	}
	// Three leftovers were cleaned: the two extras and the retried one.
	if len(r.ag.folders) != 3 {
		t.Fatalf("clean ups %v", r.ag.folders)
	}
	// With a working runner, more rounds add nothing.
	for i := 0; i < 5; i++ {
		if _, err := r.svc.EnsureLight(ctx, 1, "demo", []string{"linux"}, "x"); err != nil {
			t.Fatal(err)
		}
	}
	if recs, _ := r.svc.LightRunners(ctx, 1); len(recs) != 1 || len(r.ag.added) != 1 {
		t.Fatalf("%d records, %d adds", len(recs), len(r.ag.added))
	}
}

func TestEnsureLightCleansRegistrationAndKeepsRecordOnCleanupFailure(t *testing.T) { // scheduling R5.65
	r := lightRig(t)
	ctx := context.Background()
	rec := Record{ID: "f1", Name: "crsp-light-demo-linux", MachineID: "m1", OS: "linux", Kind: "persistent", Managed: true,
		Route: Route{Queue: QueueLight}, Scope: Scope{Kind: "repository", RepositoryID: 1}, State: Failed, Reason: "x",
		ServiceName: "svc1", GitHubRunnerID: 99, CreatedAt: r.clock}
	if err := r.store.InsertRunner(ctx, rec); err != nil {
		t.Fatal(err)
	}
	r.gh.runners = []github.Runner{{ID: 99, Name: "crsp-light-demo-linux", Status: "offline"}}
	r.gh.delErr = errors.New("github said no")
	res, err := r.svc.EnsureLight(ctx, 1, "demo", []string{"linux"}, "x")
	if err == nil || !strings.Contains(res[0].Why, "could not be cleaned up") || len(r.ag.added) != 0 {
		t.Fatalf("%+v %v", res, err)
	}
	if _, gerr := r.store.GetRunner(ctx, "f1"); gerr != nil {
		t.Fatal("the record stays when the registration is not removed")
	}
	r.gh.delErr = nil
	if _, err := r.svc.EnsureLight(ctx, 1, "demo", []string{"linux"}, "x"); err != nil {
		t.Fatal(err)
	}
	if len(r.gh.deleted) != 1 || r.gh.deleted[0] != 99 || len(r.ag.folders) != 1 || r.ag.folders[0] != "svc1" {
		t.Fatalf("deleted %v folders %v", r.gh.deleted, r.ag.folders)
	}
}

func TestLightNameIsNeverReused(t *testing.T) { // scheduling R5.65
	all := []Record{
		{MachineID: "m1", Name: "other", ServiceName: "actions.runner.luis-mc-demo.crsp-light-demo-windows"},
		{MachineID: "m1", Name: "crsp-light-demo-1-windows"},
	}
	if got := lightName(all, "m1", "demo", "windows", 1); got != "crsp-light-demo-1-windows-2" {
		t.Fatalf("got %s", got)
	}
	if got := lightName(all, "m2", "demo", "windows", 1); got != "crsp-light-demo-windows" {
		t.Fatalf("other machine: %s", got)
	}
}

func TestEnsureLightKeepsNameOfAnOrphanService(t *testing.T) {
	r := lightRig(t)
	r.svc.Services = func(context.Context, string) ([]backend.Found, error) {
		return []backend.Found{{Name: "crsp-light-demo-linux", ServiceName: "actions.runner.luis-mc-demo.crsp-light-demo-linux"}}, nil
	}
	res, err := r.svc.EnsureLight(context.Background(), 1, "demo", []string{"linux"}, "x")
	if err != nil || res[0].Runner != "crsp-light-demo-1-linux" {
		t.Fatalf("%+v %v", res, err)
	}
}

func TestRemoveFailedRunnerCleansUpWithoutDeregistering(t *testing.T) { // UX-6
	r := lightRig(t)
	r.svc.Background = func(f func()) { f() }
	ctx := context.Background()
	rec := Record{ID: "f1", Name: "gameroompc-1", MachineID: "m1", OS: "linux", Kind: "persistent", Managed: true,
		Scope: Scope{Kind: "repository", RepositoryID: 1}, State: Failed, Reason: "service did not start", ServiceName: "svc1", CreatedAt: r.clock}
	if err := r.store.InsertRunner(ctx, rec); err != nil {
		t.Fatal(err)
	}
	_, finish, err := r.svc.BeginRemove(ctx, "f1", true, "x")
	if err != nil {
		t.Fatal(err)
	}
	if err := finish(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := r.store.GetRunner(ctx, "f1"); !errors.Is(err, ErrNotFound) || len(r.ag.removed) != 0 || len(r.ag.folders) != 1 {
		t.Fatalf("%v removed %d folders %v", err, len(r.ag.removed), r.ag.folders)
	}
}
