package checks

import (
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor"
)

func TestRunnerLightLeftover(t *testing.T) { // OPS49, decision D110
	f := &fleet{
		machines: []doctor.Machine{{ID: "m1", Name: "box", OS: "windows", Online: true}},
		runners: []doctor.Runner{
			{ID: "r1", Name: "crsp-light-comics-organizer-windows", MachineID: "m1", MachineName: "box", LegacyLight: true, LightRemovalProblem: "clean up the service: access denied"},
			{ID: "r2", Name: "crsp-light-home-automation-windows", MachineID: "m1", MachineName: "box", LegacyLight: true}, // not tried yet: nothing to say
			{ID: "r3", Name: "crsp-box-1", MachineID: "m1", MachineName: "box"},
		}}
	fs := run(t, doctor.Env{Fleet: f}, "runner.light_leftover")
	if len(fs) != 1 || fs[0].Severity != doctor.Warn || !strings.Contains(fs[0].Title, "comics-organizer") || !strings.Contains(fs[0].Detail, "access denied") {
		t.Fatalf("%+v", fs)
	}
	f.runners = f.runners[2:]
	if fs := run(t, doctor.Env{Fleet: f}, "runner.light_leftover"); len(fs) != 0 {
		t.Fatalf("none left: %+v", fs)
	}
}
