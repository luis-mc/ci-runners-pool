//go:build !windows

package updatewindow

// The native window is Windows only (TRAY5); macOS and Linux keep the console page (TRAY7).
func runWindow(_ Config, o Options) int {
	say(o.Stderr, "The native update window is built for Windows. Use the update page of the console.")
	return 1
}

func layoutCheck(_ Config, o Options) int {
	say(o.Stderr, "The layout check draws with Windows fonts and runs on Windows only.")
	return 1
}
