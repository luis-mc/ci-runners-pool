package main

import (
	"context"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
	"github.com/luis-mc/ci-runners-shared-pool/internal/repos"
)

type fakeMachines struct{ views []machines.View }

func (f fakeMachines) List(context.Context) ([]machines.View, error) { return f.views, nil }

func linuxView(allowed, usable bool) machines.View {
	return machines.View{
		Machine:  machines.Machine{ID: "m1", OS: "linux", Arch: "x64", IsController: true, Online: true, State: machines.StateActive},
		Settings: machines.Settings{State: machines.StateActive, JobSlots: 2},
		Backends: []machines.BackendView{
			{Backend: machines.Backend{Name: "persistent", Present: true, Usable: true}, Allowed: true},
			{Backend: machines.Backend{Name: "docker", Present: true, Usable: usable}, Allowed: allowed},
		},
	}
}

// R5.27, R5.9: a machine takes container runners only when its allow list
// names docker; a default machine (persistent only) takes none.
func TestHostsFollowTheAllowList(t *testing.T) {
	ctx := context.Background()
	hosts := func(v machines.View) []string {
		h, err := demandEnv{machines: fakeMachines{[]machines.View{v}}}.Hosts(ctx)
		if err != nil {
			t.Fatal(err)
		}
		var ids []string
		for _, x := range h {
			ids = append(ids, x.MachineID)
		}
		return ids
	}
	if got := hosts(linuxView(false, true)); len(got) != 0 {
		t.Fatalf("not allowed: %v", got)
	}
	if got := hosts(linuxView(true, false)); len(got) != 0 {
		t.Fatalf("not usable: %v", got)
	}
	if got := hosts(linuxView(true, true)); len(got) != 1 || got[0] != "m1" {
		t.Fatalf("allowed: %v", got)
	}
	for name, mod := range map[string]func(*machines.View){
		"not the controller": func(v *machines.View) { v.Machine.IsController = false },
		"offline":            func(v *machines.View) { v.Machine.Online = false },
		"windows":            func(v *machines.View) { v.Machine.OS = "windows" },
		"draining":           func(v *machines.View) { v.Settings.State = machines.StateDraining },
		"no slots":           func(v *machines.View) { v.Settings.JobSlots = 0 },
	} {
		v := linuxView(true, true)
		mod(&v)
		if got := hosts(v); len(got) != 0 {
			t.Errorf("%s: %v", name, got)
		}
	}
	h, _ := demandEnv{machines: fakeMachines{[]machines.View{linuxView(true, true)}}}.Hosts(ctx)
	if h[0].Slots != 2 || h[0].Arch != "x64" {
		t.Fatalf("slot budget and arch: %+v", h[0])
	}
}

func TestRepoNeedsThePoolOn(t *testing.T) {
	ctx := context.Background()
	st := repos.NewMemStore()
	_ = st.UpsertRepository(ctx, repos.Repository{ID: 7, InstallationID: 1, FullName: "alice/demo", Owner: "alice", Name: "demo"})
	_ = st.UpsertRepository(ctx, repos.Repository{ID: 8, InstallationID: 1, FullName: "alice/off", Owner: "alice", Name: "off"})
	_ = st.SetRepositoryPool(ctx, 7, true, "t", time.Now())
	pol := repos.DefaultPolicy()
	pol.AllowForkPRs = true
	_ = st.UpsertPolicy(ctx, 7, pol)
	env := demandEnv{repos: st}
	r, on, err := env.Repo(ctx, "Alice/Demo")
	if err != nil || !on || r.Scope.RepositoryID != 7 || !r.AllowFork {
		t.Fatalf("pool on: %+v %v %v", r, on, err)
	}
	if _, on, _ := env.Repo(ctx, "alice/off"); on {
		t.Fatal("pool off")
	}
	if _, on, _ := env.Repo(ctx, "alice/none"); on {
		t.Fatal("unknown")
	}
}
