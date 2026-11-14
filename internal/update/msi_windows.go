//go:build windows

package update

import (
	"context"
	"os/exec"
	"syscall"
)

// StartMSIDetached starts msiexec detached from the service: the upgrade stops
// this very process, and msiexec must go on.
func StartMSIDetached(_ context.Context, msi, log string) (int, error) {
	start := func(flags uint32) (*exec.Cmd, error) {
		// Background, never the caller's context: msiexec must outlive this process.
		cmd := exec.CommandContext(context.Background(), "msiexec", MSIArgs(msi, log)...) //nolint:gosec // fixed program, our own file
		cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: flags, HideWindow: true}
		return cmd, cmd.Start()
	}
	cmd, err := start(detachedProcess | createNewProcessGroup | createBreakawayFromJob)
	if err != nil {
		cmd, err = start(detachedProcess | createNewProcessGroup)
	}
	if err != nil {
		return 0, err
	}
	pid := cmd.Process.Pid
	go func() { _ = cmd.Wait() }()
	return pid, nil
}
