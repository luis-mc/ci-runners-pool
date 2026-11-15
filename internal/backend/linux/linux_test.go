package linux

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/persistent"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys/sysfake"
	"github.com/luis-mc/ci-runners-shared-pool/internal/runners"
)

type rig struct {
	b    *Backend
	cmd  *sysfake.Commands
	fs   *sysfake.FS
	body []byte
}

func newRig() *rig {
	r := &rig{cmd: &sysfake.Commands{}, fs: sysfake.NewFS(), body: []byte("tarball")}
	fe := &sysfake.Fetcher{FS: r.fs, Body: r.body}
	verify := func(path, want string) error {
		d, _ := r.fs.ReadFile(path)
		sum := sha256.Sum256(d)
		if hex.EncodeToString(sum[:]) != want {
			return runners.ErrHashMismatch
		}
		return nil
	}
	// getent finds nothing: group and user are new.
	r.cmd.Rules = []sysfake.Rule{{Match: "getent", Result: sys.Result{ExitCode: 2}}}
	r.b = New(sys.Deps{Cmd: r.cmd, FS: r.fs, Fetch: fe, Verify: verify}, Config{})
	return r
}

func (r *rig) spec() backend.RunnerSpec {
	sum := sha256.Sum256(r.body)
	return backend.RunnerSpec{ID: "r1", Name: "box-1", OS: "linux", Arch: "x64",
		Labels: []string{"self-hosted", "linux", "x64"}, GitHubURL: "https://github.com/luis-mc/demo",
		RunnerVersion: "2.330.0", RunnerSHA256: hex.EncodeToString(sum[:])}
}

func (r *rig) index(prefix string) int {
	for i, t := range r.cmd.Texts() {
		if strings.HasPrefix(t, prefix) {
			return i
		}
	}
	return -1
}

func started(t *testing.T) *rig {
	t.Helper()
	r := newRig()
	if _, err := r.b.Start(context.Background(), r.spec(), backend.StartConfig{Registration: "REGTOKEN"}); err != nil {
		t.Fatal(err)
	}
	return r
}

// R5.21: its own system user, no login shell, no password, no sudo, in the
// group crsp-runners.
func TestUnitUserAndGroup(t *testing.T) {
	r := started(t)
	if r.index("groupadd --system crsp-runners") < 0 {
		t.Errorf("group not made: %v", r.cmd.Texts())
	}
	i := r.index("useradd")
	if i < 0 {
		t.Fatal("no useradd")
	}
	add := r.cmd.Texts()[i]
	for _, want := range []string{"--system", "--gid crsp-runners", "--shell /usr/sbin/nologin", "--no-create-home", "crsp-box-1"} {
		if !strings.Contains(add, want) {
			t.Errorf("useradd lacks %s: %s", want, add)
		}
	}
	for _, c := range r.cmd.Texts() {
		for _, bad := range []string{"passwd", "chpasswd", "sudo", "sudoers", "usermod", "wheel", "adm"} {
			if strings.Contains(c, bad) && !strings.HasPrefix(c, "getent passwd") {
				t.Errorf("call %q must not give a password or rights", c)
			}
		}
	}
	unit := string(r.fs.Files["/etc/systemd/system/actions.runner.luis-mc-demo.box-1.service"])
	if !strings.Contains(unit, "User=crsp-box-1\n") || !strings.Contains(unit, "Group=crsp-runners\n") {
		t.Errorf("unit:\n%s", unit)
	}
}

// R5.22: hardening and folder mode; hooks call /usr/local/bin/crsp.
func TestUnitHardeningAndFolderMode(t *testing.T) {
	r := started(t)
	unit := string(r.fs.Files["/etc/systemd/system/actions.runner.luis-mc-demo.box-1.service"])
	for _, want := range []string{"NoNewPrivileges=yes", "PrivateTmp=yes", "ProtectSystem=strict",
		"ReadWritePaths=/var/lib/crsp/runners/box-1", "Restart=on-failure"} {
		if !strings.Contains(unit, want+"\n") {
			t.Errorf("unit lacks %s", want)
		}
	}
	if r.index("chmod 0700 /var/lib/crsp/runners/box-1") < 0 {
		t.Errorf("folder mode: %v", r.cmd.Texts())
	}
	if r.index("chown -R crsp-box-1:crsp-runners /var/lib/crsp/runners/box-1") < 0 {
		t.Error("folder owner")
	}
	for _, n := range []string{"job-started", "job-completed"} {
		p := "/var/lib/crsp/runners/box-1/hooks/" + n + ".sh"
		body := string(r.fs.Files[p])
		if !strings.Contains(body, "/usr/local/bin/crsp") {
			t.Errorf("%s does not call /usr/local/bin/crsp", p)
		}
		if r.fs.Modes[p] != 0o700 {
			t.Errorf("%s mode %o", p, r.fs.Modes[p])
		}
	}
	env := string(r.fs.Files["/var/lib/crsp/runners/box-1/.env"])
	if !strings.Contains(env, "ACTIONS_RUNNER_HOOK_JOB_STARTED=/var/lib/crsp/runners/box-1/hooks/job-started.sh") {
		t.Errorf(".env:\n%s", env)
	}
	for _, want := range []string{"CI_TOOLS_DIR=/var/lib/crsp/runners/box-1/cache/tools\n", "CI_TOOLS_QUOTA_GIB=20\n", "CRSP_RUST_CACHE_CAP_GIB=40\n",
		"RUSTUP_HOME=/var/lib/crsp/runners/box-1/cache/tools/rustup\n", "CARGO_HOME=/var/lib/crsp/runners/box-1/cache/tools/cargo\n"} {
		if !strings.Contains(env, want) {
			t.Errorf(".env lacks %q:\n%s", want, env)
		}
	}
	if i, j := r.index("systemctl daemon-reload"), r.index("systemctl enable --now"); i < 0 || j < i {
		t.Error("daemon-reload then enable --now")
	}
}

// R6.2: the token is in the environment of the one process only; self-update off.
func TestTokenOnlyInEnvAndUpdateOff(t *testing.T) {
	r := started(t)
	n := 0
	for _, c := range r.cmd.Calls {
		if strings.Contains(c.String(), "REGTOKEN") {
			t.Error("token in an argument")
		}
		if c.SecretEnv["ACTIONS_RUNNER_INPUT_TOKEN"] == "REGTOKEN" {
			n++
			if c.Name != "runuser" || !strings.Contains(c.String(), "-u crsp-box-1 --") || !strings.Contains(c.String(), "--disableupdate") {
				t.Errorf("configure call: %s", c.String())
			}
		}
	}
	if n != 1 {
		t.Errorf("token reached %d processes", n)
	}
	for name, d := range r.fs.Files {
		if strings.Contains(string(d), "REGTOKEN") {
			t.Errorf("token written to %s", name)
		}
	}
}

func TestRerunAlreadyAndStaleEnv(t *testing.T) {
	r := started(t)
	r.cmd.Calls = nil
	if _, err := r.b.Start(context.Background(), r.spec(), backend.StartConfig{Registration: "REGTOKEN"}); err != nil {
		t.Fatal(err)
	}
	if len(r.cmd.Calls) != 0 {
		t.Errorf("already: %v", r.cmd.Texts())
	}
	r.fs.Files["/var/lib/crsp/runners/box-1/.env"] = []byte("stale\n")
	if _, err := r.b.Start(context.Background(), r.spec(), backend.StartConfig{Registration: "REGTOKEN"}); err != nil {
		t.Fatal(err)
	}
	if r.index("systemctl stop actions.runner.luis-mc-demo.box-1.service") < 0 || r.index("systemctl start actions.runner.luis-mc-demo.box-1.service") < r.index("pgrep") || r.index("useradd") >= 0 || r.index("runuser") >= 0 {
		t.Errorf("stale env: %v", r.cmd.Texts())
	}
}

func TestReregisterRemovesFirstAndStopsOnFailure(t *testing.T) {
	r := started(t)
	meta, _ := persistent.ReadMeta(r.fs, "/var/lib/crsp/runners/box-1/"+persistent.MetaFile)
	meta.Labels = []string{"self-hosted", "linux", "x64", "gpu"}
	_ = persistent.WriteMeta(r.fs, "/var/lib/crsp/runners/box-1/"+persistent.MetaFile, *meta)

	r.cmd.Calls = nil
	r.cmd.Rules = append([]sysfake.Rule{{Match: "runuser -u crsp-box-1 -- /var/lib/crsp/runners/box-1/config.sh remove", Result: sys.Result{ExitCode: 1}}}, r.cmd.Rules...)
	_, err := r.b.Start(context.Background(), r.spec(), backend.StartConfig{Registration: "REG2", Removal: "REMOVETOKEN"})
	if !errors.Is(err, ErrRemovalFailed) {
		t.Fatalf("err = %v", err)
	}
	if r.index("useradd") >= 0 || r.index("chmod") >= 0 || r.index("systemctl disable") >= 0 {
		t.Error("nothing changes after a failed removal")
	}
	if r.index("systemctl start actions.runner.luis-mc-demo.box-1.service") < 0 {
		t.Error("old unit started again")
	}

	r.cmd.Calls, r.cmd.Rules = nil, r.cmd.Rules[1:]
	if _, err := r.b.Start(context.Background(), r.spec(), backend.StartConfig{Registration: "REG2", Removal: "REMOVETOKEN"}); err != nil {
		t.Fatal(err)
	}
	rm, reg := r.index("runuser -u crsp-box-1 -- /var/lib/crsp/runners/box-1/config.sh remove"), r.index("runuser -u crsp-box-1 -- /var/lib/crsp/runners/box-1/config.sh --unattended")
	if rm < 0 || reg < rm {
		t.Errorf("remove at %d, register at %d", rm, reg)
	}
}

func TestWrongHashRefused(t *testing.T) {
	r := newRig()
	spec := r.spec()
	spec.RunnerSHA256 = strings.Repeat("cd", 32)
	_, err := r.b.Start(context.Background(), spec, backend.StartConfig{Registration: "REG"})
	if !errors.Is(err, runners.ErrHashMismatch) {
		t.Fatalf("err = %v", err)
	}
	if r.index("tar") >= 0 || r.index("useradd") >= 0 {
		t.Error("nothing is unpacked or made after a bad hash")
	}
	if len(r.fs.Names()) != 0 {
		t.Errorf("download kept: %v", r.fs.Names())
	}
}

const listOut = "actions.runner.luis-mc-demo.box-1.service enabled enabled\nactions.runner.other-old.hand.service enabled enabled\n"

func TestFindFromUnitList(t *testing.T) {
	r := started(t)
	r.cmd.Rules = []sysfake.Rule{
		{Match: "list-unit-files", Result: sys.Result{Stdout: listOut}},
		{Match: "show actions.runner.luis-mc-demo.box-1.service", Result: sys.Result{Stdout: "User=crsp-box-1\nWorkingDirectory=/var/lib/crsp/runners/box-1\nActiveState=active\n"}},
		{Match: "show actions.runner.other-old.hand.service", Result: sys.Result{Stdout: "User=pi\nWorkingDirectory=\nExecStart={ path=/home/pi/actions-runner/runsvc.sh ; argv[]=/home/pi/actions-runner/runsvc.sh ; }\nActiveState=inactive\n"}},
	}
	found, err := r.b.Find(context.Background())
	if err != nil || len(found) != 2 {
		t.Fatalf("%v %v", found, err)
	}
	if !found[0].Managed || found[0].Account != "crsp-box-1" || !found[0].Running {
		t.Errorf("%+v", found[0])
	}
	if found[1].Managed || found[1].Folder != "/home/pi/actions-runner" || found[1].Account != "pi" || found[1].Running {
		t.Errorf("%+v", found[1])
	}
}

func TestCleanUpTwice(t *testing.T) {
	r := started(t)
	svc := "actions.runner.luis-mc-demo.box-1"
	r.cmd.Rules = []sysfake.Rule{
		{Match: "list-unit-files", Result: sys.Result{Stdout: svc + ".service enabled\n"}},
		{Match: "show " + svc, Result: sys.Result{Stdout: "User=crsp-box-1\nWorkingDirectory=/var/lib/crsp/runners/box-1\nActiveState=active\n"}},
	}
	h := backend.Handle{Ref: svc}
	if err := r.b.CleanUp(context.Background(), h); err != nil {
		t.Fatal(err)
	}
	if r.index("userdel crsp-box-1") < 0 {
		t.Error("user not removed")
	}
	if _, ok := r.fs.Files["/etc/systemd/system/"+svc+".service"]; ok {
		t.Error("unit not removed")
	}
	for n := range r.fs.Files {
		if strings.HasPrefix(n, "/var/lib/crsp/runners/box-1/") {
			t.Errorf("folder file left: %s", n)
		}
	}
	r.cmd.Rules = []sysfake.Rule{{Match: "list-unit-files", Result: sys.Result{}}}
	if err := r.b.CleanUp(context.Background(), h); err != nil {
		t.Fatalf("second CleanUp: %v", err)
	}
}

func TestDetect(t *testing.T) {
	r := newRig()
	r.cmd.Rules = []sysfake.Rule{{Match: "id -u", Result: sys.Result{Stdout: "1000\n"}}}
	s, _ := r.b.Detect(context.Background())
	if s.Usable || s.Reason == "" || !s.Present {
		t.Errorf("%+v", s)
	}
	r.cmd.Rules = []sysfake.Rule{{Match: "id -u", Result: sys.Result{Stdout: "0\n"}}}
	s, _ = r.b.Detect(context.Background())
	if !s.Usable {
		t.Errorf("%+v", s)
	}
	r.cmd.Rules = []sysfake.Rule{{Match: "systemctl --version", Result: sys.Result{ExitCode: 127}}}
	s, _ = r.b.Detect(context.Background())
	if s.Present {
		t.Errorf("%+v", s)
	}
}

// runners R5.46: a listener that outlives its unit blocks the start; crsp never
// starts a second listener for a registered runner.
func TestRestartNeverStartsASecondListener(t *testing.T) {
	r := started(t)
	r.b.d.Sleep = func(context.Context, time.Duration) {}
	r.cmd.Rules = []sysfake.Rule{{Match: "pgrep", Result: sys.Result{Stdout: "4242\n"}}}
	r.fs.Files["/var/lib/crsp/runners/box-1/.env"] = []byte("stale\n")
	r.cmd.Calls = nil
	_, err := r.b.Start(context.Background(), r.spec(), backend.StartConfig{Registration: "REGTOKEN"})
	if !errors.Is(err, persistent.ErrListenerAlive) {
		t.Fatalf("err = %v", err)
	}
	if r.index("systemctl start") >= 0 || r.index("systemctl restart") >= 0 {
		t.Errorf("a service was started beside a live listener: %v", r.cmd.Texts())
	}
}

func TestStopWaitsForTheListenerNotTheUnit(t *testing.T) {
	r := started(t)
	svc := persistent.ServiceName(r.spec().GitHubURL, r.spec().Name)
	r.cmd.Rules = []sysfake.Rule{
		{Match: "list-unit-files", Result: sys.Result{Stdout: svc + ".service enabled\n"}},
		{Match: "systemctl show", Result: sys.Result{Stdout: "User=crsp-box-1\nWorkingDirectory=/var/lib/crsp/runners/box-1\nExecStart={ path=/var/lib/crsp/runners/box-1/bin/runsvc.sh ; }\nActiveState=inactive\n"}},
	}
	if err := r.b.Stop(context.Background(), backend.Handle{Ref: svc}); err != nil {
		t.Fatal(err)
	}
	if r.index("pgrep") < 0 || r.index("pgrep") < r.index("systemctl stop") {
		t.Errorf("Stop must look for the listener after the unit stops: %v", r.cmd.Texts())
	}
}

// R5.56: the tool homes are under the runner's own folder.
func TestToolHomesPerRunner(t *testing.T) {
	r := started(t)
	env := string(r.fs.Files["/var/lib/crsp/runners/box-1/.env"])
	for _, want := range []string{
		"RUSTUP_HOME=/var/lib/crsp/runners/box-1/cache/tools/rustup\n",
		"CARGO_HOME=/var/lib/crsp/runners/box-1/cache/tools/cargo\n",
	} {
		if !strings.Contains(env, want) {
			t.Errorf(".env lacks %q:\n%s", want, env)
		}
	}
}
