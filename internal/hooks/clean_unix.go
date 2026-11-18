//go:build !windows

package hooks

import (
	"bytes"
	"context"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// NewCleaner is the real cleaner of a runner account on Linux or macOS.
func NewCleaner(getenv func(string) string, phase string, log func(string)) *Cleaner {
	return &Cleaner{
		Getenv: getenv, Phase: phase, Self: strconv.Itoa(os.Getuid()), Pid: int64(os.Getpid()),
		Procs: listProcs, Owner: fileOwner, Shared: []string{"/tmp"}, Log: log,
		Kill: func(pid int64) error { return syscall.Kill(int(pid), syscall.SIGKILL) },
	}
}

func fileOwner(fi fs.FileInfo) string {
	if st, ok := fi.Sys().(*syscall.Stat_t); ok {
		return strconv.FormatUint(uint64(st.Uid), 10)
	}
	return ""
}

// listProcs reads /proc where it exists, else asks ps.
func listProcs() ([]ProcInfo, error) {
	if _, err := os.Stat("/proc/self/stat"); err == nil {
		return procFS("/proc")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "ps", "-axo", "pid=,ppid=,uid=,comm=").Output()
	if err != nil {
		return nil, err
	}
	return parsePS(string(out)), nil
}

func parsePS(out string) []ProcInfo {
	var res []ProcInfo
	for _, ln := range strings.Split(out, "\n") {
		f := strings.Fields(ln)
		if len(f) < 4 {
			continue
		}
		pid, e1 := strconv.ParseInt(f[0], 10, 64)
		ppid, e2 := strconv.ParseInt(f[1], 10, 64)
		if e1 != nil || e2 != nil {
			continue
		}
		res = append(res, ProcInfo{PID: pid, PPID: ppid, Owner: f[2], Name: filepath.Base(strings.Join(f[3:], " "))})
	}
	return res
}

func procFS(root string) ([]ProcInfo, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}
	var res []ProcInfo
	for _, e := range entries {
		pid, err := strconv.ParseInt(e.Name(), 10, 64)
		if err != nil {
			continue
		}
		b, err := os.ReadFile(filepath.Join(root, e.Name(), "stat")) //nolint:gosec // /proc
		if err != nil {
			continue
		}
		i, j := bytes.IndexByte(b, '('), bytes.LastIndexByte(b, ')')
		if i < 0 || j < i {
			continue
		}
		rest := strings.Fields(string(b[j+1:]))
		if len(rest) < 2 {
			continue
		}
		ppid, _ := strconv.ParseInt(rest[1], 10, 64)
		info, err := e.Info()
		if err != nil {
			continue
		}
		res = append(res, ProcInfo{PID: pid, PPID: ppid, Owner: fileOwner(info), Name: string(b[i+1 : j])})
	}
	return res, nil
}
