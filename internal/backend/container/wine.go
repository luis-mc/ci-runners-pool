package container

import (
	"context"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
)

// WinePrefixTimeout is how long `wineboot --init` may run (runners R5.52).
const WinePrefixTimeout = 180 * time.Second

// RunnerWinePrefix is the Wine prefix of one runner: inside the runner's own
// folder, so two runners never share one and removing the runner removes it
// (runners R5.42).
func RunnerWinePrefix(runnerFolder string) string {
	return path.Join(strings.ReplaceAll(runnerFolder, "\\", "/"), "wine-prefix")
}

// WineEnv is what a job gets for Wine: WINEPREFIX and the old name
// POOL_WINE_PREFIX with the same path (R5.52). TMPDIR is never in it, and
// UnsetWineEnv lists what the job environment must drop (R5.42).
func WineEnv(prefix string) map[string]string {
	return map[string]string{"WINEPREFIX": prefix, "POOL_WINE_PREFIX": prefix}
}

// UnsetWineEnv lists the variables removed from the environment of every Wine
// tool: a set TMPDIR breaks Wine's start.
func UnsetWineEnv() []string { return []string{"TMPDIR"} }

// WinePrefixResult says what PrepareWinePrefix did.
type WinePrefixResult struct {
	Skipped bool   // the prefix already held system.reg
	Made    bool   // wineboot ran and finished
	Problem string // why it did not finish; the job starts anyway
}

// PrepareWinePrefix makes the prefix once (runners R5.52): `wineboot --init`
// under `xvfb-run -a` as the job user with WINEDEBUG=-all and a 180 second
// bound, then `wineserver -w`. A prefix that holds system.reg is skipped. A
// failure is returned as Problem and never as an error: the job starts anyway.
// TMPDIR is unset with `env -u`, so a TMPDIR of the agent never reaches Wine.
func PrepareWinePrefix(ctx context.Context, cmd sys.Commands, fs sys.FS, prefix, jobUser string) WinePrefixResult {
	if fs.Exists(path.Join(prefix, "system.reg")) {
		return WinePrefixResult{Skipped: true}
	}
	if err := fs.MkdirAll(prefix, 0o755); err != nil {
		return WinePrefixResult{Problem: "cannot make " + prefix + ": " + err.Error()}
	}
	env := map[string]string{"WINEPREFIX": prefix, "POOL_WINE_PREFIX": prefix, "WINEDEBUG": "-all"}
	run := func(c context.Context, args ...string) (sys.Result, error) {
		full := append([]string{"-u", jobUser, "env", "-u", "TMPDIR"}, args...)
		return cmd.Run(c, sys.Command{Name: "runuser", Args: full, Env: env})
	}
	bctx, cancel := context.WithTimeout(ctx, WinePrefixTimeout)
	defer cancel()
	res, err := run(bctx, "xvfb-run", "-a", "wineboot", "--init")
	if err != nil {
		return WinePrefixResult{Problem: "wineboot did not finish: " + err.Error()}
	}
	if res.ExitCode != 0 {
		return WinePrefixResult{Problem: "wineboot exited " + strconv.Itoa(res.ExitCode)}
	}
	// wineserver -w waits for the prefix to settle; it has the same bound.
	if res, err = run(bctx, "wineserver", "-w"); err != nil || res.ExitCode != 0 {
		return WinePrefixResult{Problem: "wineserver -w did not finish cleanly"}
	}
	return WinePrefixResult{Made: true}
}
