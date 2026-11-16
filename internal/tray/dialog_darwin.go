//go:build darwin

package tray

import (
	"context"
	"os/exec"
	"strconv"
	"strings"
)

// AskUpdate shows the update dialog with osascript and waits for the answer.
// What changed opens the release page and shows the dialog again.
func AskUpdate(p UpdatePrompt, open Launcher) (bool, error) {
	buttons := `{` + strconv.Quote(PromptLater) + `, ` + strconv.Quote(PromptInstallNow) + `}`
	if p.ReleaseURL != "" {
		buttons = `{` + strconv.Quote(PromptChanged) + `, ` + strconv.Quote(PromptLater) + `, ` + strconv.Quote(PromptInstallNow) + `}`
	}
	script := "display dialog " + strconv.Quote(p.Body()) + " with title " + strconv.Quote(PromptTitle) +
		" buttons " + buttons + " default button " + strconv.Quote(PromptInstallNow) + " cancel button " + strconv.Quote(PromptLater)
	for {
		out, err := exec.CommandContext(context.Background(), "osascript", "-e", script).Output()
		if err != nil {
			return false, nil // Later (cancel) ends osascript with an error
		}
		switch {
		case strings.Contains(string(out), PromptInstallNow):
			return true, nil
		case strings.Contains(string(out), PromptChanged) && open != nil:
			if err := open(p.ReleaseURL); err != nil {
				return false, err
			}
		default:
			return false, nil
		}
	}
}
