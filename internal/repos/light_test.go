package repos

import (
	"context"
	"strings"
	"sync"
	"testing"
)

// fakeLight records what the repos service asks of the light runners.
type fakeLight struct {
	mu      sync.Mutex
	placed  int
	notes   []string
	ensured [][]string
	removed []int64
}

func (f *fakeLight) EnsureLight(_ context.Context, _ Repository, oses []string, _ string) (int, []string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.ensured = append(f.ensured, oses)
	return f.placed, f.notes, nil
}

func (f *fakeLight) RemoveLight(_ context.Context, r Repository, _ string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.removed = append(f.removed, r.ID)
	return nil
}

func lightEnv(t *testing.T, light *fakeLight) *env {
	t.Helper()
	e := newEnv(t)
	e.svc.cfg.Light = light
	e.world()
	return e
}

func TestLightRunnerWrittenOnTurnOn(t *testing.T) { // scheduling R5.65
	l := &fakeLight{placed: 1}
	e := lightEnv(t, l)
	e.turnOn(101)
	if len(l.ensured) != 1 || strings.Join(l.ensured[0], ",") != "linux" {
		t.Fatalf("ensured %v", l.ensured)
	}
	if got := varNames(e, "alice/secret"); got != "RUNS_ON_LIGHT,RUNS_ON_LINUX" {
		t.Fatalf("variables %s", got)
	}
	mv, _ := e.store.ListManagedVariables(context.Background(), 101)
	for _, v := range mv {
		if v.Name == VarLight && v.Value != LightValue {
			t.Fatalf("value %q", v.Value)
		}
	}
}

func TestLightVariableWaitsForARunner(t *testing.T) { // R5.65: never a variable without a runner
	l := &fakeLight{placed: 0, notes: []string{"linux: no online Linux machine has a light slot"}}
	e := lightEnv(t, l)
	e.turnOn(101)
	if got := varNames(e, "alice/secret"); got != "RUNS_ON_LINUX" {
		t.Fatalf("variables %s", got)
	}
	if !e.audit.has("light.unplaced") {
		t.Fatal("the reason is audited")
	}
	// A machine gains a light slot; the next check places it and writes the variable.
	l.placed, l.notes = 1, nil
	if err := e.svc.ReconcileVariables(context.Background(), 101); err != nil {
		t.Fatal(err)
	}
	if got := varNames(e, "alice/secret"); got != "RUNS_ON_LIGHT,RUNS_ON_LINUX" {
		t.Fatalf("variables %s", got)
	}
}

func TestLightRunnerSettingOff(t *testing.T) { // R5.65
	l := &fakeLight{placed: 1}
	e := lightEnv(t, l)
	e.turnOn(101)
	off := false
	if _, err := e.svc.UpdatePolicy(context.Background(), adminP, 101, PolicyUpdate{LightRunner: &off}); err != nil {
		t.Fatal(err)
	}
	if len(l.removed) != 1 || l.removed[0] != 101 {
		t.Fatalf("removed %v", l.removed)
	}
	if got := varNames(e, "alice/secret"); got != "RUNS_ON_LINUX" {
		t.Fatalf("variables %s", got)
	}
	pol, _ := e.svc.policyOrDefault(context.Background(), 101)
	if pol.LightRunner {
		t.Fatal("setting not saved")
	}
	// Reconcile does not bring it back.
	if err := e.svc.ReconcileVariables(context.Background(), 101); err != nil {
		t.Fatal(err)
	}
	if got := varNames(e, "alice/secret"); got != "RUNS_ON_LINUX" {
		t.Fatalf("variables %s", got)
	}
}

func TestLightRunnerDefaultOnAndRemovedWithPool(t *testing.T) { // R5.65
	if !DefaultPolicy().LightRunner {
		t.Fatal("default is on")
	}
	l := &fakeLight{placed: 1}
	e := lightEnv(t, l)
	e.turnOn(101)
	plan, err := e.svc.PlanChanges(context.Background(), adminP, []Change{{RepositoryID: 101, Pool: false}})
	if err != nil {
		t.Fatal(err)
	}
	var yes []string
	for _, st := range plan.Steps {
		if st.NeedsYes {
			yes = append(yes, st.ID)
		}
	}
	if _, err := e.svc.ApplyPlan(context.Background(), adminP, plan.ID, yes); err != nil {
		t.Fatal(err)
	}
	if len(l.removed) != 1 {
		t.Fatalf("removed %v", l.removed)
	}
	if got := varNames(e, "alice/secret"); got != "" {
		t.Fatalf("variables %s", got)
	}
}
