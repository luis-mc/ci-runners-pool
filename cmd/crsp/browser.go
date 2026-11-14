package main

import (
	"errors"
	"os"
	"os/exec"
	"runtime"
)

// openBrowser opens url in the default browser when a desktop session exists.
func openBrowser(url string) error {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		return exec.Command("open", url).Start()
	default:
		if os.Getenv("DISPLAY") == "" && os.Getenv("WAYLAND_DISPLAY") == "" {
			return errors.New("no desktop session")
		}
		return exec.Command("xdg-open", url).Start()
	}
}
