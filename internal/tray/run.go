package tray

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"fyne.io/systray"
)

// Options configure Run. Zero values use the OS defaults.
type Options struct {
	Version string
	Exe     string
	Stdout  io.Writer
	Stderr  io.Writer
}

// Run is `crsp tray`. It returns the process exit code (spec section 7).
func Run(args []string, o Options) int {
	fs := flag.NewFlagSet("tray", flag.ContinueOnError)
	fs.SetOutput(o.Stderr)
	smoke := fs.Bool("smoke", false, "start the tray loop, exit 0 once the icon is ready (CI)")
	hold := fs.Duration("smoke-hold", 0, "with --smoke: keep running this long after the icon is ready")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if o.Exe == "" {
		o.Exe, _ = os.Executable()
	}

	lock, ok, err := AcquireLock()
	if err != nil {
		_, _ = fmt.Fprintln(o.Stderr, "error:", err)
		return 1
	}
	if !ok {
		return ExitOK // another tray runs in this session (R5.23)
	}
	defer lock.Release()

	switch ProbeHost() {
	case HostNoSession:
		_, _ = fmt.Fprintln(o.Stderr, "No desktop session found. Use `crsp open` to get a sign-in link.")
		return ExitNoSession
	case HostNoTrayArea:
		if p, err := statePath(); err == nil && noticeDue(p, o.Version) {
			DesktopNotice("No tray area", "This desktop shows no tray icons. Use `crsp open` to open the console, or install the AppIndicator extension.")
		}
		return ExitNoTrayHost
	}

	return loop(o, *smoke, *hold)
}

func loop(o Options, smoke bool, hold time.Duration) int {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	client := NewClient()
	cur := Status{State: StateStarting}
	curCh := make(chan Status, 1)
	current := func() Status {
		select {
		case s := <-curCh:
			cur = s
		default:
		}
		return cur
	}

	auto, _ := DefaultAutostart(o.Exe)
	opener := &Opener{
		Links: client, Browser: OSLauncher, Files: OSLauncher,
		Notify: DesktopNotice, Current: current, LogDir: LogDir,
	}

	ready := make(chan struct{})
	onReady := func() {
		systray.SetIcon(Icon(StateStarting))
		systray.SetTooltip(cur.Tooltip())
		items := MenuM1(cur, false)
		if auto != nil {
			on, _ := auto.Enabled()
			items = MenuM1(cur, on)
		}
		statusItem := systray.AddMenuItem(items[0].Label, "")
		statusItem.Disable()
		open := systray.AddMenuItem(items[1].Label, "")
		logs := systray.AddMenuItem(items[2].Label, "")
		login := systray.AddMenuItemCheckbox(items[3].Label, "", items[3].Checked)
		quit := systray.AddMenuItem(items[4].Label, "")

		p := &Poller{Source: client, Manager: ServiceState}
		p.OnStatus = func(s Status) {
			select {
			case <-curCh:
			default:
			}
			curCh <- s
			statusItem.SetTitle(s.Text())
			systray.SetTooltip(s.Tooltip())
			systray.SetIcon(Icon(s.State))
		}
		go p.Run(ctx)
		go func() {
			for {
				select {
				case <-open.ClickedCh:
					go func() { _ = opener.Open(ctx) }()
				case <-logs.ClickedCh:
					go func() { _ = opener.OpenLogFolder() }()
				case <-login.ClickedCh:
					if auto == nil {
						continue
					}
					want := !login.Checked()
					if err := auto.Set(want); err != nil {
						DesktopNotice("Could not change Start at login", err.Error())
						continue
					}
					if want {
						login.Check()
					} else {
						login.Uncheck()
					}
				case <-quit.ClickedCh:
					systray.Quit() // closes the tray only (R5.5)
					return
				case <-ctx.Done():
					return
				}
			}
		}()
		close(ready)
	}
	if smoke {
		go func() {
			select {
			case <-ready:
			case <-time.After(15 * time.Second):
				_, _ = fmt.Fprintln(o.Stderr, "smoke: icon not ready in 15 s")
				os.Exit(1)
			}
			time.Sleep(hold)
			systray.Quit()
		}()
	}
	systray.Run(onReady, cancel)
	return ExitOK
}
