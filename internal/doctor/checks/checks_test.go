package checks

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

var now = time.Date(2026, 11, 14, 12, 0, 0, 0, time.UTC)

func i64(v int64) *int64 { return &v }

type fleet struct {
	machines []doctor.Machine
	runners  []doctor.Runner
	services map[string][]doctor.OSService
	svcErr   map[string]error
	repos    []doctor.Repository
}

func (f *fleet) Machines(context.Context) ([]doctor.Machine, error)        { return f.machines, nil }
func (f *fleet) Runners(context.Context) ([]doctor.Runner, error)          { return f.runners, nil }
func (f *fleet) Repositories(context.Context) ([]doctor.Repository, error) { return f.repos, nil }
func (f *fleet) Services(_ context.Context, id string) ([]doctor.OSService, error) {
	if err := f.svcErr[id]; err != nil {
		return nil, err
	}
	return f.services[id], nil
}

// gh is a fake GitHub: read-only by construction (doctor.GitHub has no write
// method) and it counts calls so tests can check R6.2.
type gh struct {
	mu        sync.Mutex
	calls     map[string]int
	app       github.App
	inst      map[int64]github.Installation
	instErr   map[int64]error
	runners   map[string][]github.Runner // key owner/repo or org
	runnerErr error
	vars      map[string][]github.Variable
	varsErr   error
	files     map[string][]github.WorkflowFile
}

func newGH() *gh {
	return &gh{calls: map[string]int{}, inst: map[int64]github.Installation{}, instErr: map[int64]error{},
		runners: map[string][]github.Runner{}, vars: map[string][]github.Variable{}, files: map[string][]github.WorkflowFile{}}
}

func (g *gh) count(k string) { g.mu.Lock(); g.calls[k]++; g.mu.Unlock() }

func (g *gh) GetApp(context.Context) (github.App, error) { g.count("app"); return g.app, nil }
func (g *gh) GetInstallation(_ context.Context, id int64) (github.Installation, error) {
	g.count("installation")
	return g.inst[id], g.instErr[id]
}
func (g *gh) ListRunners(_ context.Context, _ int64, sc github.RunnerScope) ([]github.Runner, error) {
	g.count("runners")
	if g.runnerErr != nil {
		return nil, g.runnerErr
	}
	if sc.Organization != "" {
		return g.runners[sc.Organization], nil
	}
	return g.runners[sc.Owner+"/"+sc.Repo], nil
}
func (g *gh) ListVariables(_ context.Context, _ int64, o, r string) ([]github.Variable, error) {
	g.count("variables")
	return g.vars[o+"/"+r], g.varsErr
}
func (g *gh) ListWorkflowFiles(_ context.Context, _ int64, o, r string, _ map[string]string) ([]github.WorkflowFile, error) {
	g.count("workflows")
	return g.files[o+"/"+r], nil
}

func healthyMachine() doctor.Machine {
	return doctor.Machine{ID: "m1", Name: "alpha", OS: "linux", Online: true, LastSeen: now.Add(-5 * time.Second), State: "active",
		Load:            &doctor.Load{MemoryPct: 30, CPUPct: 10, MemoryKnown: true, CPUKnown: true, SampledAt: now.Add(-5 * time.Second)},
		BudgetMemoryPct: 85, BudgetCPUPct: 60,
		DiskFreeBytes: i64(300 * gib), DiskTotalBytes: i64(500 * gib)}
}

// run runs the registered checks whose ID starts with prefix through the real engine.
func run(t *testing.T, env doctor.Env, prefix string) []doctor.Finding {
	t.Helper()
	reg := doctor.NewRegistry()
	Register(reg)
	e := &doctor.Engine{Registry: reg, Store: doctor.NewMemStore(), Now: func() time.Time { return now },
		Env: func(context.Context) (doctor.Env, error) { return env, nil }}
	r, err := e.Run(context.Background(), doctor.Scope{Checks: []string{prefix}}, doctor.TriggerCLI, "test")
	if err != nil {
		t.Fatal(err)
	}
	return r.Findings
}

// forCheck keeps the findings of one check; a prefix scope also takes its sub-checks.
func forCheck(fs []doctor.Finding, check string) []doctor.Finding {
	var out []doctor.Finding
	for _, f := range fs {
		if f.Check == check {
			out = append(out, f)
		}
	}
	return out
}

func only(t *testing.T, fs []doctor.Finding, check string) doctor.Finding {
	t.Helper()
	var got []doctor.Finding
	for _, f := range fs {
		if f.Check == check {
			got = append(got, f)
		}
	}
	if len(got) != 1 {
		t.Fatalf("want one %s finding, got %d: %+v", check, len(got), fs)
	}
	return got[0]
}

func TestEveryRegisteredCheckIsM1AndHasAnID(t *testing.T) {
	reg := doctor.NewRegistry()
	Register(reg)
	if len(reg.All()) != 18 {
		t.Fatalf("checks: %v", reg.SortedIDs())
	}
	for _, c := range reg.All() {
		if c.Milestone() != 1 || c.ID() == "" {
			t.Errorf("%s: milestone %d", c.ID(), c.Milestone())
		}
	}
}

func TestMachineOnline(t *testing.T) {
	off := healthyMachine()
	off.ID, off.Name, off.Online = "m2", "beta", false
	off.LastSeen = now.Add(-10 * time.Minute)
	stale := healthyMachine()
	stale.ID, stale.Name, stale.LastSeen = "m3", "gamma", now.Add(-2*time.Minute) // online flag lags the clock
	never := healthyMachine()
	never.ID, never.Name, never.Online, never.LastSeen = "m4", "delta", false, time.Time{}
	fs := run(t, doctor.Env{Fleet: &fleet{machines: []doctor.Machine{healthyMachine(), off, stale, never}}}, "machine.online")
	sev := map[string]doctor.Severity{}
	for _, f := range fs {
		sev[f.Subject.Name] = f.Severity
	}
	if sev["alpha"] != doctor.OK || sev["beta"] != doctor.Fail || sev["gamma"] != doctor.Fail || sev["delta"] != doctor.Fail {
		t.Fatalf("severities = %v", sev)
	}
	for _, f := range fs {
		if f.Severity == doctor.Fail && (f.Fix.Text == "" || f.Fix.Link == "") {
			t.Errorf("fail without fix: %+v", f)
		}
	}
}

func TestLoadFresh(t *testing.T) {
	old := healthyMachine()
	old.ID, old.Name = "m2", "beta"
	old.Load.SampledAt = now.Add(-2 * time.Minute)
	none := healthyMachine()
	none.ID, none.Name, none.Load = "m3", "gamma", nil
	off := healthyMachine()
	off.ID, off.Name, off.Online = "m4", "delta", false
	fs := run(t, doctor.Env{Fleet: &fleet{machines: []doctor.Machine{healthyMachine(), old, none, off}}}, "machine.load.fresh")
	sev := map[string]doctor.Severity{}
	for _, f := range fs {
		sev[f.Subject.Name] = f.Severity
	}
	if sev["alpha"] != doctor.OK || sev["beta"] != doctor.Fail || sev["gamma"] != doctor.Fail || sev["delta"] != doctor.Skip {
		t.Fatalf("severities = %v", sev)
	}
}

func TestLoadBudget(t *testing.T) {
	over := healthyMachine()
	over.ID, over.Name, over.OverBudgetSince = "m2", "beta", now.Add(-11*time.Minute)
	brief := healthyMachine()
	brief.ID, brief.Name, brief.OverBudgetSince = "m3", "gamma", now.Add(-5*time.Minute)
	fs := run(t, doctor.Env{Fleet: &fleet{machines: []doctor.Machine{healthyMachine(), over, brief}}}, "machine.load.budget")
	sev := map[string]doctor.Severity{}
	for _, f := range fs {
		sev[f.Subject.Name] = f.Severity
	}
	if sev["alpha"] != doctor.OK || sev["beta"] != doctor.Warn || sev["gamma"] != doctor.OK {
		t.Fatalf("severities = %v", sev)
	}
}

func TestDisk(t *testing.T) {
	mk := func(name string, free, total int64) doctor.Machine {
		m := healthyMachine()
		m.ID, m.Name, m.DiskFreeBytes, m.DiskTotalBytes = name, name, i64(free), i64(total)
		return m
	}
	unknown := healthyMachine()
	unknown.ID, unknown.Name, unknown.DiskFreeBytes = "u", "u", nil
	fs := run(t, doctor.Env{Fleet: &fleet{machines: []doctor.Machine{
		mk("fine", 300*gib, 500*gib),
		mk("pctwarn", 70*gib, 500*gib), // 14%
		mk("gbwarn", 9*gib, 100*gib),   // under 10 GB but over 5%... 9%: warn
		mk("pctfail", 20*gib, 500*gib), // 4%
		mk("gbfail", 1*gib, 15*gib),    // 1 GB: fail
		unknown,
	}}}, "machine.disk")
	want := map[string]doctor.Severity{"fine": doctor.OK, "pctwarn": doctor.Warn, "gbwarn": doctor.Warn, "pctfail": doctor.Fail, "gbfail": doctor.Fail, "u": doctor.Skip}
	for _, f := range fs {
		if want[f.Subject.Name] != f.Severity {
			t.Errorf("%s = %s, want %s", f.Subject.Name, f.Severity, want[f.Subject.Name])
		}
		if f.Severity == doctor.Fail && !strings.Contains(f.Fix.Command, "clean-work --machine "+f.Subject.Name) {
			t.Errorf("fix command = %q", f.Fix.Command)
		}
	}
}

func persistent(id, name string) doctor.Runner {
	return doctor.Runner{ID: id, Name: name, MachineID: "m1", MachineName: "alpha", OS: "linux", Kind: "persistent",
		ServiceName: "actions.runner.o-r." + name, InstallationID: 7, GitHubRunnerID: 100,
		Scope: github.RunnerScope{Owner: "o", Repo: "r"}, FolderReadable: true,
		Labels: []string{"self-hosted", "Linux", "X64"}}
}

func TestRunnerService(t *testing.T) {
	rs := []doctor.Runner{persistent("r1", "crsp-ok"), persistent("r2", "crsp-missing"), persistent("r3", "crsp-stopped"), persistent("r4", "crsp-manual")}
	fl := &fleet{machines: []doctor.Machine{healthyMachine()}, runners: rs, services: map[string][]doctor.OSService{"m1": {
		{Name: "actions.runner.o-r.crsp-ok", RunnerName: "crsp-ok", Running: true, Automatic: true, AutomaticKnown: true},
		{Name: "actions.runner.o-r.crsp-stopped", RunnerName: "crsp-stopped", Running: false, Automatic: true, AutomaticKnown: true},
		{Name: "actions.runner.o-r.crsp-manual", RunnerName: "crsp-manual", Running: true, Automatic: false, AutomaticKnown: true},
	}}}
	fs := run(t, doctor.Env{Fleet: fl}, "runner.service")
	want := map[string]doctor.Severity{"crsp-ok": doctor.OK, "crsp-missing": doctor.Fail, "crsp-stopped": doctor.Fail, "crsp-manual": doctor.Fail}
	for _, f := range fs {
		if want[f.Subject.Name] != f.Severity {
			t.Errorf("%s = %s", f.Subject.Name, f.Severity)
		}
	}
	// An unreachable agent is skip, never ok (R5.5).
	fl.svcErr = map[string]error{"m1": doctor.ErrUnreachable}
	for _, f := range run(t, doctor.Env{Fleet: fl}, "runner.service") {
		if f.Severity != doctor.Skip {
			t.Errorf("unreachable agent gave %s", f.Severity)
		}
	}
}

func TestRunnerDetected(t *testing.T) {
	fl := &fleet{machines: []doctor.Machine{healthyMachine()}, runners: []doctor.Runner{persistent("r1", "crsp-a")},
		services: map[string][]doctor.OSService{"m1": {
			{Name: "actions.runner.o-r.crsp-a", RunnerName: "crsp-a", Running: true},
			{Name: "actions.runner.o-r.legacy", RunnerName: "legacy", Scope: "o-r", Running: true},
		}}}
	fs := run(t, doctor.Env{Fleet: fl}, "runner.detected")
	if len(fs) != 1 || fs[0].Severity != doctor.Info || fs[0].Subject.Kind != "runner_service" || !strings.Contains(fs[0].Detail, "legacy") {
		t.Fatalf("got %+v", fs)
	}
	fl.services["m1"] = fl.services["m1"][:1]
	fs = run(t, doctor.Env{Fleet: fl}, "runner.detected")
	if len(fs) != 1 || fs[0].Severity != doctor.OK {
		t.Fatalf("all managed: %+v", fs)
	}
}

func TestRunnerRegistered(t *testing.T) {
	g := newGH()
	g.runners["o/r"] = []github.Runner{
		{ID: 100, Name: "crsp-up", Status: "online"},
		{ID: 101, Name: "crsp-down", Status: "offline"},
	}
	up, down, gone := persistent("r1", "crsp-up"), persistent("r2", "crsp-down"), persistent("r3", "crsp-gone")
	down.GitHubRunnerID, gone.GitHubRunnerID = 101, 999
	up.GitHubRunnerID = 100
	fs := run(t, doctor.Env{GitHub: g, Fleet: &fleet{machines: []doctor.Machine{healthyMachine()}, runners: []doctor.Runner{up, down, gone}}}, "runner.registered")
	want := map[string]doctor.Severity{"crsp-up": doctor.OK, "crsp-down": doctor.Fail, "crsp-gone": doctor.Fail}
	for _, f := range fs {
		if want[f.Subject.Name] != f.Severity {
			t.Errorf("%s = %s", f.Subject.Name, f.Severity)
		}
	}
	if g.calls["runners"] != 1 {
		t.Errorf("runner list read %d times, want once per run", g.calls["runners"])
	}
	// GitHub not connected and GitHub down are both skip.
	fs = run(t, doctor.Env{Fleet: &fleet{machines: []doctor.Machine{healthyMachine()}, runners: []doctor.Runner{up}}}, "runner.registered")
	if len(fs) != 1 || fs[0].Severity != doctor.Skip {
		t.Fatalf("no github: %+v", fs)
	}
	g.runnerErr = github.ErrUnavailable
	fs = run(t, doctor.Env{GitHub: g, Fleet: &fleet{machines: []doctor.Machine{healthyMachine()}, runners: []doctor.Runner{up}}}, "runner.registered")
	if len(fs) != 1 || fs[0].Severity != doctor.Skip {
		t.Fatalf("github down: %+v", fs)
	}
}

func TestRunnerOrphan(t *testing.T) {
	g := newGH()
	g.runners["o/r"] = []github.Runner{
		{ID: 100, Name: "crsp-mine", Status: "online"},
		{ID: 555, Name: "crsp-stray", Status: "offline"},
		{ID: 556, Name: "somebody-elses", Status: "online"},
	}
	fl := &fleet{machines: []doctor.Machine{healthyMachine()}, runners: []doctor.Runner{persistent("r1", "crsp-mine")}}
	fs := run(t, doctor.Env{GitHub: g, Fleet: fl}, "runner.orphan")
	if len(fs) != 1 || fs[0].Severity != doctor.Warn || fs[0].Subject.Name != "crsp-stray" {
		t.Fatalf("got %+v", fs)
	}
	g.runners["o/r"] = g.runners["o/r"][:1]
	fs = run(t, doctor.Env{GitHub: g, Fleet: fl}, "runner.orphan")
	if len(fs) != 1 || fs[0].Severity != doctor.OK {
		t.Fatalf("no strays: %+v", fs)
	}
}

// R5.13: a locked runner folder gives skip with needs_admin and the runner is
// still found by the service checks. Port of test_dl318 locked-runner tests.
func TestRunnerHooksNeedAdmin(t *testing.T) {
	locked, bad, good := persistent("r1", "crsp-locked"), persistent("r2", "crsp-bad"), persistent("r3", "crsp-good")
	locked.FolderReadable = false
	bad.HookProblems = []string{"job-started hook is a .cmd file"}
	fl := &fleet{machines: []doctor.Machine{healthyMachine()}, runners: []doctor.Runner{locked, bad, good},
		services: map[string][]doctor.OSService{"m1": {{Name: locked.ServiceName, RunnerName: "crsp-locked", Running: true, Automatic: true, AutomaticKnown: true}}}}
	fs := run(t, doctor.Env{Fleet: fl}, "runner.hooks")
	got := map[string]doctor.Finding{}
	for _, f := range fs {
		got[f.Subject.Name] = f
	}
	if f := got["crsp-locked"]; f.Severity != doctor.Skip || !f.NeedsAdmin || !strings.Contains(f.Fix.Command, "--local") {
		t.Errorf("locked = %+v", f)
	}
	if got["crsp-bad"].Severity != doctor.Fail || got["crsp-bad"].NeedsAdmin || got["crsp-good"].Severity != doctor.OK {
		t.Errorf("bad=%+v good=%+v", got["crsp-bad"], got["crsp-good"])
	}
	// The locked runner's service is still found: the hook check never says "no runner".
	svc := run(t, doctor.Env{Fleet: fl}, "runner.service")
	for _, f := range svc {
		if f.Subject.Name == "crsp-locked" && f.Severity != doctor.OK {
			t.Errorf("service of locked runner = %+v", f)
		}
	}
}

func TestRunnerLabelsGeneric(t *testing.T) {
	proj := persistent("r1", "crsp-proj")
	proj.Labels = []string{"self-hosted", "Windows", "ARM64", "docker", "crsp-home", "myproject"}
	good := persistent("r2", "crsp-good")
	fs := run(t, doctor.Env{PoolName: "crsp-home", Fleet: &fleet{machines: []doctor.Machine{healthyMachine()}, runners: []doctor.Runner{proj, good}}}, "runner.labels.generic")
	for _, f := range fs {
		switch f.Subject.Name {
		case "crsp-proj":
			if f.Severity != doctor.Warn || !strings.Contains(f.Detail, "myproject") || strings.Contains(f.Detail, "docker") || strings.Contains(f.Detail, "crsp-home") {
				t.Errorf("proj = %+v", f)
			}
		case "crsp-good":
			if f.Severity != doctor.OK {
				t.Errorf("good = %+v", f)
			}
		}
	}
	if !IsGenericLabel("GPU", "") || IsGenericLabel("crsp-home", "") {
		t.Error("IsGenericLabel")
	}
}

func repo(id int64, full string, expected map[string]string) doctor.Repository {
	o, n, _ := strings.Cut(full, "/")
	return doctor.Repository{ID: id, FullName: full, Owner: o, Name: n, InstallationID: 7, DefaultBranch: "main", Expected: expected}
}

func TestAppInstallationAndPermissions(t *testing.T) {
	g := newGH()
	full := map[string]string{"administration": "write", "actions": "read", "actions_variables": "write", "contents": "read", "metadata": "read"}
	g.inst[7] = github.Installation{ID: 7, AccountLogin: "o", AccountType: "User", Permissions: full}
	g.inst[8] = github.Installation{ID: 8, AccountLogin: "susp", Suspended: true, Permissions: full}
	g.instErr[9] = github.ErrNotFound
	g.inst[10] = github.Installation{ID: 10, AccountLogin: "org", AccountType: "Organization",
		Permissions: map[string]string{"administration": "read", "actions": "read", "contents": "read", "metadata": "read"}}
	repos := []doctor.Repository{repo(1, "o/a", nil), repo(2, "susp/b", nil), repo(3, "gone/c", nil), repo(4, "org/d", nil)}
	repos[1].InstallationID, repos[2].InstallationID, repos[3].InstallationID = 8, 9, 10
	env := doctor.Env{GitHub: g, Fleet: &fleet{repos: repos}}

	fs := run(t, env, "github.app.installation")
	sev := map[string]doctor.Severity{}
	for _, f := range fs {
		sev[f.Subject.Name] = f.Severity
	}
	if sev["o"] != doctor.OK || sev["susp"] != doctor.Fail || sev["gone"] != doctor.Fail || sev["org"] != doctor.OK {
		t.Fatalf("installation severities = %v", sev)
	}
	fs = run(t, env, "github.app.permissions")
	sev = map[string]doctor.Severity{}
	detail := ""
	for _, f := range fs {
		sev[f.Subject.Name] = f.Severity
		if f.Subject.Name == "org" {
			detail = f.Detail
		}
	}
	if sev["o"] != doctor.OK || sev["susp"] != doctor.OK || sev["gone"] != doctor.Skip || sev["org"] != doctor.Fail {
		t.Fatalf("permission severities = %v", sev)
	}
	for _, p := range []string{"administration (needs write, has read)", "actions_variables (needs write, has none)", "organization_self_hosted_runners"} {
		if !strings.Contains(detail, p) {
			t.Errorf("detail lacks %q: %s", p, detail)
		}
	}
}

func TestAppRateLimitIsSkipWithResetTime(t *testing.T) {
	g := newGH()
	g.instErr[7] = &github.RateLimitError{ResetAt: now.Add(20 * time.Minute)}
	fs := run(t, doctor.Env{GitHub: g, Fleet: &fleet{repos: []doctor.Repository{repo(1, "o/a", nil)}}}, "github.app.installation")
	if len(fs) != 1 || fs[0].Severity != doctor.Skip || !strings.Contains(fs[0].Detail, "2026-11-14 12:20") {
		t.Fatalf("got %+v", fs)
	}
}

func TestRepoVars(t *testing.T) {
	g := newGH()
	exp := map[string]string{
		"CRSP_RUNS_ON_LINUX":   `["self-hosted","linux","crsp-home"]`,
		"CRSP_RUNS_ON_WINDOWS": `["self-hosted","windows","crsp-home"]`,
		"CRSP_RUNS_ON_MACOS":   `["self-hosted","macos","crsp-home"]`,
	}
	g.vars["o/r"] = []github.Variable{
		{Name: "CRSP_RUNS_ON_LINUX", Value: `["crsp-home","Linux","self-hosted"]`}, // same set, other order and case: fine
		{Name: "CRSP_RUNS_ON_WINDOWS", Value: `not json`},
	} // MACOS unset
	g.files["o/r"] = []github.WorkflowFile{{Path: ".github/workflows/ci.yml", Content: []byte("jobs:\n  a:\n    runs-on: ${{ fromJSON(vars.CRSP_RUNS_ON_MACOS) }}\n")}}
	fs := run(t, doctor.Env{GitHub: g, Fleet: &fleet{repos: []doctor.Repository{repo(1, "o/r", exp)}}}, "repo.vars")
	fs = forCheck(fs, "repo.vars")
	sev := map[string]doctor.Severity{}
	for _, f := range fs {
		sev[f.Subject.ID] = f.Severity
	}
	if sev["1:CRSP_RUNS_ON_LINUX"] != doctor.OK || sev["1:CRSP_RUNS_ON_WINDOWS"] != doctor.Fail || sev["1:CRSP_RUNS_ON_MACOS"] != doctor.Fail {
		t.Fatalf("severities = %v", sev)
	}
	// Different from the product's value is warn; unset and unused is warn.
	g2 := newGH()
	g2.vars["o/r"] = []github.Variable{{Name: "CRSP_RUNS_ON_LINUX", Value: `["self-hosted","linux"]`}}
	fs = run(t, doctor.Env{GitHub: g2, Fleet: &fleet{repos: []doctor.Repository{repo(1, "o/r", map[string]string{
		"CRSP_RUNS_ON_LINUX": exp["CRSP_RUNS_ON_LINUX"], "CRSP_RUNS_ON_MACOS": exp["CRSP_RUNS_ON_MACOS"]})}}}, "repo.vars")
	fs = forCheck(fs, "repo.vars")
	for _, f := range fs {
		if f.Severity != doctor.Warn || f.Fix.Command == "" || !strings.Contains(f.Fix.Command, "gh variable set") {
			t.Errorf("want warn with command: %+v", f)
		}
	}
}

func TestRepoVarsRunner(t *testing.T) {
	g := newGH()
	g.vars["o/r"] = []github.Variable{
		{Name: "CRSP_RUNS_ON_LINUX", Value: `["self-hosted","linux"]`},
		{Name: "CRSP_RUNS_ON_WINDOWS", Value: `["self-hosted","windows"]`},
	}
	g.runners["o/r"] = []github.Runner{
		{Name: "a", Status: "online", Labels: []string{"self-hosted", "Linux", "X64"}},
		{Name: "b", Status: "offline", Labels: []string{"self-hosted", "Windows", "X64"}}, // offline does not count
	}
	fs := run(t, doctor.Env{GitHub: g, Fleet: &fleet{repos: []doctor.Repository{repo(1, "o/r", nil)}}}, "repo.vars.runner")
	sev := map[string]doctor.Severity{}
	for _, f := range fs {
		sev[f.Subject.ID] = f.Severity
	}
	if sev["1:CRSP_RUNS_ON_LINUX"] != doctor.OK || sev["1:CRSP_RUNS_ON_WINDOWS"] != doctor.Fail {
		t.Fatalf("severities = %v", sev)
	}
}

const ci = `name: ci
on: push
jobs:
  hosted:
    runs-on: ubuntu-latest
  literal:
    runs-on: [self-hosted, linux, arm64]
  viavar:
    runs-on: ${{ fromJSON(vars.CRSP_RUNS_ON_LINUX) }}
  matrix:
    runs-on: ${{ matrix.os }}
  unsetvar:
    runs-on: ${{ fromJSON(vars.CRSP_RUNS_ON_WINDOWS) }}
`

func workflowEnv() (doctor.Env, *gh) {
	g := newGH()
	g.vars["o/r"] = []github.Variable{{Name: "CRSP_RUNS_ON_LINUX", Value: `["self-hosted","linux"]`}}
	g.runners["o/r"] = []github.Runner{
		{Name: "a", Status: "online", Labels: []string{"self-hosted", "Linux", "X64"}},
		{Name: "off", Status: "offline", Labels: []string{"self-hosted", "Linux", "ARM64"}},
	}
	g.files["o/r"] = []github.WorkflowFile{
		{Path: ".github/workflows/ci.yml", Content: []byte(ci)},
		{Path: ".github/workflows/notes.md", Content: []byte("# not a workflow")},
		{Path: ".github/workflows/broken.yml", Content: []byte("jobs: [unclosed")},
	}
	return doctor.Env{GitHub: g, Fleet: &fleet{repos: []doctor.Repository{repo(1, "o/r", nil)}}}, g
}

func TestWorkflowLabels(t *testing.T) {
	env, _ := workflowEnv()
	f := only(t, run(t, env, "workflow.labels"), "workflow.labels")
	if f.Severity != doctor.Fail {
		t.Fatalf("got %+v", f)
	}
	// File and line of the job nobody can run; the offline arm64 runner does not count; hosted and variable jobs are fine.
	if !strings.Contains(f.Detail, ".github/workflows/ci.yml:7 (job literal) needs [self-hosted, linux, arm64]") {
		t.Errorf("detail = %q", f.Detail)
	}
	if strings.Contains(f.Detail, "viavar") || strings.Contains(f.Detail, "hosted needs") {
		t.Errorf("detail names jobs that are fine: %q", f.Detail)
	}
	// With a runner for arm64 online it passes.
	g := env.GitHub.(*gh)
	g.runners["o/r"][1].Status = "online"
	f = only(t, run(t, env, "workflow.labels"), "workflow.labels")
	if f.Severity != doctor.OK {
		t.Fatalf("after fix: %+v", f)
	}
}

func TestWorkflowGeneric(t *testing.T) {
	env, _ := workflowEnv()
	f := only(t, run(t, env, "workflow.generic"), "workflow.generic")
	if f.Severity != doctor.Warn || !strings.Contains(f.Detail, "literal") || strings.Contains(f.Detail, "viavar") || !strings.Contains(f.Fix.Text, "fromJSON(vars.CRSP_RUNS_ON") {
		t.Fatalf("got %+v", f)
	}
}

func TestWorkflowUnresolved(t *testing.T) {
	env, _ := workflowEnv()
	f := only(t, run(t, env, "workflow.unresolved"), "workflow.unresolved")
	if f.Severity != doctor.Info {
		t.Fatalf("got %+v", f)
	}
	for _, want := range []string{"matrix.os", "CRSP_RUNS_ON_WINDOWS, which is not set", "broken.yml is not valid YAML"} {
		if !strings.Contains(f.Detail, want) {
			t.Errorf("detail lacks %q:\n%s", want, f.Detail)
		}
	}
}

func TestUnlistableRunnersSkip(t *testing.T) {
	env, g := workflowEnv()
	g.runnerErr = github.ErrUnavailable
	fs := run(t, env, "workflow.labels")
	if len(fs) != 1 || fs[0].Severity != doctor.Skip {
		t.Fatalf("got %+v", fs)
	}
}

// R6.2: a full run makes at most 3 REST calls per repository plus 2 per
// installation (installation read once, no extra per check).
func TestCallCountBudget(t *testing.T) {
	env, g := workflowEnv()
	g.inst[7] = github.Installation{ID: 7, AccountLogin: "o", AccountType: "User", Permissions: RequiredPermissions}
	f := env.Fleet.(*fleet)
	f.repos[0].Expected = map[string]string{"CRSP_RUNS_ON_LINUX": `["self-hosted","linux"]`}
	reg := doctor.NewRegistry()
	Register(reg)
	e := &doctor.Engine{Registry: reg, Store: doctor.NewMemStore(), Now: func() time.Time { return now },
		Env: func(context.Context) (doctor.Env, error) { return env, nil }}
	if _, err := e.Run(context.Background(), doctor.Scope{}, doctor.TriggerSchedule, "system"); err != nil {
		t.Fatal(err)
	}
	total := 0
	for _, n := range g.calls {
		total += n
	}
	if g.calls["variables"] != 1 || g.calls["workflows"] != 1 || g.calls["runners"] != 1 || g.calls["installation"] != 1 || total > 3+2 {
		t.Fatalf("calls = %v", g.calls)
	}
}

func TestMachineScopeAppliesToMachineChecks(t *testing.T) {
	a, b := healthyMachine(), healthyMachine()
	b.ID, b.Name, b.Online = "m2", "beta", false
	reg := doctor.NewRegistry()
	Register(reg)
	env := doctor.Env{Fleet: &fleet{machines: []doctor.Machine{a, b}}}
	e := &doctor.Engine{Registry: reg, Store: doctor.NewMemStore(), Now: func() time.Time { return now },
		Env: func(context.Context) (doctor.Env, error) { return env, nil }}
	r, _ := e.Run(context.Background(), doctor.Scope{Machines: []string{"BETA"}, Checks: []string{"machine.online"}}, doctor.TriggerCLI, "")
	if len(r.Findings) != 1 || r.Findings[0].Subject.Name != "beta" {
		t.Fatalf("got %+v", r.Findings)
	}
}

func TestSkipForUnknownErrorKeepsTheReason(t *testing.T) {
	f := skipFor("x.y", controllerSubject, "Thing", errors.New("weird"))
	if f.Severity != doctor.Skip || !strings.Contains(f.Detail, "weird") {
		t.Fatalf("got %+v", f)
	}
}

// R5.29: the doctor reports what the real hook did when run as the service account.
func TestRunnerHookRun(t *testing.T) {
	mk := func(name string, p *doctor.HookProbe) doctor.Runner {
		r := persistent("id-"+name, name)
		r.HookProbe = p
		return r
	}
	rs := []doctor.Runner{
		mk("crsp-ok", &doctor.HookProbe{Output: "crsp hook ok\n"}),
		mk("crsp-missing", &doctor.HookProbe{Output: "::warning title=crsp::crsp is not installed at /usr/local/bin/crsp, so this job ran without the queue and the load gate.\n"}),
		mk("crsp-exit", &doctor.HookProbe{ExitCode: 2, Output: "boom"}),
		mk("crsp-nostart", &doctor.HookProbe{Err: "powershell.exe: access denied"}),
		mk("crsp-silent", &doctor.HookProbe{Output: ""}),
		mk("crsp-unrun", nil),
	}
	fl := &fleet{machines: []doctor.Machine{healthyMachine()}, runners: rs}
	got := map[string]doctor.Finding{}
	for _, f := range forCheck(run(t, doctor.Env{Fleet: fl}, "runner.hookrun"), "runner.hookrun") {
		got[f.Subject.Name] = f
	}
	want := map[string]doctor.Severity{"crsp-ok": doctor.OK, "crsp-missing": doctor.Fail, "crsp-exit": doctor.Fail,
		"crsp-nostart": doctor.Fail, "crsp-silent": doctor.Fail, "crsp-unrun": doctor.Skip}
	for name, sev := range want {
		if got[name].Severity != sev {
			t.Errorf("%s = %+v, want %s", name, got[name], sev)
		}
		if sev != doctor.OK && got[name].Fix.Text == "" {
			t.Errorf("%s has no fix", name)
		}
	}
	if d := got["crsp-missing"].Detail; !strings.Contains(d, "crsp is not installed") {
		t.Errorf("detail does not carry the annotation: %q", d)
	}
}
