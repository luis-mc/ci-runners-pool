package jobcmd

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/vmcheck"
)

func TestParseBootTakesTheDistroBeforeOrAfterFlags(t *testing.T) {
	for _, args := range [][]string{
		{"rocky-9", "--mem", "4096", "--cpus", "4", "--timeout", "90s", "--ready", "ok$", "--cache", "/c"},
		{"--mem", "4096", "--cpus", "4", "--timeout", "90s", "rocky-9", "--ready", "ok$", "--cache", "/c"},
	} {
		s, cache, err := ParseBoot(args)
		if err != nil || s.Distro != "rocky-9" || s.MemMB != 4096 || s.CPUs != 4 || s.Timeout != 90*time.Second || s.Ready != "ok$" || cache != "/c" {
			t.Fatalf("%v: %+v %q %v", args, s, cache, err)
		}
	}
	for _, bad := range [][]string{nil, {"a", "b"}, {"--bogus", "a"}, {"--mem", "x", "a"}} {
		if _, _, err := ParseBoot(bad); err == nil {
			t.Errorf("%v: no error", bad)
		}
	}
}

type noNet struct{}

func (noNet) Text(context.Context, string) (string, error)       { return "", errors.New("offline") }
func (noNet) Get(context.Context, string) (io.ReadCloser, error) { return nil, errors.New("offline") }

func vmEnv(kvm bool, out, errw io.Writer) Env {
	d := vmcheck.Deps{Fetch: noNet{}, KVMUsable: func() bool { return kvm }}
	return Env{Getenv: func(string) string { return "" }, Stdout: out, Stderr: errw, VMDeps: &d}
}

func TestVMListUsageAndExitCodes(t *testing.T) {
	var o, e strings.Builder
	if code := VM([]string{"list"}, vmEnv(true, &o, &e)); code != 0 || !strings.Contains(o.String(), "rocky-9\n") {
		t.Fatalf("list %d %q", code, o.String())
	}
	if code := VM(nil, vmEnv(true, &o, &e)); code != ExitVMUsage {
		t.Fatalf("no args %d", code)
	}
	if code := VM([]string{"boot"}, vmEnv(true, &o, &e)); code != ExitVMUsage {
		t.Fatalf("no distro %d", code)
	}
	e.Reset()
	if code := VM([]string{"boot", "rocky-9", "--cache", t.TempDir()}, vmEnv(false, &o, &e)); code != ExitVMUsage || !strings.Contains(e.String(), "/dev/kvm") {
		t.Fatalf("no kvm %d %q", code, e.String())
	}
	e.Reset()
	if code := VM([]string{"boot", "rocky-9", "--cache", t.TempDir()}, vmEnv(true, &o, &e)); code != ExitVMFail || !strings.Contains(e.String(), "FAIL rocky-9") {
		t.Fatalf("offline %d %q", code, e.String())
	}
}

func TestParseRunTakesRepeatedCommandsAndTheDistroAnywhere(t *testing.T) {
	for _, args := range [][]string{
		{"fedora-45", "--package", "/p", "--install", "make", "--install", "make install", "--check", "make check", "--run-timeout", "10m", "--cache", "/c"},
		{"--package", "/p", "--install", "make", "fedora-45", "--install", "make install", "--check", "make check", "--run-timeout", "10m", "--cache", "/c"},
	} {
		s, cache, err := ParseRun(args)
		if err != nil || s.Distro != "fedora-45" || s.Package != "/p" || len(s.Install) != 2 || s.Install[1] != "make install" ||
			len(s.Check) != 1 || s.RunTimeout != 10*time.Minute || cache != "/c" {
			t.Fatalf("%v: %+v %q %v", args, s, cache, err)
		}
	}
	if _, _, err := ParseRun([]string{"a", "b"}); err == nil {
		t.Fatal("two distros accepted")
	}
	s, _, err := ParseSELinux([]string{"rocky-9", "--rpm", "a.rpm", "--module", "m.pp", "--service", "x.service", "--context", "x_t"})
	if err != nil || s.Distro != "rocky-9" || s.RPM != "a.rpm" || s.Module != "m.pp" || s.Service != "x.service" || s.ContextType != "x_t" {
		t.Fatalf("%+v %v", s, err)
	}
}

func TestVMRunPrepareSELinuxUsageAndExitCodes(t *testing.T) {
	var o, e strings.Builder
	env := vmEnv(true, &o, &e)
	gd := vmcheck.GuestDeps{Deps: *env.VMDeps}
	env.VMGuestDeps = &gd
	if code := VM([]string{"run"}, env); code != ExitVMUsage {
		t.Fatalf("run without distro %d", code)
	}
	e.Reset()
	if code := VM([]string{"run", "rocky-9", "--cache", t.TempDir()}, env); code != ExitVMUsage || !strings.Contains(e.String(), "nothing to run") {
		t.Fatalf("run without commands %d %q", code, e.String())
	}
	e.Reset()
	if code := VM([]string{"selinux", "debian-12", "--cache", t.TempDir()}, env); code != ExitVMUsage || !strings.Contains(e.String(), "no SELinux") {
		t.Fatalf("selinux on debian %d %q", code, e.String())
	}
	e.Reset()
	if code := VM([]string{"prepare", "rocky-9", "--cache", t.TempDir()}, env); code != ExitVMFail || !strings.Contains(e.String(), "FAIL prepare") {
		t.Fatalf("prepare offline %d %q", code, e.String())
	}
	if code := VM([]string{"prepare", "nope"}, env); code != ExitVMUsage {
		t.Fatalf("prepare unknown distro %d", code)
	}
	e.Reset()
	if code := VM([]string{"run", "rocky-9", "--check", "true", "--cache", t.TempDir()}, vmEnv(false, &o, &e)); code != ExitVMUsage || !strings.Contains(e.String(), "/dev/kvm") {
		t.Fatalf("run no kvm %d %q", code, e.String())
	}
}
