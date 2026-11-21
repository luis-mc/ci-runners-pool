package checks

import (
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

func toolRunner(id, machine string, scope github.RunnerScope, labels []string, found ...string) doctor.Runner {
	p := &doctor.ToolsProbe{}
	for _, n := range []string{"git", "cargo", "node"} {
		t := doctor.ToolProbe{Name: n}
		for _, f := range found {
			if f == n {
				t.Found, t.Version = true, n+" 1.0"
			}
		}
		p.Tools = append(p.Tools, t)
	}
	return doctor.Runner{ID: id, Name: id, MachineID: machine, Kind: "persistent", Scope: scope, Labels: labels, Tools: p}
}

func twoMachines() []doctor.Machine {
	a, b := healthyMachine(), healthyMachine()
	b.ID, b.Name = "m2", "beta"
	return []doctor.Machine{a, b}
}

var (
	appRepo = github.RunnerScope{Owner: "luis-mc", Repo: "app"}
	winLbl  = []string{"self-hosted", "Windows", "X64"}
)

// OPS57 R5.61: a tool on one runner of a group and not on another warns, naming the runner and the tool.
func TestRunnerToolsSameWarnsForMissingTool(t *testing.T) {
	gone := toolRunner("r2", "m2", appRepo, []string{"x64", "windows", "self-hosted"}, "git", "node")
	env := doctor.Env{Now: now, Fleet: &fleet{machines: twoMachines(), runners: []doctor.Runner{
		toolRunner("r1", "m1", appRepo, winLbl, "git", "cargo", "node"), gone,
		// other repository, a different label set and an ephemeral runner are never compared
		toolRunner("r3", "m1", github.RunnerScope{Owner: "luis-mc", Repo: "other"}, winLbl, "git"),
		toolRunner("r4", "m2", appRepo, []string{"self-hosted", "linux"}),
		{ID: "e1", Name: "e1", MachineID: "m1", Kind: "ephemeral", Scope: appRepo, Labels: winLbl},
	}}}
	fs := forCheck(run(t, env, "runner.tools.same"), "runner.tools.same")
	if len(fs) != 1 {
		t.Fatalf("%d findings, want 1: %+v", len(fs), fs)
	}
	f := fs[0]
	if f.Severity != doctor.Warn || f.Subject.Name != "r2" || !strings.Contains(f.Title, "cargo") || !strings.Contains(f.Title, "luis-mc/app") ||
		!strings.Contains(f.Fix.Text, "image profile") || f.Fix.Link == "" {
		t.Fatalf("finding = %+v", f)
	}
}

func TestRunnerToolsSameOKWhenEqual(t *testing.T) {
	env := doctor.Env{Now: now, Fleet: &fleet{machines: twoMachines(), runners: []doctor.Runner{
		toolRunner("r1", "m1", appRepo, winLbl, "git"), toolRunner("r2", "m2", appRepo, winLbl, "git"),
	}}}
	fs := forCheck(run(t, env, "runner.tools.same"), "runner.tools.same")
	if len(fs) != 1 || fs[0].Severity != doctor.OK {
		t.Fatalf("findings = %+v", fs)
	}
}

// A probe that cannot run, or a machine that is offline, makes the check skip, never fail.
func TestRunnerToolsSameSkipsWithoutProbe(t *testing.T) {
	r1 := toolRunner("r1", "m1", appRepo, winLbl, "git")
	r2 := toolRunner("r2", "m2", appRepo, winLbl)
	r2.Tools = nil
	r3 := toolRunner("r3", "m1", appRepo, winLbl)
	r3.Tools = &doctor.ToolsProbe{Err: "the runner's PATH could not be read"}
	env := doctor.Env{Now: now, Fleet: &fleet{machines: twoMachines(), runners: []doctor.Runner{r1, r2, r3}}}
	fs := forCheck(run(t, env, "runner.tools.same"), "runner.tools.same")
	if len(fs) != 1 || fs[0].Severity != doctor.Skip || !strings.Contains(fs[0].Detail, "PATH could not be read") {
		t.Fatalf("findings = %+v", fs)
	}
}

func TestRunnerToolsSameNeedsTwoRunners(t *testing.T) {
	env := doctor.Env{Now: now, Fleet: &fleet{machines: twoMachines(), runners: []doctor.Runner{toolRunner("r1", "m1", appRepo, winLbl, "git")}}}
	if fs := forCheck(run(t, env, "runner.tools.same"), "runner.tools.same"); len(fs) != 0 {
		t.Fatalf("findings = %+v", fs)
	}
}
