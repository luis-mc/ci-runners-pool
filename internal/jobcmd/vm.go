package jobcmd

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/vmcheck"
)

// VMCacheVar names the folder that holds downloaded VM images.
const VMCacheVar = "CRSP_VM_CACHE"

// Exit codes of `crsp vm`.
const (
	ExitVMFail  = 1 // the guest did not come up, or the image could not be had
	ExitVMUsage = 2 // wrong arguments, or this runner cannot boot (no KVM)
)

const vmUsage = `usage: crsp vm list
       crsp vm boot <distro> [--mem MiB] [--cpus N] [--timeout 5m] [--ready REGEXP] [--cache DIR]`

// VM is `crsp vm` (caches R5.46, port of vm_check.py): `list` prints the
// distros of the catalogue; `boot` downloads the image (checked against the
// published digest), boots it with QEMU and KVM and exits 0 when the serial
// console shows the readiness line within the timeout, 1 when it does not.
func VM(args []string, env Env) int {
	if len(args) == 0 {
		_, _ = fmt.Fprintln(env.Stderr, vmUsage)
		return ExitVMUsage
	}
	cat, err := vmcheck.Load()
	if err != nil {
		_, _ = fmt.Fprintln(env.Stderr, "crsp vm:", err)
		return ExitVMFail
	}
	switch args[0] {
	case "list":
		for _, n := range cat.Names() {
			_, _ = fmt.Fprintln(env.Stdout, n)
		}
		return 0
	case "boot":
		return vmBoot(args[1:], cat, env)
	}
	_, _ = fmt.Fprintf(env.Stderr, "crsp vm: unknown command %q\n%s\n", args[0], vmUsage)
	return ExitVMUsage
}

// ParseBoot reads the arguments of `crsp vm boot` into a spec without its
// folders (the caller sets those).
func ParseBoot(args []string) (vmcheck.BootSpec, string, error) {
	fs := flag.NewFlagSet("vm boot", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var s vmcheck.BootSpec
	var cache string
	fs.IntVar(&s.MemMB, "mem", 0, "")
	fs.IntVar(&s.CPUs, "cpus", 0, "")
	fs.DurationVar(&s.Timeout, "timeout", 0, "")
	fs.StringVar(&s.Ready, "ready", "", "")
	fs.StringVar(&cache, "cache", "", "")
	// The distro comes first; flags may follow it.
	var rest []string
	for len(args) > 0 {
		if err := fs.Parse(args); err != nil {
			return s, "", err
		}
		if fs.NArg() == 0 {
			break
		}
		rest = append(rest, fs.Arg(0))
		args = fs.Args()[1:]
	}
	if len(rest) != 1 {
		return s, "", fmt.Errorf("exactly one distro is expected, got %d", len(rest))
	}
	s.Distro = rest[0]
	return s, cache, nil
}

func vmBoot(args []string, cat vmcheck.Catalogue, env Env) int {
	spec, cache, err := ParseBoot(args)
	if err != nil {
		_, _ = fmt.Fprintf(env.Stderr, "crsp vm: %v\n%s\n", err, vmUsage)
		return ExitVMUsage
	}
	if cache == "" {
		cache = env.Getenv(VMCacheVar)
	}
	if cache == "" {
		home, herr := os.UserHomeDir()
		if herr != nil {
			home = os.TempDir()
		}
		cache = filepath.Join(home, ".cache", "crsp", "vm")
	}
	work, err := os.MkdirTemp("", "crsp-vm-")
	if err != nil {
		_, _ = fmt.Fprintln(env.Stderr, "crsp vm:", err)
		return ExitVMFail
	}
	defer func() { _ = os.RemoveAll(work) }()
	spec.CacheDir, spec.WorkDir = cache, work

	deps := vmcheck.RealDeps()
	if env.VMDeps != nil {
		deps = *env.VMDeps
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	out, err := vmcheck.Boot(ctx, cat, spec, deps, time.Now)
	if err != nil {
		_, _ = fmt.Fprintln(env.Stderr, "crsp vm:", err)
		return ExitVMUsage
	}
	if !out.Pass {
		_, _ = fmt.Fprintf(env.Stderr, "FAIL %s after %s: %s\n", out.Distro, out.Elapsed.Round(time.Second), out.Detail)
		return ExitVMFail
	}
	_, _ = fmt.Fprintf(env.Stdout, "PASS %s (%s) booted in %s: %s\n", out.Distro, out.Image, out.Elapsed.Round(time.Second), strings.TrimSpace(out.Line))
	return 0
}
