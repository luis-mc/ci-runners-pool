package runnercache

import (
	"path/filepath"
	"strconv"
)

// Names of the values a runner exports to its jobs.
const (
	EnvToolsDir  = "CI_TOOLS_DIR"
	EnvToolQuota = "CI_TOOLS_QUOTA_GIB"
	EnvRustCap   = "CRSP_RUST_CACHE_CAP_GIB"
	EnvRustDir   = "CARGO_TARGET_DIR"
)

// Dirs are the cache folders of one runner, all under its own folder, so one
// runner never fills another's quota.
type Dirs struct{ Tools, Rust string }

// DirsFor gives the cache folders of the runner whose folder is runnerFolder.
func DirsFor(runnerFolder string) Dirs { return DirsJoin(runnerFolder, filepath.Join) }

// DirsJoin is DirsFor with the path join of the runner's OS, for a Windows
// runner folder planned on another OS.
func DirsJoin(runnerFolder string, join func(...string) string) Dirs {
	c := join(runnerFolder, "cache")
	return Dirs{Tools: join(c, "tools"), Rust: join(c, "rust-target")}
}

// Env is what a persistent runner's .env gets for its caches: CI_TOOLS_DIR (the
// per-runner tool cache folder), CARGO_TARGET_DIR (the Rust build cache folder
// the cap applies to) and the declared quotas.
func Env(runnerFolder string, q Quota) map[string]string {
	return EnvJoin(runnerFolder, q, filepath.Join)
}

// EnvJoin is Env with the path join of the runner's OS.
func EnvJoin(runnerFolder string, q Quota, join func(...string) string) map[string]string {
	q = q.WithDefaults()
	d := DirsJoin(runnerFolder, join)
	return map[string]string{
		EnvToolsDir:  d.Tools,
		EnvRustDir:   d.Rust,
		EnvToolQuota: itoa(q.ToolGiB),
		EnvRustCap:   itoa(q.RustGiB),
	}
}

func itoa(n int) string { return strconv.Itoa(n) }
