// Package jobcmd holds the commands a container job calls inside the base
// image: `crsp vm` and `crsp db-env` (runners R5.48). Both are stubs: the VM
// boot is caches R5.46 (v0.6.0) and the database step is runners R5.54
// (v0.4.0). A stub fails with a clear line, so a workflow never believes a
// step that did nothing.
package jobcmd

import (
	"fmt"
	"io"
)

// NotYetImplemented is the line a stub prints.
const NotYetImplemented = "NOT YET IMPLEMENTED"

// ExitNotImplemented is the exit code of a stub.
const ExitNotImplemented = 3

var later = map[string]string{
	"vm":     "crsp vm boots test VMs on a kvm runner (caches R5.46, v0.6.0)",
	"db-env": "crsp db-env gives a job its database settings (runners R5.54, v0.4.0)",
}

// Handles says whether name is one of the job commands.
func Handles(name string) bool { _, ok := later[name]; return ok }

// Run runs the job command name and returns the exit code.
func Run(name string, _ []string, stderr io.Writer) int {
	why, ok := later[name]
	if !ok {
		_, _ = fmt.Fprintf(stderr, "unknown job command %q\n", name)
		return 2
	}
	_, _ = fmt.Fprintf(stderr, "%s: %s\n", NotYetImplemented, why)
	return ExitNotImplemented
}
