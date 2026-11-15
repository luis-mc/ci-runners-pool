package container

import (
	"errors"
	"strings"
	"testing"
)

func TestCrspMountedReadOnlyNoSocket(t *testing.T) {
	args, err := CrspMountArgs("/opt/crsp/crsp-linux")
	if err != nil {
		t.Fatal(err)
	}
	got := strings.Join(args, " ")
	for _, want := range []string{"type=bind", "source=/opt/crsp/crsp-linux", "target=/usr/local/bin/crsp", "readonly"} {
		if !strings.Contains(got, want) {
			t.Errorf("%q lacks %q", got, want)
		}
	}
	if _, err := CrspMountArgs("C:\\crsp\\crsp-linux"); err != nil {
		t.Errorf("windows path: %v", err)
	}
	for _, bad := range []string{"/var/run/docker.sock", "/run/podman/podman.sock", "\\\\.\\pipe\\docker_engine", ""} {
		if _, err := CrspMountArgs(bad); err == nil {
			t.Errorf("%q accepted", bad)
		}
	}
	if _, err := CrspMountArgs("/run/docker.sock"); !errors.Is(err, ErrSocketMount) {
		t.Errorf("err %v", err)
	}
	if _, err := CrspMountArgs("/a,b"); err == nil {
		t.Error("comma accepted")
	}
}
