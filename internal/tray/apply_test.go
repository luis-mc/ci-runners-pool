package tray

import (
	"reflect"
	"sync/atomic"
	"testing"
)

// fakeSurface records every call the tray makes on the live menu (TRAY6).
type fakeSurface struct{ calls []string }

func (f *fakeSurface) SetTitle(id, t string) { f.calls = append(f.calls, "title "+id+" "+t) }
func (f *fakeSurface) SetVisible(id string, v bool) {
	if v {
		f.calls = append(f.calls, "show "+id)
	} else {
		f.calls = append(f.calls, "hide "+id)
	}
}
func (f *fakeSurface) SetChecked(id string, c bool) {
	if c {
		f.calls = append(f.calls, "check "+id)
	} else {
		f.calls = append(f.calls, "uncheck "+id)
	}
}
func (f *fakeSurface) SetTooltip(t string) { f.calls = append(f.calls, "tip "+t) }
func (f *fakeSurface) SetIcon(s State)     { f.calls = append(f.calls, "icon "+string(s)) }

func newApplier(open *atomic.Bool) (*Applier, *fakeSurface, Status) {
	f := &fakeSurface{}
	build := func(s Status) []MenuItem { return BuildMenu("1.4.0", s, false) }
	first := Status{State: StateHealthy, Running: 1, Runners: 2, Version: "1.4.0", Update: UpdateInfo{State: "idle"},
		Policy: MachinePolicy{Known: true, Mode: ModeAutomatic, Accepting: true}}
	a := &Applier{Surf: f, Build: build, Open: open.Load}
	a.Seed(build(first), first)
	return a, f, first
}

// TRAY6: a status change while the menu is open touches nothing; it applies once, after the menu closes.
func TestStatusWhileMenuOpenIsQueuedAndAppliedAfterClose(t *testing.T) {
	var open atomic.Bool
	a, f, first := newApplier(&open)
	open.Store(true)
	next := first
	next.Running = 3
	next.Update = UpdateInfo{State: "idle", Available: true, Latest: "1.5.0"}
	a.Update(next)
	next.State = StateStopped
	a.Update(next) // the newest wins
	if len(f.calls) != 0 || !a.Pending() {
		t.Fatalf("menu open: want no call and a queued status, got %v pending=%v", f.calls, a.Pending())
	}
	if a.Flush() || len(f.calls) != 0 {
		t.Fatalf("flush while open must do nothing, got %v", f.calls)
	}
	open.Store(false)
	if !a.Flush() || a.Pending() {
		t.Fatal("flush after close must apply the queue")
	}
	want := string(StateStopped)
	if f.calls[len(f.calls)-1] != "icon "+want {
		t.Fatalf("the newest status must be the one shown, got %v", f.calls)
	}
	n := len(f.calls)
	if a.Flush() || len(f.calls) != n {
		t.Fatal("a second flush must do nothing")
	}
}

// TRAY6: with the menu closed a status applies at once, and only what changed is touched.
func TestOnlyChangedItemsAreTouched(t *testing.T) {
	var open atomic.Bool
	a, f, first := newApplier(&open)
	a.Update(first)
	if len(f.calls) != 0 {
		t.Fatalf("same status must change nothing, got %v", f.calls)
	}
	next := first
	next.Running = 4
	a.Update(next)
	for _, c := range f.calls {
		if c == "show "+IDUpdate || c == "hide "+IDUpdate || c == "icon "+string(first.State) {
			t.Fatalf("untouched item was written: %v", f.calls)
		}
	}
	if len(f.calls) == 0 {
		t.Fatal("changed counts must reach the status line and tooltip")
	}
	a.Update(next)
	n := len(f.calls)
	a.Update(next)
	if len(f.calls) != n {
		t.Fatalf("repeat status wrote again: %v", f.calls[n:])
	}
}

// TRAY6: an update found shows the update item once, in place.
func TestUpdateItemShownInPlace(t *testing.T) {
	var open atomic.Bool
	a, f, first := newApplier(&open)
	first.Update = UpdateInfo{State: "idle", Available: true, Latest: "1.5.0"}
	a.Update(first)
	if !reflect.DeepEqual(filter(f.calls, "show "+IDUpdate), []string{"show " + IDUpdate}) {
		t.Fatalf("want the update item shown once, got %v", f.calls)
	}
}

func filter(in []string, want string) []string {
	var out []string
	for _, c := range in {
		if c == want {
			out = append(out, c)
		}
	}
	return out
}
