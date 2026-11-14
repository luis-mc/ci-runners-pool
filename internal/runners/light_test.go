package runners

import (
	"context"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/slots"
)

type fakeLightPlacer map[string][]LightHost

func (f fakeLightPlacer) LightHosts(_ context.Context, os string) ([]LightHost, error) {
	return f[os], nil
}

func TestLightNamePrefixMatchesGate(t *testing.T) { // scheduling R5.65
	if LightNamePrefix != slots.LightRunnerPrefix {
		t.Fatalf("%q != %q", LightNamePrefix, slots.LightRunnerPrefix)
	}
	if !IsLightName("crsp-light-demo-linux") || IsLightName("box-1") {
		t.Fatal("IsLightName")
	}
}

func TestEnsureLightPlacesOneRunnerPerOS(t *testing.T) { // scheduling R5.65
	r := newRig(machine("linux", "x64", true))
	r.svc.Light = fakeLightPlacer{"linux": {{MachineID: "m1", LightSlots: 1}}}
	ctx := context.Background()
	res, err := r.svc.EnsureLight(ctx, 1, "demo", []string{"linux"}, "luis-mc")
	if err != nil || len(res) != 1 || !res[0].Added || res[0].Runner != "crsp-light-demo-linux" {
		t.Fatalf("%+v %v", res, err)
	}
	if len(r.ag.added) != 1 {
		t.Fatalf("added %d", len(r.ag.added))
	}
	labels := strings.Join(r.ag.added[0].Labels, ",")
	if !strings.Contains(labels, LightLabel) || !strings.Contains(labels, "self-hosted") {
		t.Fatalf("labels %s", labels)
	}
	// Again: nothing new.
	res, err = r.svc.EnsureLight(ctx, 1, "demo", []string{"linux"}, "luis-mc")
	if err != nil || res[0].Added || res[0].Runner == "" || len(r.ag.added) != 1 {
		t.Fatalf("second call %+v %v", res, err)
	}
	if got, _ := r.svc.LightRunners(ctx, 1); len(got) != 1 {
		t.Fatalf("light runners %d", len(got))
	}
}

func TestEnsureLightSaysWhyNot(t *testing.T) { // scheduling R5.65
	r := newRig(machine("linux", "x64", true))
	r.svc.Light = fakeLightPlacer{}
	res, err := r.svc.EnsureLight(context.Background(), 1, "demo", []string{"linux", "windows"}, "luis-mc")
	if err != nil || len(res) != 2 {
		t.Fatalf("%+v %v", res, err)
	}
	for _, x := range res {
		if x.Runner != "" || !strings.Contains(x.Why, "light slot") {
			t.Fatalf("%+v", x)
		}
	}
	if len(r.ag.added) != 0 {
		t.Fatal("nothing added")
	}
}

func TestRemoveLightDrainsEachRunner(t *testing.T) { // scheduling R5.65
	r := newRig(machine("linux", "x64", true))
	r.svc.Light = fakeLightPlacer{"linux": {{MachineID: "m1", LightSlots: 1}}}
	r.svc.Background = func(f func()) { f() }
	ctx := context.Background()
	if _, err := r.svc.EnsureLight(ctx, 1, "demo", []string{"linux"}, "luis-mc"); err != nil {
		t.Fatal(err)
	}
	names, err := r.svc.RemoveLight(ctx, 1, "luis-mc")
	if err != nil || len(names) != 1 {
		t.Fatalf("%v %v", names, err)
	}
	if got, _ := r.svc.LightRunners(ctx, 1); len(got) != 0 {
		t.Fatalf("still there: %+v", got)
	}
	if len(r.ag.removed) != 1 {
		t.Fatalf("removed %d", len(r.ag.removed))
	}
}
