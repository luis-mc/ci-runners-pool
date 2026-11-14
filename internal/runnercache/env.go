package runnercache

import (
	"path/filepath"
	"strconv"
	"strings"
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

// Cap is one cache folder with its quota in bytes.
type Cap struct {
	Name  string
	Dir   string
	Bytes int64
}

// CapsFromEnv reads the caches a job sees in its environment: the tool cache
// (CI_TOOLS_DIR with CI_TOOLS_QUOTA_GIB) and the Rust build cache
// (CARGO_TARGET_DIR with CRSP_RUST_CACHE_CAP_GIB). A cache with no folder or
// no usable quota is left out, so a runner that was not set up by the
// product evicts nothing.
func CapsFromEnv(getenv func(string) string) []Cap {
	var out []Cap
	for _, c := range []struct{ name, dir, quota string }{
		{"tool cache", EnvToolsDir, EnvToolQuota},
		{"Rust build cache", EnvRustDir, EnvRustCap},
	} {
		dir := getenv(c.dir)
		gib, err := strconv.Atoi(strings.TrimSpace(getenv(c.quota)))
		if dir == "" || err != nil || gib <= 0 {
			continue
		}
		out = append(out, Cap{Name: c.name, Dir: dir, Bytes: int64(gib) * GiB})
	}
	return out
}
