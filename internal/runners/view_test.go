package runners

import (
	"context"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

func TestTruthMapsGitHubAndServiceToState(t *testing.T) { // UX-19
	on := &github.Runner{Name: "a", Status: "online"}
	run := &backend.Found{Running: true}
	cases := []struct {
		name string
		rec  Record
		f    Facts
		want State
	}{
		{"idle needs online, not busy, running", Record{State: Idle}, Facts{true, on, true, run}, Idle},
		{"busy follows GitHub", Record{State: Idle}, Facts{true, &github.Runner{Status: "online", Busy: true}, true, run}, Busy},
		{"stored idle but not registered", Record{State: Idle}, Facts{true, nil, true, run}, NotRegistered},
		{"stored idle but service stopped", Record{State: Idle}, Facts{true, on, true, &backend.Found{}}, Stopped},
		{"service stopped and not registered shows the cause", Record{State: Idle}, Facts{true, nil, true, &backend.Found{}}, Stopped},
		{"service missing", Record{State: Idle}, Facts{true, on, true, nil}, Stopped},
		{"github offline", Record{State: Idle}, Facts{true, &github.Runner{Status: "offline"}, true, run}, Offline},
		{"github unreadable", Record{State: Idle}, Facts{false, nil, true, run}, Unknown},
		{"service list unknown does not block idle", Record{State: Idle}, Facts{true, on, false, nil}, Idle},
		{"failed stays failed", Record{State: Failed, Reason: "r"}, Facts{true, on, true, run}, Failed},
		{"creating stays", Record{State: Creating}, Facts{}, Creating},
	}
	for _, c := range cases {
		got, why := Truth(c.rec, c.f)
		if got != c.want {
			t.Errorf("%s: %s (%s), want %s", c.name, got, why, c.want)
		}
		if got != Idle && got != Busy && why == "" {
			t.Errorf("%s: %s has no reason", c.name, got)
		}
	}
}

func TestListViewReconcilesAgainstGitHubAndAgent(t *testing.T) { // UX-19
	r := newRig(machine("linux", "x64", true))
	ctx := context.Background()
	rec := r.add(t)
	r.svc.Services = func(context.Context, string) ([]backend.Found, error) {
		return []backend.Found{{ServiceName: rec.ServiceName, Name: rec.Name, Running: false}}, nil
	}
	v, err := r.svc.ListView(ctx, Filter{})
	if err != nil || len(v) != 1 || v[0].State != Stopped || v[0].MachineName != "box" || v[0].Reason == "" {
		t.Fatalf("%+v %v", v, err)
	}
	if v[0].Record.State != Idle {
		t.Fatal("the stored state is not changed")
	}
	r.svc.Services = func(context.Context, string) ([]backend.Found, error) {
		return []backend.Found{{ServiceName: rec.ServiceName, Name: rec.Name, Running: true}}, nil
	}
	if v, _ = r.svc.ListView(ctx, Filter{}); v[0].State != NotRegistered {
		t.Fatalf("GitHub lists nothing: %s", v[0].State)
	}
	r.gh.runners = []github.Runner{{ID: 5, Name: rec.Name, Status: "online"}}
	if g, err := r.svc.GetView(ctx, rec.ID); err != nil || g.State != Idle {
		t.Fatalf("%+v %v", g, err)
	}
}
