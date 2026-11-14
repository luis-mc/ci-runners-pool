// Package sys holds the seams between a persistent backend and the machine:
// a command runner, a file system and a downloader. Backends call only these,
// so unit tests inject fakes and assert the exact calls; a test never creates
// an account or a service (runners R6.9).
package sys

import (
	"context"
	"io/fs"
	"os"
	"os/exec"
	"strings"
)

// Command is one program call. Args are passed one by one, never joined into a
// shell line (runners R5.18). Env carries values the program reads; SecretEnv
// carries values that must never appear in a plan, log or output (runners
// R5.15, R6.2). Stdin is a script text for PowerShell, never a secret.
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
	Cmd     Commands
	FS      FS
	Fetch   Fetcher
	Verify  func(path, sha256 string) error
	Redact  func(string) string
	LogLine func(step, msg string)
}

// ExecCommands is the real command runner.
type ExecCommands struct{}

// Run runs the program with its arguments, never through a shell.
func (ExecCommands) Run(ctx context.Context, c Command) (Result, error) {
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
	var out, errb strings.Builder
	cmd.Stdout, cmd.Stderr = &out, &errb
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
