package tray

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func ids(items []MenuItem) []string {
	var out []string
	for _, it := range items {
		out = append(out, it.ID)
	}
	return out
}

// R5.1: the same menu on every OS, in this order.
func TestMenuOrder(t *testing.T) {
	st := Status{State: StateHealthy, Running: 2, Waiting: 1, Runners: 1, Version: "1.4.0", Update: UpdateInfo{State: "idle"}}
	m := BuildMenu("1.4.0", st, true)
	wantIDs := []string{IDHeader, IDService, IDSep1, IDMode, IDModeAuto, IDModeAlw, IDModePause, IDPauseHour, IDPauseTill, IDResume, IDOpen, IDCheck, IDUpdate, IDRestart, IDLogs, IDGitHub, IDLogin, IDSep2, IDQuit}
	if got := ids(m); strings.Join(got, ",") != strings.Join(wantIDs, ",") {
		t.Fatalf("order %v", got)
	}
	vis := Visible(m)
	want := []string{
		"CI Runners Shared Pool 1.4.0 - up to date",
		"Service: Running · 2 jobs running · 1 waiting",
		"", "Open CI Runners Shared Pool", "Look for updates", "Restart the service",
		"Open log folder", "Open on GitHub", "Start at login", "", "Quit tray",
	}
	if len(vis) != len(want) {
		t.Fatalf("visible %d: %v", len(vis), ids(vis))
	}
	for i, w := range want {
		if vis[i].Label != w {
			t.Errorf("item %d = %q want %q", i, vis[i].Label, w)
		}
	}
	if vis[0].Action || vis[1].Action || !vis[3].Action {
		t.Error("the two top lines are text; Open is the default entry")
	}
	if !vis[8].Switch || !vis[8].Checked || !vis[2].Separator || !vis[9].Separator {
		t.Error("Start at login is a ticked switch; two separators")
	}
}

func TestHeaderPerUpdateState(t *testing.T) {
	ok := func(u UpdateInfo) Status { return Status{State: StateHealthy, Runners: 1, Update: u} }
	cases := []struct {
		name string
		st   Status
		want string
	}{
		{"up to date", ok(UpdateInfo{State: "idle"}), "CI Runners Shared Pool 1.4.0 - up to date"},
		{"available", ok(UpdateInfo{Latest: "1.5.0", Available: true, State: "idle"}), "CI Runners Shared Pool 1.4.0 - update 1.5.0 available"},
		{"draining", ok(UpdateInfo{Latest: "1.5.0", Available: true, State: "waiting_for_jobs"}), "CI Runners Shared Pool 1.4.0 - updating…"},
		{"installing", ok(UpdateInfo{Latest: "1.5.0", Available: true, State: "installing"}), "CI Runners Shared Pool 1.4.0 - updating…"},
		{"auto off, up to date", ok(UpdateInfo{State: "idle", AutoOff: true}), "CI Runners Shared Pool 1.4.0 - up to date · auto-update off"},
		{"auto off, available", ok(UpdateInfo{Latest: "1.5.0", Available: true, AutoOff: true}), "CI Runners Shared Pool 1.4.0 - update 1.5.0 available · auto-update off"},
		{"failed", ok(UpdateInfo{State: "failed"}), "CI Runners Shared Pool 1.4.0 - update failed"},
		{"service stopped: no claim", Status{State: StateStopped}, "CI Runners Shared Pool 1.4.0"},
		{"service starting: no claim", Status{State: StateStarting}, "CI Runners Shared Pool 1.4.0"},
	}
	for _, c := range cases {
		if got := Header("1.4.0", c.st); got != c.want {
			t.Errorf("%s: %q want %q", c.name, got, c.want)
		}
	}
}

func TestServiceLinePerState(t *testing.T) {
	at := time.Date(2026, 11, 14, 14, 30, 0, 0, time.UTC)
	cases := map[string]Status{
		"Service: Running · 2 jobs running · 1 waiting": {State: StateHealthy, Running: 2, Waiting: 1, Runners: 1},
		"Service: Running · 1 job running · 0 waiting":  {State: StateHealthy, Running: 1, Runners: 1},
		"Service: Waiting · 0 jobs running · 4 waiting": {State: StateWaiting, Waiting: 4, Runners: 1},
		"Service: Failed · GitHub not reachable":        {State: StateFailed, Fault: "GitHub not reachable"},
		"Service: Stopped at 14:30 · exit code 3":       {State: StateStopped, StoppedAt: at, ExitCode: 3},
		"Service: Starting":                             {State: StateStarting},
		"Service: Running · no runners yet":             {State: StateHealthy},
	}
	for want, s := range cases {
		if got := s.ServiceLine(); got != want {
			t.Errorf("got %q want %q", got, want)
		}
	}
}

// The Update item shows only when the owner's yes is needed: a newer release and auto-update off (R5.18).
func TestUpdateItemOnlyWhenNewerAndAutoOff(t *testing.T) {
	has := func(st Status) bool {
		for _, it := range Visible(BuildMenu("1.4.0", st, false)) {
			if it.ID == IDUpdate {
				return it.Label == "Update to 1.5.0"
			}
		}
		return false
	}
	base := Status{State: StateHealthy, Runners: 1}
	for name, tc := range map[string]struct {
		u    UpdateInfo
		show bool
	}{
		"newer, auto off":    {UpdateInfo{Latest: "1.5.0", Available: true, AutoOff: true, State: "idle"}, true},
		"newer, auto on":     {UpdateInfo{Latest: "1.5.0", Available: true, State: "idle"}, false},
		"none, auto off":     {UpdateInfo{AutoOff: true, State: "idle"}, false},
		"updating, auto off": {UpdateInfo{Latest: "1.5.0", Available: true, AutoOff: true, State: "waiting_for_jobs"}, false},
	} {
		st := base
		st.Update = tc.u
		if has(st) != tc.show {
			t.Errorf("%s: shown=%v want %v", name, has(st), tc.show)
		}
	}
}

func TestClientCarriesUpdateFieldsAndTarget(t *testing.T) {
	var last string
	c := &Client{Timeout: time.Second, Dial: fakeChannel(func(req string) string {
		last = req
		return `{"ok":true,"state":"ok","running":1,"runners":1,"version":"1.4.0","auto_update":false,"latest_version":"1.5.0","update_available":true,"update_state":"idle"}`
	})}
	st, err := c.Check(context.Background())
	if err != nil || !strings.Contains(last, `"check"`) {
		t.Fatalf("%v %q", err, last)
	}
	if st.Version != "1.4.0" || !st.Update.AutoOff || !st.Update.Available || st.Update.Latest != "1.5.0" {
		t.Fatalf("%+v", st)
	}
	// An older service says nothing about auto-update: it counts as on.
	c = &Client{Timeout: time.Second, Dial: fakeChannel(func(string) string { return `{"ok":true,"state":"ok"}` })}
	if st, _ := c.Status(context.Background()); st.Update.AutoOff {
		t.Fatal("a missing auto_update field must read as on")
	}
	c = &Client{Timeout: time.Second, Dial: fakeChannel(func(req string) string { last = req; return `{"ok":true,"url":"u"}` })}
	if _, err := c.LinkTo(context.Background(), ReviewRestartPath); err != nil || !strings.Contains(last, `"target":"/settings/updates/review?kind=restart"`) {
		t.Fatalf("%v %q", err, last)
	}
}

type fakeTargets struct{ got string }

func (f *fakeTargets) LinkTo(_ context.Context, t string) (string, error) {
	f.got = t
	return "https://x/auth/link?code=1", nil
}

// Restart and Update never ask in the tray: they open the console Review step (R5.15, R5.18).
func TestRestartAndUpdateOpenTheReviewStep(t *testing.T) {
	for _, path := range []string{ReviewRestartPath, ReviewUpdatePath} {
		ft := &fakeTargets{}
		var opened string
		o := &Opener{Targets: ft, Browser: func(u string) error { opened = u; return nil }}
		if err := o.OpenReview(context.Background(), path); err != nil || ft.got != path || opened == "" {
			t.Fatalf("%s: %q %q %v", path, ft.got, opened, err)
		}
	}
	// A stopped service gets the Problem notice, not a dead link.
	called := false
	o := &Opener{Targets: &fakeTargets{}, Browser: func(string) error { called = true; return nil },
		Current: func() Status { return Status{State: StateStopped, ExitCode: 3} }, Notify: func(string, string) {}}
	if err := o.OpenReview(context.Background(), ReviewRestartPath); err == nil || called {
		t.Fatal("must refuse while stopped")
	}
}

type fakeChecker struct {
	st  Status
	err error
}

func (f fakeChecker) Check(context.Context) (Status, error) { return f.st, f.err }

func TestLookForUpdatesSaysTheResult(t *testing.T) {
	run := func(c fakeChecker) (title, body string) {
		o := &Opener{Checker: c, Version: "1.4.0", Notify: func(t, b string) { title, body = t, b }}
		_ = o.LookForUpdates(context.Background())
		return
	}
	if title, _ := run(fakeChecker{st: Status{Update: UpdateInfo{}}}); title != "Up to date" {
		t.Errorf("%q", title)
	}
	if title, _ := run(fakeChecker{err: errors.New("no answer")}); title != "Could not look for updates" {
		t.Errorf("%q", title)
	}
}

// R5.18: after the update the tray comes back on the new version.
func TestTrayRelaunchesWhenServiceIsNewer(t *testing.T) {
	for _, c := range []struct {
		own, svc string
		want     bool
	}{
		{"1.4.0", "1.5.0", true},
		{"1.5.0", "1.5.0", false},
		{"1.5.0", "1.4.0", false}, // a rollback never relaunches
		{"1.4.0", "", false},      // an old service that says no version
		{"dev", "1.5.0", false},   // a developer build stays
	} {
		if got := NeedsRelaunch(c.own, c.svc); got != c.want {
			t.Errorf("%v: %v", c, got)
		}
	}
}

func TestOpenOnGitHubOpensTheRepository(t *testing.T) {
	var opened string
	o := &Opener{Browser: func(u string) error { opened = u; return nil }}
	if err := o.OpenGitHub(); err != nil || opened != "https://github.com/luis-mc/ci-runners-shared-pool" {
		t.Fatalf("%q %v", opened, err)
	}
}
