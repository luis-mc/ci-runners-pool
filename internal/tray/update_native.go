package tray

import (
	"context"
	"errors"
	"strconv"
)

// The native update window (TRAY5 D12, D14): the tray copies its signed binary to a temp folder
// and starts it as `crsp update-window`, so the window lives on while the update replaces the
// program folder and restarts the service. Windows only; elsewhere the console page opens.

// ErrNoNativeWindow says this OS has no native update window.
var ErrNoNativeWindow = errors.New("no native update window on this OS")

// NativeWindow opens the native update window. mode is review (the question) or live (what
// runs now); st is the status the tray knows.
type NativeWindow func(ctx context.Context, mode string, st Status) error

// UpdateWindowCommand is the hidden subcommand of crsp that runs the window.
const UpdateWindowCommand = "update-window"

// UpdateWindowArgs are the arguments after the subcommand.
func UpdateWindowArgs(mode, from, to string, x, y int, hasAt bool) []string {
	args := []string{"--mode", mode}
	if from != "" {
		args = append(args, "--from", from)
	}
	if to != "" {
		args = append(args, "--to", to)
	}
	if hasAt {
		args = append(args, "--at", strconv.Itoa(x)+","+strconv.Itoa(y))
	}
	return args
}

// WindowMode is review when no update runs and live when one does or just ended.
func WindowMode(st Status) string {
	if st.Update.Updating() || (st.Update.Stage != nil && st.Update.Stage.Name == "done") {
		return "live"
	}
	return "review"
}
