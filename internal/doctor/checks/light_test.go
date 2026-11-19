package checks

import (
	"context"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

func lightRepo() doctor.Repository {
	r := repo(1, "o/r", map[string]string{"RUNS_ON_LINUX": `["self-hosted","linux"]`})
	r.LightRunner = true
	return r
}

func lightFindings(t *testing.T, g *gh, f *fleet) doctor.Finding {
	t.Helper()
	fs := run(t, doctor.Env{GitHub: g, Fleet: f}, "repo.light")
	if len(fs) != 1 {
		t.Fatalf("findings %+v", fs)
	}
	return fs[0]
}

func TestRepoLight(t *testing.T) { // scheduling R5.65
	// Online: ok.
	g := newGH()
	g.runners["o/r"] = []github.Runner{{Name: "crsp-light-r-linux", Status: "online", Labels: []string{"self-hosted", "Linux", "X64", "crsp-light"}}}
	f := &fleet{repos: []doctor.Repository{lightRepo()}}
	if got := lightFindings(t, g, f); got.Severity != doctor.OK {
		t.Fatalf("online: %+v", got)
	}

	// Registered but offline: warn, names the runner.
	g = newGH()
	g.runners["o/r"] = []github.Runner{{Name: "crsp-light-r-linux", Status: "offline", Labels: []string{"self-hosted", "Linux", "crsp-light"}}}
	f = &fleet{repos: []doctor.Repository{lightRepo()}, runners: []doctor.Runner{{Name: "crsp-light-r-linux", MachineName: "box", OS: "linux",
		Labels: []string{"self-hosted", "linux", "crsp-light"}, Scope: github.RunnerScope{Owner: "o", Repo: "r"}}}}
	if got := lightFindings(t, g, f); got.Severity != doctor.Warn || !strings.Contains(got.Detail, "crsp-light-r-linux on box") {
		t.Fatalf("offline: %+v", got)
	}

	// No runner, no machine with a light slot: says so.
	g = newGH()
	f = &fleet{repos: []doctor.Repository{lightRepo()}, machines: []doctor.Machine{{ID: "m1", Name: "box", OS: "linux", Online: true, State: "active", LightSlots: 0}}}
	if got := lightFindings(t, g, f); got.Severity != doctor.Warn || !strings.Contains(got.Detail, "light slot") || !strings.Contains(got.Detail, "nowhere") {
		t.Fatalf("no slot: %+v", got)
	}

	// No runner yet, a machine has a slot: will be placed.
	f.machines[0].LightSlots = 1
	if got := lightFindings(t, g, f); got.Severity != doctor.Warn || !strings.Contains(got.Detail, "adds one") {
		t.Fatalf("placeable: %+v", got)
	}

	// Setting off: no finding.
	r := lightRepo()
	r.LightRunner = false
	if fs := run(t, doctor.Env{GitHub: g, Fleet: &fleet{repos: []doctor.Repository{r}}}, "repo.light"); len(fs) != 0 {
		t.Fatalf("off: %+v", fs)
	}
}

type stoppedFleet struct {
	*fleet
	stops []doctor.LightStop
}

func (s stoppedFleet) LightStops(context.Context) ([]doctor.LightStop, error) { return s.stops, nil }

func TestRepoLightSaysWhyTheLoopStopped(t *testing.T) { // scheduling R5.65
	f := stoppedFleet{fleet: &fleet{repos: []doctor.Repository{lightRepo()}},
		stops: []doctor.LightStop{{RepoID: 1, OS: "linux", Tries: 5, Reason: "the docker command is installed but the engine does not answer"}}}
	fs := run(t, doctor.Env{GitHub: newGH(), Fleet: f}, "repo.light")
	if len(fs) != 1 || fs[0].Severity != doctor.Warn || !strings.Contains(fs[0].Detail, "failed 5 times") || !strings.Contains(fs[0].Detail, "engine does not answer") {
		t.Fatalf("%+v", fs)
	}
}
