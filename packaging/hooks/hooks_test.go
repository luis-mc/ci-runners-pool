package hooks

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

const problemFile = "crsp-hook-problem.txt"

// CRSP22: a missing or broken crsp never fails the job, and never hides.
func runSh(t *testing.T, name, crsp string) (string, int, string) {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("sh hooks run on Linux and macOS")
	}
	body, err := Unix(name)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	script := filepath.Join(dir, name+".sh")
	if err := os.WriteFile(script, body, 0o755); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command("/bin/sh", script)
	cmd.Env = append(os.Environ(), "CRSP_BIN="+crsp)
	out, err := cmd.CombinedOutput()
	code := 0
	if ee, ok := err.(*exec.ExitError); ok {
		code = ee.ExitCode()
	} else if err != nil {
		t.Fatal(err)
	}
	marker, _ := os.ReadFile(filepath.Join(dir, problemFile))
	return string(out), code, string(marker)
}

func TestShHookWarnsWhenCrspIsMissing(t *testing.T) {
	for _, name := range []string{"job-started", "job-completed"} {
		missing := filepath.Join(t.TempDir(), "no-crsp")
		out, code, marker := runSh(t, name, missing)
		want := "::warning title=crsp::crsp is not installed at " + missing + ", so this job ran without the queue and the load gate."
		if code != 0 || !strings.HasPrefix(out, want) || !strings.Contains(out, "crsp doctor --check runner.hooks") {
			t.Fatalf("%s: exit %d output %q", name, code, out)
		}
		if !strings.HasPrefix(marker, name+": crsp is not installed at ") {
			t.Fatalf("%s: problem file %q", name, marker)
		}
	}
}

func TestShHookWarnsWhenCrspCannotRun(t *testing.T) {
	// executable, but not a program the OS can run: exit 126 or 127
	bad := filepath.Join(t.TempDir(), "crsp")
	if err := os.WriteFile(bad, []byte("#!/no/such/interpreter\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	out, code, marker := runSh(t, "job-started", bad)
	if code != 0 || !strings.Contains(out, "::warning title=crsp::crsp at "+bad+" could not run (exit ") || marker == "" {
		t.Fatalf("exit %d output %q marker %q", code, out, marker)
	}
}

func TestShHookPassesCrspExitCodeAndStaysQuiet(t *testing.T) {
	// the gate's own failure (timeout) is not a broken install: no annotation, same exit code
	fake := filepath.Join(t.TempDir(), "crsp")
	if err := os.WriteFile(fake, []byte("#!/bin/sh\necho \"hook $2\"\nexit 1\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	out, code, marker := runSh(t, "job-started", fake)
	if code != 1 || out != "hook job-started\n" || marker != "" {
		t.Fatalf("exit %d output %q marker %q", code, out, marker)
	}
}

func TestPs1HookWarnsWhenCrspIsMissing(t *testing.T) {
	for _, name := range []string{"job-started", "job-completed"} {
		body, err := Windows(name)
		if err != nil {
			t.Fatal(err)
		}
		s := string(body)
		for _, want := range []string{"::warning title=crsp::", "crsp is not installed at $crsp", "crsp doctor --check runner.hooks", "crsp-hook-problem.txt", "catch {", "exit 0"} {
			if !strings.Contains(s, want) {
				t.Errorf("%s.ps1 lacks %q", name, want)
			}
		}
		if strings.Contains(s, "the job goes on") {
			t.Errorf("%s.ps1 still has the silent message", name)
		}
	}
	pwsh, err := exec.LookPath("pwsh")
	if err != nil {
		t.Log("pwsh not found: the .ps1 hooks are checked by text only")
		return
	}
	body, _ := Windows("job-started")
	dir := t.TempDir()
	script := filepath.Join(dir, "job-started.ps1")
	if err := os.WriteFile(script, body, 0o644); err != nil {
		t.Fatal(err)
	}
	missing := filepath.Join(dir, "no-crsp.exe")
	cmd := exec.Command(pwsh, "-NoProfile", "-File", script)
	cmd.Env = append(os.Environ(), "CRSP_BIN="+missing)
	out, err := cmd.CombinedOutput()
	if err != nil || !strings.HasPrefix(string(out), "::warning title=crsp::crsp is not installed at "+missing) {
		t.Fatalf("err %v output %q", err, out)
	}
}
