package tray

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type fakeInstaller struct {
	calls int
	err   error
}

func (f *fakeInstaller) Install(context.Context) (Status, error) { f.calls++; return Status{}, f.err }

type notices struct{ titles, bodies []string }

func (n *notices) add(t, b string) { n.titles = append(n.titles, t); n.bodies = append(n.bodies, b) }

func newOffer(now bool, askErr error, st Status) (*Opener, *fakeInstaller, *notices, *[]UpdatePrompt) {
	inst, n, asked := &fakeInstaller{}, &notices{}, &[]UpdatePrompt{}
	o := &Opener{
		Checker: fakeChecker{st: st}, Version: "1.4.0", Notify: n.add, Installer: inst,
		Ask: func(p UpdatePrompt, _ Launcher) (bool, error) { *asked = append(*asked, p); return now, askErr },
	}
	return o, inst, n, asked
}

var found = Status{Update: UpdateInfo{Latest: "1.5.0", Available: true, ReleaseURL: "https://example.test/v1.5.0", Jobs: 2}}

// The check only asks. Later changes nothing; Install now installs; neither happens by itself.
func TestLookForUpdatesAsksAndNeverInstallsByItself(t *testing.T) {
	o, inst, _, asked := newOffer(false, nil, found)
	if err := o.LookForUpdates(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(*asked) != 1 || inst.calls != 0 {
		t.Fatalf("Later: asked=%d installs=%d", len(*asked), inst.calls)
	}
	p := (*asked)[0]
	if p.Current != "1.4.0" || p.Latest != "1.5.0" || p.ReleaseURL == "" || p.Jobs != 2 {
		t.Fatalf("%+v", p)
	}

	o, inst, n, _ := newOffer(true, nil, found)
	if err := o.LookForUpdates(context.Background()); err != nil {
		t.Fatal(err)
	}
	if inst.calls != 1 || len(n.titles) != 1 || n.titles[0] != "Updating to 1.5.0" || !strings.Contains(n.bodies[0], "running jobs") {
		t.Fatalf("Install now: installs=%d %v", inst.calls, n.titles)
	}
}

func TestLookForUpdatesWithoutDialogNeverInstalls(t *testing.T) {
	o, inst, n, _ := newOffer(true, ErrNoDialog, found)
	if err := o.LookForUpdates(context.Background()); err == nil || inst.calls != 0 || len(n.titles) != 1 {
		t.Fatalf("a missing dialog must not count as yes: err=%v installs=%d", err, inst.calls)
	}
	o.Ask = nil
	n.titles = nil
	if err := o.LookForUpdates(context.Background()); err != nil || inst.calls != 0 || len(n.titles) != 1 {
		t.Fatalf("no asker: err=%v installs=%d", err, inst.calls)
	}
}

func TestInstallNowFailureIsSaid(t *testing.T) {
	o, inst, n, _ := newOffer(true, nil, found)
	inst.err = errors.New("busy")
	if err := o.LookForUpdates(context.Background()); err == nil || n.titles[len(n.titles)-1] != "Could not start the update" {
		t.Fatalf("%v %v", err, n.titles)
	}
}

func TestUpToDateAndAlreadyUpdatingAskNothing(t *testing.T) {
	o, inst, n, asked := newOffer(true, nil, Status{})
	_ = o.LookForUpdates(context.Background())
	if len(*asked) != 0 || inst.calls != 0 || n.titles[0] != "Up to date" || !strings.Contains(n.bodies[0], "newest stable release") {
		t.Fatalf("%v", n.titles)
	}
	busy := found
	busy.Update.State = "waiting_for_jobs"
	o, inst, n, asked = newOffer(true, nil, busy)
	_ = o.LookForUpdates(context.Background())
	if len(*asked) != 0 || inst.calls != 0 || n.titles[0] != "Already updating" {
		t.Fatalf("%v", n.titles)
	}
}

func TestPromptBodyNamesVersionsAndJobCount(t *testing.T) {
	for _, c := range []struct {
		jobs int
		want string
	}{{0, "installs at once"}, {1, "1 job is running"}, {3, "3 jobs are running"}} {
		b := UpdatePrompt{Current: "1.4.0", Latest: "1.5.0", Jobs: c.jobs}.Body()
		if !strings.Contains(b, "1.4.0") || !strings.Contains(b, "1.5.0") || !strings.Contains(b, c.want) {
			t.Errorf("%d: %q", c.jobs, b)
		}
		if c.jobs > 0 && !strings.Contains(b, "waits") {
			t.Errorf("a drain must be mentioned: %q", b)
		}
	}
}

// A found update is offered once per version, only when it needs a yes (auto-update off).
func TestOfferedOncePerVersion(t *testing.T) {
	f := &Offered{}
	off := Status{Update: UpdateInfo{Latest: "1.5.0", Available: true, AutoOff: true}}
	if !f.Due(off) || f.Due(off) {
		t.Fatal("offer once")
	}
	off.Update.Latest = "1.6.0"
	if !f.Due(off) {
		t.Fatal("a newer version is offered again")
	}
	if (&Offered{}).Due(Status{Update: UpdateInfo{Latest: "1.5.0", Available: true}}) {
		t.Fatal("auto-update on: the service installs by itself, no offer")
	}
	run := off
	run.Update.State = "installing"
	if (&Offered{}).Due(run) {
		t.Fatal("no offer while updating")
	}
}

// A second press while a dialog is open starts no second dialog (TRAY2).
func TestOfferWhileDialogOpenAsksOnce(t *testing.T) {
	release, started := make(chan struct{}), make(chan struct{})
	calls := 0
	o := &Opener{Version: "1.4.0", Notify: func(string, string) {}, Installer: &fakeInstaller{},
		Ask: func(UpdatePrompt, Launcher) (bool, error) {
			calls++
			close(started)
			<-release
			return false, nil
		}}
	done := make(chan error)
	go func() { done <- o.Offer(context.Background(), found) }()
	<-started
	if err := o.Offer(context.Background(), found); err != nil || calls != 1 {
		t.Fatalf("second Offer: err=%v calls=%d", err, calls)
	}
	close(release)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	o.Ask = func(UpdatePrompt, Launcher) (bool, error) { calls++; return false, nil }
	_ = o.Offer(context.Background(), found)
	if calls != 2 {
		t.Fatalf("after the answer a new dialog may open: calls=%d", calls)
	}
}
