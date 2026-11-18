package tray

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"
)

func lookup(goos string, files map[string]bool, onPath map[string]string, env map[string]string) BrowserLookup {
	return BrowserLookup{
		GOOS: goos,
		Stat: func(p string) error {
			if files[p] {
				return nil
			}
			return errors.New("missing")
		},
		LookPath: func(n string) (string, error) {
			if p, ok := onPath[n]; ok {
				return p, nil
			}
			return "", errors.New("not found")
		},
		Getenv: func(k string) string { return env[k] },
	}
}

func TestLookupWindowsPrefersEdgeThenChrome(t *testing.T) {
	env := map[string]string{"ProgramFiles(x86)": `C:\PF86`, "ProgramFiles": `C:\PF`, "LocalAppData": `C:\L`}
	edge := filepath.Join(`C:\PF86`, "Microsoft", "Edge", "Application", "msedge.exe")
	chrome := filepath.Join(`C:\PF`, "Google", "Chrome", "Application", "chrome.exe")
	got, err := lookup("windows", map[string]bool{edge: true, chrome: true}, nil, env).Find()
	if err != nil || got != edge {
		t.Fatalf("%q %v", got, err)
	}
	got, err = lookup("windows", map[string]bool{chrome: true}, nil, env).Find()
	if err != nil || got != chrome {
		t.Fatalf("%q %v", got, err)
	}
	got, err = lookup("windows", nil, map[string]string{"chrome.exe": "X"}, env).Find()
	if err != nil || got != "X" {
		t.Fatalf("PATH last: %q %v", got, err)
	}
}

func TestLookupDarwinLooksInApplicationsAndHome(t *testing.T) {
	home := filepath.Join("/Users", "me", "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome")
	got, err := lookup("darwin", map[string]bool{home: true}, nil, map[string]string{"HOME": "/Users/me"}).Find()
	if err != nil || got != home {
		t.Fatalf("%q %v", got, err)
	}
	sys := filepath.Join("/Applications", "Microsoft Edge.app", "Contents", "MacOS", "Microsoft Edge")
	got, _ = lookup("darwin", map[string]bool{sys: true, home: true}, nil, map[string]string{"HOME": "/Users/me"}).Find()
	if got != sys {
		t.Fatalf("Edge in /Applications comes first: %q", got)
	}
}

func TestLookupLinuxTriesNamesInOrder(t *testing.T) {
	got, err := lookup("linux", nil, map[string]string{"chromium": "/usr/bin/chromium", "google-chrome": "/usr/bin/google-chrome"}, nil).Find()
	if err != nil || got != "/usr/bin/google-chrome" {
		t.Fatalf("%q %v", got, err)
	}
	if _, err := lookup("linux", nil, nil, nil).Find(); !errors.Is(err, ErrNoAppBrowser) {
		t.Fatalf("%v", err)
	}
	if _, err := lookup("freebsd", nil, nil, nil).Find(); !errors.Is(err, ErrNoAppBrowser) {
		t.Fatalf("%v", err)
	}
}

func TestAppWindowArgsAreAppModeAt520By420(t *testing.T) {
	a := AppWindowArgs("http://127.0.0.1:8460/auth/link?code=1")
	if len(a) != 2 || a[0] != "--app=http://127.0.0.1:8460/auth/link?code=1" || a[1] != "--window-size=520,420" {
		t.Fatalf("%v", a)
	}
}

func TestAppWindowOpensTheBrowserElseTheDefault(t *testing.T) {
	var ranPath string
	var ranArgs []string
	var def string
	o := AppWindowOpener{
		Lookup:   lookup("linux", nil, map[string]string{"chromium": "/usr/bin/chromium"}, nil),
		Start:    func(p string, a []string) error { ranPath, ranArgs = p, a; return nil },
		Fallback: func(u string) error { def = u; return nil },
	}
	if err := o.Open("http://x/u"); err != nil || ranPath != "/usr/bin/chromium" || !strings.HasPrefix(ranArgs[0], "--app=") || def != "" {
		t.Fatalf("%v %q %v %q", err, ranPath, ranArgs, def)
	}
	// No browser found: the default browser opens the address.
	o.Lookup = lookup("linux", nil, nil, nil)
	ranPath = ""
	if err := o.Open("http://x/u"); err != nil || ranPath != "" || def != "http://x/u" {
		t.Fatalf("%v %q %q", err, ranPath, def)
	}
	// A browser that cannot start: the default browser too.
	o.Lookup = lookup("linux", nil, map[string]string{"chromium": "/c"}, nil)
	o.Start = func(string, []string) error { return errors.New("exec format error") }
	def = ""
	if err := o.Open("http://x/v"); err != nil || def != "http://x/v" {
		t.Fatalf("%v %q", err, def)
	}
	// Nothing works: an error, so the caller shows the native box.
	o.Fallback = func(string) error { return errors.New("no default") }
	if err := o.Open("http://x/w"); err == nil {
		t.Fatal("nothing opened must be an error")
	}
	o.Fallback = nil
	if err := o.Open("http://x/w"); !errors.Is(err, ErrNoAppBrowser) {
		t.Fatalf("%v", err)
	}
}

type pathTargets struct {
	got string
	err error
}

func (p *pathTargets) LinkTo(_ context.Context, target string) (string, error) {
	p.got = target
	return "http://127.0.0.1:8460/auth/link?code=9", p.err
}

// Offer opens the console page first: the page asks, so neither the box nor an install happens in the tray.
func TestOfferOpensTheUpdatePageAndAsksNothingNatively(t *testing.T) {
	inst, asked, opened := &fakeInstaller{}, 0, ""
	tg := &pathTargets{}
	o := &Opener{
		Targets: tg, Installer: inst, Notify: func(string, string) {},
		Window: func(u string) error { opened = u; return nil },
		Ask:    func(UpdatePrompt, Launcher) (bool, error) { asked++; return true, nil },
	}
	if err := o.Offer(context.Background(), found); err != nil {
		t.Fatal(err)
	}
	if tg.got != "/update" || opened != "http://127.0.0.1:8460/auth/link?code=9" || asked != 0 || inst.calls != 0 {
		t.Fatalf("target=%q opened=%q asked=%d installs=%d", tg.got, opened, asked, inst.calls)
	}
}

// No window can open: the native two-button box asks, and Not now starts nothing.
func TestOfferFallsBackToTheNativeBox(t *testing.T) {
	for _, c := range []struct {
		name   string
		window Launcher
		tg     TargetLinkSource
	}{
		{"no browser", func(string) error { return ErrNoAppBrowser }, &pathTargets{}},
		{"no link", func(string) error { return nil }, &pathTargets{err: errors.New("service down")}},
		{"no target links", func(string) error { return nil }, nil},
	} {
		for _, yes := range []bool{false, true} {
			inst, asked := &fakeInstaller{}, 0
			o := &Opener{
				Targets: c.tg, Installer: inst, Notify: func(string, string) {}, Window: c.window,
				Ask: func(p UpdatePrompt, _ Launcher) (bool, error) { asked++; return yes, nil },
			}
			if err := o.Offer(context.Background(), found); err != nil {
				t.Fatalf("%s: %v", c.name, err)
			}
			want := 0
			if yes {
				want = 1
			}
			if asked != 1 || inst.calls != want {
				t.Fatalf("%s yes=%v: asked=%d installs=%d", c.name, yes, asked, inst.calls)
			}
		}
	}
}

// A look that finds an update that is already running shows its progress in the window.
func TestLookWhileUpdatingOpensTheProgressWindow(t *testing.T) {
	busy := found
	busy.Update.State = "installing"
	opened := ""
	o := &Opener{
		Checker: fakeChecker{st: busy}, Version: "1.4.0", Notify: func(string, string) { t.Fatal("no notice when the window opens") },
		Targets: &pathTargets{}, Window: func(u string) error { opened = u; return nil },
	}
	if err := o.LookForUpdates(context.Background()); err != nil || opened == "" {
		t.Fatalf("%v %q", err, opened)
	}
}
