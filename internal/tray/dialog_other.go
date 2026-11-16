//go:build !linux && !darwin && !windows

package tray

// AskUpdate has no dialog on this OS.
func AskUpdate(UpdatePrompt, Launcher) (bool, error) { return false, ErrNoDialog }
