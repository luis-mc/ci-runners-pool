package tray

import (
	"context"
	"fmt"
	"os/exec"
	"runtime"
)

// LinkSource asks the service for a one-time link.
type LinkSource interface {
	Link(ctx context.Context) (string, error)
}

// Notifier shows one desktop notice (Problem tone: what failed, why, what next).
type Notifier func(title, body string)

// Launcher opens a URL or folder with the OS default handler.
type Launcher func(target string) error

// Opener implements Open and Open log folder.
type Opener struct {
	Links   LinkSource
	Browser Launcher
	Files   Launcher
	Notify  Notifier
	// Current returns the last known status; Open refuses a dead link while stopped (R5.14).
	Current func() Status
	LogDir  func() string
}

// Open asks for a one-time link and opens it in the browser (R5.6, R5.14).
func (o *Opener) Open(ctx context.Context) error {
	if o.Current != nil {
		if st := o.Current(); st.State == StateStopped {
			o.notify("Service stopped",
				fmt.Sprintf("The service stopped with exit code %d. The log folder has the reason: use Open log folder.", st.ExitCode))
			return fmt.Errorf("service stopped, exit code %d", st.ExitCode)
		}
	}
	url, err := o.Links.Link(ctx)
	if err != nil {
		o.notify("Could not open the console", "The service did not give a sign-in link: "+err.Error()+". Check the status line, then try again.")
		return err
	}
	if err := o.Browser(url); err != nil {
		// No browser: show the link so the user can paste it (spec section 8).
		o.notify("No browser found", "Paste this link into a browser: "+url)
		return err
	}
	return nil
}

// OpenLogFolder opens the service log folder in the file manager (R5.13).
func (o *Opener) OpenLogFolder() error {
	dir := o.LogDir()
	if err := o.Files(dir); err != nil {
		o.notify("Could not open the log folder", dir+": "+err.Error())
		return err
	}
	return nil
}

func (o *Opener) notify(title, body string) {
	if o.Notify != nil {
		o.Notify(title, body)
	}
}

// OSLauncher opens target with the OS default handler.
func OSLauncher(target string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", target)
	case "darwin":
		cmd = exec.Command("open", target)
	default:
		cmd = exec.Command("xdg-open", target)
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	go func() { _ = cmd.Wait() }()
	return nil
}
