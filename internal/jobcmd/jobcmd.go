// Package jobcmd holds the commands a container job calls inside the base
// image: `crsp vm` and `crsp db-env` (runners R5.48). `crsp vm` is a stub (the
// VM boot is caches R5.46, v0.6.0); it fails with a clear line, so a workflow
// never believes a step that did nothing. `crsp db-env` is runners R5.54.
package jobcmd

import (
	"fmt"
	"io"
	"os"
)

// NotYetImplemented is the line a stub prints.
const NotYetImplemented = "NOT YET IMPLEMENTED"

// ExitNotImplemented is the exit code of a stub.
const ExitNotImplemented = 3

var later = map[string]string{
	"vm": "crsp vm boots test VMs on a kvm runner (caches R5.46, v0.6.0)",
}

// Handles says whether name is one of the job commands.
func Handles(name string) bool { return name == "db-env" || later[name] != "" }

// Run runs the job command name with the process environment and returns the
// exit code.
func Run(name string, args []string, stdout, stderr io.Writer) int {
	return RunEnv(name, args, Env{Getenv: os.Getenv, Stdout: stdout, Stderr: stderr})
}

// RunEnv is Run with an injected environment, for tests.
func RunEnv(name string, _ []string, env Env) int {
	if name == "db-env" {
		return DBEnv(env)
	}
	stderr := env.Stderr
	why, ok := later[name]
	if !ok {
		_, _ = fmt.Fprintf(stderr, "unknown job command %q\n", name)
		return 2
	}
	_, _ = fmt.Fprintf(stderr, "%s: %s\n", NotYetImplemented, why)
	return ExitNotImplemented
}
