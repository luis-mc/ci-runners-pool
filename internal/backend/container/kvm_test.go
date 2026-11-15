package container

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"
)

// TestKVMDeviceOnlyAndLabelNeedsUsable: runners R5.41, R6.1.
func TestKVMDeviceOnlyAndLabelNeedsUsable(t *testing.T) {
	args := KVMArgs(993)
	if strings.Join(args, " ") != "--device /dev/kvm --group-add 993" {
		t.Errorf("args %v", args)
	}
	if got := KVMArgs(0); strings.Join(got, " ") != "--device /dev/kvm" {
		t.Errorf("no gid: %v", got)
	}
	// The guard of pool.go wants the whole call: the job user and no capability.
	safe := []string{"run", "-d", "--user", "1001:1001", "--cap-drop", "ALL", "--security-opt", "no-new-privileges"}
	if err := CheckRunArgs(append(append([]string{}, safe...), append(args, "img")...)); err != nil {
		t.Errorf("kvm device refused: %v", err)
	}
	for _, bad := range [][]string{
		{"--privileged"}, {"--privileged=true"}, {"--pid=host"}, {"--net=host"}, {"--network", "host"},
		{"--ipc", "host"}, {"--device", "/dev/sda"},
	} {
		if err := CheckRunArgs(append(append([]string{}, safe...), append(bad, "img")...)); err == nil {
			t.Errorf("%v accepted", bad)
		}
	}
	if !errors.Is(CheckRunArgs(append(append([]string{}, safe...), "--privileged", "img")), ErrPrivileged) {
		t.Error("privileged error not ErrPrivileged")
	}
	cases := []struct {
		exists, usable, waited bool
		device, label          bool
		reason                 string
	}{
		{true, true, false, true, true, ""},
		{true, false, false, false, false, ReasonKVMNotUsable},
		{false, false, false, false, false, ReasonKVMNone},
		{false, false, true, false, false, ReasonKVMWaitedOut},
	}
	for _, c := range cases {
		d := DecideKVM(c.exists, c.usable, c.waited)
		if d.Device != c.device || d.Label != c.label || d.Reason != c.reason {
			t.Errorf("%+v -> %+v", c, d)
		}
	}
}

func TestKVMWaitIsBoundedAndStartsWithoutKVM(t *testing.T) {
	var slept time.Duration
	var logged []string
	w := KVMWait{
		Exists:   func() bool { return false },
		Sleep:    func(_ context.Context, d time.Duration) { slept += d },
		Interval: 2 * time.Second, Bound: 10 * time.Second,
		Log: func(m string) { logged = append(logged, m) },
	}
	if w.Wait(context.Background()) {
		t.Fatal("appeared")
	}
	if slept != 10*time.Second {
		t.Errorf("slept %s, want the bound", slept)
	}
	if len(logged) != 1 || !strings.Contains(logged[0], "starting without KVM") {
		t.Errorf("log %v", logged)
	}
	if d := DecideKVM(false, false, true); d.Label || d.Device {
		t.Errorf("after the wait: %+v", d)
	}

	// The device appears after a few looks: no log, and the wait ends early.
	looks := 0
	slept, logged = 0, nil
	w.Exists = func() bool { looks++; return looks > 3 }
	if !w.Wait(context.Background()) {
		t.Fatal("did not see the device")
	}
	if slept != 6*time.Second || len(logged) != 0 {
		t.Errorf("slept %s log %v", slept, logged)
	}

	// A cancelled context ends the wait.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	w.Exists = func() bool { return false }
	if w.Wait(ctx) {
		t.Error("cancelled wait reported the device")
	}
}

func TestLoaderModuleByVendor(t *testing.T) {
	for in, want := range map[string]string{
		"processor : 0\nvendor_id\t: GenuineIntel\n": "kvm_intel",
		"vendor_id\t: AuthenticAMD":                  "kvm_amd",
		"vendor_id\t: Other":                         "",
		"":                                           "",
	} {
		if got := LoaderModule(in); got != want {
			t.Errorf("%q -> %q", in, got)
		}
	}
}

// TestComposeKVMLoaderOnlyPrivileged: only the loader is privileged; the pool
// gets /dev/kvm as a device, the loader restarts unless stopped, and the pool
// waits for the device (handover lesson 25).
func TestComposeKVMLoaderOnlyPrivileged(t *testing.T) {
	b, err := os.ReadFile("../../../images/layers/compose.kvm.yaml")
	if err != nil {
		t.Fatal(err)
	}
	c := string(b)
	if strings.Count(c, "privileged: true") != 1 {
		t.Errorf("want exactly one privileged service (the loader), got %d", strings.Count(c, "privileged: true"))
	}
	poolAt := strings.Index(c, "\n  pool:")
	if poolAt < 0 || strings.Contains(c[poolAt:], "privileged") {
		t.Error("the pool must not be privileged")
	}
	for _, want := range []string{"kvm-loader:", "restart: unless-stopped", "modprobe", "kvm_intel", "kvm_amd",
		"/dev/kvm:/dev/kvm", "kvm-wait.sh", "network_mode: none"} {
		if !strings.Contains(c, want) {
			t.Errorf("compose.kvm.yaml lacks %q", want)
		}
	}
	if strings.Contains(c, "docker.sock") || strings.Contains(c, "pid: host") {
		t.Error("socket or host pid in the compose file")
	}
}

func TestKVMWaitScriptBounded(t *testing.T) {
	b, err := os.ReadFile("../../../images/layers/kvm/kvm-wait.sh")
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	for _, want := range []string{"CRSP_KVM_WAIT_SECONDS:-60", "-lt \"$bound\"", "starting without KVM", "exec \"$@\""} {
		if !strings.Contains(s, want) {
			t.Errorf("kvm-wait.sh lacks %q", want)
		}
	}
	if strings.Contains(s, "modprobe") || strings.Contains(s, "sudo") {
		t.Error("the wait script must not load modules or escalate")
	}
}
