package container

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys/sysfake"
)

// TestPrefixPerRunnerAndTmpdirUnset: runners R5.42.
func TestPrefixPerRunnerAndTmpdirUnset(t *testing.T) {
	a, b := RunnerWinePrefix("/srv/runners/r1"), RunnerWinePrefix(`C:\runners\r2`)
	if a == b || !strings.HasPrefix(a, "/srv/runners/r1/") || !strings.HasPrefix(b, "C:/runners/r2/") {
		t.Errorf("prefixes %q %q", a, b)
	}
	env := WineEnv(a)
	if env["WINEPREFIX"] != a || env["POOL_WINE_PREFIX"] != a {
		t.Errorf("env %v", env)
	}
	if _, ok := env["TMPDIR"]; ok {
		t.Error("TMPDIR in the Wine environment")
	}
	if got := UnsetWineEnv(); len(got) != 1 || got[0] != "TMPDIR" {
		t.Errorf("unset %v", got)
	}
	fs, cmd := sysfake.NewFS(), &sysfake.Commands{}
	PrepareWinePrefix(context.Background(), cmd, fs, a, "runner")
	for _, c := range cmd.Calls {
		if _, ok := c.Env["TMPDIR"]; ok {
			t.Error("TMPDIR passed to a Wine tool")
		}
		if !strings.Contains(strings.Join(c.Args, " "), "env -u TMPDIR") {
			t.Errorf("call does not unset TMPDIR: %s", c)
		}
	}
}

// TestPrefixOnceAndKept: runners R5.52.
func TestPrefixOnceAndKept(t *testing.T) {
	fs, cmd := sysfake.NewFS(), &sysfake.Commands{}
	prefix := "/cache/lane/wine"
	r := PrepareWinePrefix(context.Background(), cmd, fs, prefix, "runner")
	if !r.Made || r.Skipped || r.Problem != "" {
		t.Fatalf("first: %+v", r)
	}
	texts := cmd.Texts()
	if len(texts) != 2 || !strings.Contains(texts[0], "xvfb-run -a wineboot --init") || !strings.Contains(texts[1], "wineserver -w") {
		t.Fatalf("calls %v", texts)
	}
	if !strings.HasPrefix(texts[0], "runuser -u runner") {
		t.Errorf("not run as the job user: %s", texts[0])
	}
	if cmd.Calls[0].Env["WINEDEBUG"] != "-all" || cmd.Calls[0].Env["WINEPREFIX"] != prefix || cmd.Calls[0].Env["POOL_WINE_PREFIX"] != prefix {
		t.Errorf("env %v", cmd.Calls[0].Env)
	}

	// A prefix with system.reg is skipped: no call.
	_ = fs.WriteFile(prefix+"/system.reg", []byte("x"), 0o644)
	cmd.Calls = nil
	r = PrepareWinePrefix(context.Background(), cmd, fs, prefix, "runner")
	if !r.Skipped || len(cmd.Calls) != 0 {
		t.Errorf("second: %+v calls %v", r, cmd.Texts())
	}
}

// A failure is a Problem, never an error that stops the job.
func TestPrefixFailureNeverStopsTheJob(t *testing.T) {
	for name, cmd := range map[string]*sysfake.Commands{
		"exit code": {Rules: []sysfake.Rule{{Match: "wineboot", Result: sys.Result{ExitCode: 1}}}},
		"error":     {Rules: []sysfake.Rule{{Match: "wineboot", Err: errors.New("timed out")}}},
		"server":    {Rules: []sysfake.Rule{{Match: "wineserver", Result: sys.Result{ExitCode: 2}}}},
	} {
		r := PrepareWinePrefix(context.Background(), cmd, sysfake.NewFS(), "/p", "runner")
		if r.Made || r.Problem == "" {
			t.Errorf("%s: %+v", name, r)
		}
	}
	if WinePrefixTimeout.Seconds() != 180 {
		t.Errorf("timeout %s", WinePrefixTimeout)
	}
}
