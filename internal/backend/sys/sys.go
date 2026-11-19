// Package sys holds the seams between a persistent backend and the machine:
// a command runner, a file system and a downloader. Backends call only these,
// so unit tests inject fakes and assert the exact calls; a test never creates
// an account or a service (runners R6.9).
package sys

import (
	"context"
	"github.com/luis-mc/ci-runners-shared-pool/internal/addresses"
	"io/fs"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// Command is one program call. Args are passed one by one, never joined into a
// shell line (runners R5.18). Env carries values the program reads; SecretEnv
// carries values that must never appear in a plan, log or output (runners
// R5.15, R6.2). Stdin is a script text for PowerShell, or the JIT config of a container runner (it never goes in Args or Env).
type Command struct {
	Name      string
	Args      []string
	Env       map[string]string
	SecretEnv map[string]string
	Stdin     string
	// Dir is the working directory.
	Dir string
}

// String is the redacted description of the call, safe for a plan or log.
func (c Command) String() string {
	return c.Name + " " + strings.Join(c.Args, " ")
}

// Result is what a command gave back.
type Result struct {
	Stdout   string
	Stderr   string
	ExitCode int
}

// Commands runs programs.
type Commands interface {
	Run(ctx context.Context, c Command) (Result, error)
}

// StreamCommands is a Commands that can also hand each output line to a
// callback while the program runs (a registry pull shows its progress this
// way). A Commands without it still works; the caller then has no lines until
// the end.
type StreamCommands interface {
	Commands
	RunStream(ctx context.Context, c Command, onLine func(line string)) (Result, error)
}

// FS is the small file system the backends need.
type FS interface {
	MkdirAll(path string, perm fs.FileMode) error
	WriteFile(path string, data []byte, perm fs.FileMode) error
	ReadFile(path string) ([]byte, error)
	Exists(path string) bool
	RemoveAll(path string) error
}

// Fetcher downloads a URL to a file. The caller verifies the hash.
type Fetcher interface {
	Fetch(ctx context.Context, url, dest string) error
}

// Deps is what every persistent backend is built with.
type Deps struct {
	Cmd Commands
	FS  FS
	// Addresses are the external addresses (runner download base); the zero
	// value takes the github.com defaults.
	Addresses addresses.Set
	Fetch     Fetcher
	Verify    func(path, sha256 string) error
	Redact    func(string) string
	// Secret teaches Redact a one-time value (token, JIT config) before it is used (runners R5.11).
	Secret  func(string)
	LogLine func(step, msg string)
	// Sleep replaces the real wait while a listener ends (tests); nil is real.
	Sleep func(ctx context.Context, d time.Duration)
}

// ExecCommands is the real command runner.
type ExecCommands struct{}

// Run runs the program with its arguments, never through a shell.
func (e ExecCommands) Run(ctx context.Context, c Command) (Result, error) {
	return e.RunStream(ctx, c, nil)
}

// lineWriter collects output and gives each finished line (split at \n or \r)
// to onLine.
type lineWriter struct {
	mu     sync.Mutex
	buf    strings.Builder
	part   strings.Builder
	onLine func(string)
}

func (w *lineWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.buf.Write(p)
	if w.onLine == nil {
		return len(p), nil
	}
	for _, b := range p {
		if b == '\n' || b == '\r' {
			if w.part.Len() > 0 {
				w.onLine(w.part.String())
				w.part.Reset()
			}
			continue
		}
		w.part.WriteByte(b)
	}
	return len(p), nil
}

func (w *lineWriter) String() string {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.buf.String()
}

// RunStream is Run that also gives each output line of stdout and stderr to
// onLine (nil: none).
func (ExecCommands) RunStream(ctx context.Context, c Command, onLine func(string)) (Result, error) {
	cmd := exec.CommandContext(ctx, c.Name, c.Args...) //nolint:gosec // the backends build every call from fixed programs.
	cmd.Dir = c.Dir
	cmd.Env = os.Environ()
	for k, v := range c.Env {
		cmd.Env = append(cmd.Env, k+"="+v)
	}
	for k, v := range c.SecretEnv {
		cmd.Env = append(cmd.Env, k+"="+v)
	}
	if c.Stdin != "" {
		cmd.Stdin = strings.NewReader(c.Stdin)
	}
	out, errb := &lineWriter{onLine: onLine}, &lineWriter{onLine: onLine}
	cmd.Stdout, cmd.Stderr = out, errb
	err := cmd.Run()
	res := Result{Stdout: out.String(), Stderr: errb.String()}
	if ee, ok := err.(*exec.ExitError); ok {
		res.ExitCode = ee.ExitCode()
		return res, nil
	}
	return res, err
}

// OSFS is the real file system.
type OSFS struct{}

// MkdirAll implements FS.
func (OSFS) MkdirAll(p string, perm fs.FileMode) error { return os.MkdirAll(p, perm) }

// WriteFile implements FS.
func (OSFS) WriteFile(p string, d []byte, perm fs.FileMode) error { return os.WriteFile(p, d, perm) }

// ReadFile implements FS.
func (OSFS) ReadFile(p string) ([]byte, error) { return os.ReadFile(p) } //nolint:gosec // runner folders only.

// Exists implements FS.
func (OSFS) Exists(p string) bool { _, err := os.Stat(p); return err == nil }

// RemoveAll implements FS.
func (OSFS) RemoveAll(p string) error { return os.RemoveAll(p) }
