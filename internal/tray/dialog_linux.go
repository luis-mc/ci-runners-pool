//go:build linux

package tray

import (
	"context"
	"errors"
	"html"
	"os/exec"
)

// AskUpdate shows the update dialog with zenity (or kdialog) and waits for the
// answer. Install now is the right button, Later the left.
func AskUpdate(p UpdatePrompt, _ Launcher) (bool, error) {
	ctx := context.Background()
	var cmd *exec.Cmd
	if path, err := exec.LookPath("zenity"); err == nil {
		text := html.EscapeString(p.Body())
		if p.ReleaseURL != "" {
			text += "\n\n<a href=\"" + html.EscapeString(p.ReleaseURL) + "\">" + PromptChanged + "</a>"
		}
		cmd = exec.CommandContext(ctx, path, "--question", "--title", PromptTitle, "--text", text, "--no-wrap", //nolint:gosec // looked-up dialog program
			"--ok-label", PromptInstallNow, "--cancel-label", PromptLater)
	} else if path, err := exec.LookPath("kdialog"); err == nil {
		text := html.EscapeString(p.Body())
		if p.ReleaseURL != "" {
			text += "<br><br><a href=\"" + html.EscapeString(p.ReleaseURL) + "\">" + PromptChanged + "</a>"
		}
		cmd = exec.CommandContext(ctx, path, "--title", PromptTitle, "--yes-label", PromptInstallNow, "--no-label", PromptLater, "--yesno", text) //nolint:gosec // looked-up dialog program
	} else {
		return false, ErrNoDialog
	}
	err := cmd.Run()
	if err == nil {
		return true, nil
	}
	var ee *exec.ExitError
	if errors.As(err, &ee) && ee.ExitCode() == 1 {
		return false, nil // Later, or the dialog was closed
	}
	return false, err
}
