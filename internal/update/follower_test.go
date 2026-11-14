package update

import (
	"context"
	"testing"
	"time"
)

type fakeFleet struct {
	agents []Agent
	asked  map[string][]string
}

func (f *fakeFleet) Agents(context.Context) ([]Agent, error) { return f.agents, nil }
func (f *fakeFleet) AskUpdate(id, v string) error {
	if f.asked == nil {
		f.asked = map[string][]string{}
	}
	f.asked[id] = append(f.asked[id], v)
	return nil
}

func TestFollowerAsksOnlyOlderStableAgents(t *testing.T) {
	now := time.Now()
	fl := &fakeFleet{agents: []Agent{
		{ID: "old", Version: "1.4.0"},
		{ID: "same", Version: "1.5.0"},
		{ID: "newer", Version: "1.6.0"},
		{ID: "dev", Version: "dev"},
		{ID: "busy", Version: "1.4.0", Updating: true, UpdatingSince: now.Add(-10 * time.Minute)},
		{ID: "stale", Version: "1.4.0", Updating: true, UpdatingSince: now.Add(-3 * time.Hour)},
	}}
	f := &Follower{Fleet: fl, Current: "1.5.0", Now: func() time.Time { return now }}
	got := f.Tick(context.Background())
	if len(got) != 2 || got[0] != "old" || got[1] != "stale" {
		t.Fatalf("asked %v", got)
	}
	if fl.asked["old"][0] != "1.5.0" {
		t.Fatalf("the ask carries the controller's version: %v", fl.asked)
	}
	for _, id := range []string{"same", "newer", "dev", "busy"} {
		if len(fl.asked[id]) != 0 {
			t.Errorf("%s must not be asked", id)
		}
	}
	// The next tick asks the postponed one again.
	f.Tick(context.Background())
	if len(fl.asked["old"]) != 2 {
		t.Fatalf("asked again at the next tick: %v", fl.asked["old"])
	}
}

func TestFollowerStaysQuietForADevController(t *testing.T) {
	fl := &fakeFleet{agents: []Agent{{ID: "a", Version: "1.4.0"}}}
	for _, cur := range []string{"dev", "edge-abc1234", ""} {
		if got := (&Follower{Fleet: fl, Current: cur}).Tick(context.Background()); len(got) != 0 {
			t.Fatalf("%q asked %v", cur, got)
		}
	}
}
