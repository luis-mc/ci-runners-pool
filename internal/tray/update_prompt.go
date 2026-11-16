package tray

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

// UpdatePrompt is what the update dialog says (CRSP147). It stays on screen
// until the person answers: Install now (primary, right) or Later (left).
type UpdatePrompt struct {
	Current    string // the version that runs
	Latest     string // the newer stable release
	ReleaseURL string // the release page: the What changed link
	Jobs       int    // jobs running now; an install waits for them (drain)
}

// Dialog texts. Words the user sees; kept here so the OS dialogs and the tests share them.
const (
	PromptTitle      = "Update available"
	PromptInstallNow = "Install now"
	PromptLater      = "Later"
	PromptChanged    = "What changed"
)

// Body is the dialog text: both versions and, when jobs run, the wait and their count.
func (p UpdatePrompt) Body() string {
	s := fmt.Sprintf("%s %s is installed. Version %s is available.", ProductName, p.Current, p.Latest)
	switch {
	case p.Jobs == 1:
		s += " 1 job is running. Install now waits for it to finish; no job is stopped."
	case p.Jobs > 1:
		s += fmt.Sprintf(" %d jobs are running. Install now waits for them to finish; no job is stopped.", p.Jobs)
	default:
		s += " No job is running, so it installs at once."
	}
	return s
}

// ErrNoDialog says this desktop has no program that can show the dialog.
var ErrNoDialog = errors.New("no dialog program found")

// Asker shows the dialog and returns true for Install now, false for Later. It
// returns only after an answer. open opens the What changed link.
type Asker func(p UpdatePrompt, open Launcher) (installNow bool, err error)

// UpdateInstaller starts the install after Install now.
type UpdateInstaller interface {
	Install(ctx context.Context) (Status, error)
}

// Offer shows the update dialog for the status and acts on the answer: Install now
// asks the service to install (it drains first), Later changes nothing. Only the
// person's answer installs; a check alone never does.
func (o *Opener) Offer(ctx context.Context, st Status) error {
	if o.Ask == nil || o.Installer == nil {
		o.notify("Update "+st.Update.Latest+" available", "Open the console, Settings, Updates, to install it. Running jobs finish first.")
		return nil
	}
	p := UpdatePrompt{Current: o.Version, Latest: st.Update.Latest, ReleaseURL: st.Update.ReleaseURL, Jobs: st.Update.Jobs}
	now, err := o.Ask(p, o.Browser)
	if err != nil {
		o.notify("Update "+p.Latest+" available", "No dialog could be shown here. Open the console, Settings, Updates, to install it.")
		return err
	}
	if !now {
		return nil
	}
	got, err := o.Installer.Install(ctx)
	if err != nil {
		o.notify("Could not start the update", err.Error()+". Check the status line, then try again.")
		return err
	}
	body := "It installs now."
	if got.Update.Jobs > 0 || p.Jobs > 0 {
		body = "It installs when the running jobs have finished. No job is stopped."
	}
	o.notify("Updating to "+p.Latest, body)
	return nil
}

// Offered remembers the release the person was already asked about in this tray, so a
// found update is offered once per version (Later is an answer) and not at every poll.
type Offered struct {
	mu   sync.Mutex
	last string
}

// Due says whether the status holds a found update to offer now: a newer release, no
// update running, automatic updates off (with them on the service installs by itself),
// and not offered yet. It records the offer.
func (f *Offered) Due(st Status) bool {
	u := st.Update
	if !u.Available || u.Latest == "" || u.Updating() || !u.AutoOff {
		return false
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.last == u.Latest {
		return false
	}
	f.last = u.Latest
	return true
}
