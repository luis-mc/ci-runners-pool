package agent_test

import (
	"context"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf16"

	"github.com/luis-mc/ci-runners-shared-pool/internal/agent"
)

type recExec struct {
	cmds  [][]string
	files []agent.File
	failN int
}

func (r *recExec) Run(_ context.Context, argv []string) error {
	r.cmds = append(r.cmds, argv)
	if r.failN > 0 && len(r.cmds) == r.failN {
		return errors.New("boom")
	}
	return nil
}
func (r *recExec) WriteFile(_ context.Context, f agent.File) error {
	r.files = append(r.files, f)
	return nil
}

var opts = agent.InstallOptions{Binary: "/usr/local/bin/crsp", Controller: "pool.lan:8461", Fingerprint: strings.Repeat("ab", 32), JoinCode: "CODE", BackendGroups: []string{"docker", "kvm"}}

// R5.44: the agent runs as its own non-admin account on every OS.
func TestServiceAccounts(t *testing.T) {
	want := map[string]string{"windows": `NT SERVICE\crsp-agent`, "linux": "crsp-agent", "darwin": "_crsp_agent"}
	for goos, acct := range want {
		p, err := agent.BuildInstallPlan(goos, opts)
		if err != nil || p.Account != acct {
			t.Fatalf("%s: %v %q", goos, err, p.Account)
		}
	}
	lin, _ := agent.BuildInstallPlan("linux", opts)
	unit := lin.Steps[len(lin.Steps)-3].Files[0].Body
	if !strings.Contains(unit, "User=crsp-agent") || strings.Contains(unit, "User=root") {
		t.Fatalf("unit:\n%s", unit)
	}
	mac, _ := agent.BuildInstallPlan("darwin", opts)
	if body := mac.Steps[1].Files[0].Body; !strings.Contains(body, "<key>UserName</key><string>_crsp_agent</string>") {
		t.Fatalf("plist:\n%s", body)
	}
	if _, err := agent.BuildInstallPlan("plan9", opts); err == nil {
		t.Fatal("a plan for an unknown OS")
	}
}

// R5.45: before the admin step runs, it lists each admin action and asks for a
// yes. It never runs without that yes.
func TestInstallPlanListsEachAdminActionAndNeedsAYes(t *testing.T) {
	for _, goos := range []string{"linux", "darwin", "windows"} {
		p, _ := agent.BuildInstallPlan(goos, opts)
		var shown string
		ex := &recExec{}
		if err := p.Run(context.Background(), func(d string) bool { shown = d; return false }, ex); !errors.Is(err, agent.ErrNotConfirmed) {
			t.Fatalf("%s: err = %v", goos, err)
		}
		if len(ex.cmds) != 0 || len(ex.files) != 0 {
			t.Fatalf("%s: something ran without a yes: %v %v", goos, ex.cmds, ex.files)
		}
		for i, s := range p.Steps {
			if s.Admin && !strings.Contains(shown, s.What) {
				t.Errorf("%s step %d (%q) is not in the list shown before the yes", goos, i+1, s.What)
			}
		}
		if err := p.Run(context.Background(), nil, ex); !errors.Is(err, agent.ErrNotConfirmed) {
			t.Fatalf("no confirm function must refuse: %v", err)
		}
	}
	lin, _ := agent.BuildInstallPlan("linux", opts)
	ex := &recExec{}
	if err := lin.Run(context.Background(), func(string) bool { return true }, ex); err != nil {
		t.Fatal(err)
	}
	if len(ex.files) != 1 || ex.files[0].Path != "/etc/systemd/system/crsp-agent.service" || len(ex.cmds) < 5 {
		t.Fatalf("files=%v cmds=%v", ex.files, ex.cmds)
	}
	// A failing step stops the plan and names itself.
	ex = &recExec{failN: 2}
	err := lin.Run(context.Background(), func(string) bool { return true }, ex)
	if err == nil || !strings.Contains(err.Error(), "step 2") || len(ex.cmds) != 2 {
		t.Fatalf("err=%v cmds=%d", err, len(ex.cmds))
	}
}

// R5.46: a service that starts at boot and restarts after a crash.
func TestServiceStartsAtBootAndRestartsAfterACrash(t *testing.T) {
	lin, _ := agent.BuildInstallPlan("linux", opts)
	unit := lin.Steps[len(lin.Steps)-3].Files[0].Body
	for _, want := range []string{"Restart=always", "WantedBy=multi-user.target"} {
		if !strings.Contains(unit, want) {
			t.Errorf("unit lacks %s", want)
		}
	}
	mac, _ := agent.BuildInstallPlan("darwin", opts)
	for _, want := range []string{"<key>RunAtLoad</key><true/>", "<key>KeepAlive</key><true/>"} {
		if !strings.Contains(mac.Steps[1].Files[0].Body, want) {
			t.Errorf("plist lacks %s", want)
		}
	}
	win, _ := agent.BuildInstallPlan("windows", opts)
	var all string
	for _, s := range win.Steps {
		for _, c := range s.Commands {
			all += strings.Join(c, " ") + "\n"
		}
	}
	if !strings.Contains(all, "sc.exe failure crsp-agent") || !strings.Contains(all, "restart/5000") {
		t.Fatalf("no restart policy:\n%s", all)
	}
}

func decodePS(t *testing.T, argv []string) string {
	t.Helper()
	if argv[0] != "powershell.exe" || argv[len(argv)-2] != "-EncodedCommand" {
		t.Fatalf("not an encoded PowerShell call: %v", argv)
	}
	raw, err := base64.StdEncoding.DecodeString(argv[len(argv)-1])
	if err != nil {
		t.Fatal(err)
	}
	u := make([]uint16, len(raw)/2)
	for i := range u {
		u[i] = uint16(raw[2*i]) | uint16(raw[2*i+1])<<8
	}
	return string(utf16.Decode(u))
}

// R5.47: on Windows the service is registered with the PowerShell cmdlets, never
// with a cmd-quoted command line: the script travels as an encoded command.
func TestWindowsServiceIsRegisteredWithCmdlets(t *testing.T) {
	win, _ := agent.BuildInstallPlan("windows", agent.InstallOptions{Binary: `C:\Program Files\crsp\crsp.exe`, Controller: "pool.lan:8461", Fingerprint: strings.Repeat("ab", 32), JoinCode: "C"})
	var scripts []string
	for _, s := range win.Steps {
		for _, c := range s.Commands {
			if c[0] == "powershell.exe" {
				scripts = append(scripts, decodePS(t, c))
			}
			for _, a := range c {
				if strings.EqualFold(a, "cmd") || strings.EqualFold(a, "cmd.exe") || a == "/c" {
					t.Fatalf("a command goes through cmd: %v", c)
				}
			}
		}
	}
	all := strings.Join(scripts, "\n")
	for _, want := range []string{"New-Service -Name 'crsp-agent'", "Start-Service -Name 'crsp-agent'", "New-Item"} {
		if !strings.Contains(all, want) {
			t.Errorf("no %q in the scripts:\n%s", want, all)
		}
	}
	if !strings.Contains(all, `C:\Program Files\crsp\crsp.exe agent run`) {
		t.Fatalf("binary path with a space is not kept whole:\n%s", all)
	}
	// The symlink right is only in the plan when the owner chose it.
	if strings.Contains(all, "SeCreateSymbolicLinkPrivilege") {
		t.Fatal("symlink right granted without being chosen")
	}
	with, _ := agent.BuildInstallPlan("windows", agent.InstallOptions{Binary: "c.exe", Controller: "x:1", Fingerprint: "f", WindowsSymlinkRight: true})
	if !strings.Contains(with.Describe(), "create symbolic links") {
		t.Fatal("the chosen symlink right is not listed before the yes")
	}
	var symScript string
	for _, s := range with.Steps {
		if strings.Contains(s.What, "symbolic links") {
			symScript = decodePS(t, s.Commands[0])
		}
	}
	if !strings.Contains(symScript, "SeCreateSymbolicLinkPrivilege") || !strings.Contains(symScript, "secedit.exe /configure") {
		t.Fatalf("the symlink step does not grant the right:\n%s", symScript)
	}
}

// R5.48: at run time the agent never asks for admin rights. Only plan.go may
// name sudo, runas or an elevation; the rest of the package never does.
func TestRuntimeNeverAsksForAdminRights(t *testing.T) {
	files, _ := filepath.Glob("*.go")
	for _, f := range files {
		if strings.HasSuffix(f, "_test.go") || f == "plan.go" {
			continue
		}
		b, _ := os.ReadFile(f)
		for _, bad := range []string{"sudo", "runas", "RunAs", "Verb", "pkexec", "doas", "gsudo"} {
			if strings.Contains(string(b), bad) {
				t.Errorf("%s mentions %q: a run-time step must go back through the approved install step", f, bad)
			}
		}
	}
	// And the plan's Run is the one place that runs admin actions, only after a yes (tested above).
	p, _ := agent.BuildInstallPlan("linux", opts)
	for _, s := range p.Steps {
		if !s.Admin {
			t.Fatalf("a step is not marked admin: %s", s.What)
		}
	}
}

func TestInstallPlanNeedsItsInputs(t *testing.T) {
	if _, err := agent.BuildInstallPlan("linux", agent.InstallOptions{}); err == nil {
		t.Fatal("an empty plan was built")
	}
}
