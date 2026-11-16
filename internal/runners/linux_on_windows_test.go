package runners

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
)

// winDockerMachine is a Windows machine with Docker Desktop: persistent runner
// allowed, container backend usable, and the engine's container OS as given.
func winDockerMachine(containerOS string, dockerAllowed bool) Machine {
	m := machine("windows", "x64", true)
	m.ContainerOS = containerOS
	os := "windows"
	if containerOS != "" {
		os = containerOS
	}
	m.Backends = append(m.Backends, BackendOption{Name: backend.Docker, Usable: true, Allowed: dockerAllowed,
		Kinds: []string{"ephemeral"}, OS: []string{os}})
	return m
}

// CRSP127, R5.47: a Windows machine whose engine runs Linux containers takes a
// Linux container runner (self-hosted, linux, x64 and the pool label); a
// Windows machine without such an engine refuses Linux.
func TestLinuxOfferedOnWindowsWithLinuxContainers(t *testing.T) {
	ctx := context.Background()
	req := AddRequest{OS: "linux", Kind: "ephemeral", MachineID: "m1", Count: 1, Scope: repoScope}

	r := newRig(winDockerMachine("linux", true))
	p, err := r.svc.PlanAdd(ctx, req, "u")
	if err != nil {
		t.Fatal(err)
	}
	a := p.Adds[0]
	if a.Backend != "docker" || a.OS != "linux" || a.Kind != "ephemeral" {
		t.Fatalf("spec %+v", a)
	}
	if got := strings.Join(a.Labels, ","); got != "linux,pool-a,self-hosted,x64" {
		t.Fatalf("labels %s", got)
	}
	if !strings.Contains(p.Steps[0].Text, "Linux") || !strings.Contains(p.Steps[0].Text, "container") {
		t.Fatalf("text %q", p.Steps[0].Text)
	}

	// Windows without an engine that runs Linux containers: refused.
	for name, m := range map[string]Machine{
		"no engine":          winDockerMachine("", true),
		"windows containers": winDockerMachine("windows", true),
	} {
		_, err := newRig(m).svc.PlanAdd(ctx, req, "u")
		var re *RefusalError
		if !errors.As(err, &re) {
			t.Errorf("%s: %v", name, err)
		}
	}
	// The container backend is off by default: refused, naming it.
	_, err = newRig(winDockerMachine("linux", false)).svc.PlanAdd(ctx, req, "u")
	var re *RefusalError
	if !errors.As(err, &re) || !strings.Contains(re.Reason, "container backend is not allowed") {
		t.Fatalf("not allowed: %v", err)
	}
	// A persistent Linux runner cannot be made on Windows.
	req.Kind = "persistent"
	if _, err = newRig(winDockerMachine("linux", true)).svc.PlanAdd(ctx, req, "u"); !errors.As(err, &re) || !strings.Contains(re.Reason, "ephemeral") {
		t.Fatalf("persistent: %v", err)
	}
	// Windows runners on that machine keep working as before.
	req.OS = "windows"
	if p, err := newRig(winDockerMachine("linux", true)).svc.PlanAdd(ctx, req, "u"); err != nil || p.Adds[0].Backend != "persistent" {
		t.Fatalf("windows runner: %+v %v", p, err)
	}
}
