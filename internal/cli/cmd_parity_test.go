package cli

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/parity"
)

func paritySetup(f *fixture, runners []any, findings ...string) {
	f.reply("GET /api/v1/runners", 200, map[string]any{"items": runners})
	f.handle("POST /api/v1/doctor/runs", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, 202, doctorRun("running"))
	})
	f.reply("GET /api/v1/doctor/runs/d1", 200, doctorRun("done", findings...))
}

func parityRunners() []any {
	lin := runnerJSON("linux-01", "m1", nil)
	win := runnerJSON("win-01", "m1", nil)
	win["os"] = "windows"
	win["isolation"] = "persistent"
	vm := runnerJSON("vm-01", "m1", nil)
	vm["isolation"] = "VM"
	return []any{lin, win, vm}
}

func TestParityCheckPassesAndWritesReport(t *testing.T) {
	f := newFixture(t)
	paritySetup(f, parityRunners(), "ok")
	out := filepath.Join(t.TempDir(), parity.ReportFileName)
	code, stdout, errOut := f.run("parity", "check", "--out", out)
	if code != 0 {
		t.Fatalf("exit %d %q %q", code, stdout, errOut)
	}
	fh, err := os.Open(out)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = fh.Close() }()
	rep, err := parity.ReadReport(fh)
	if err != nil || !rep.Pass || rep.Mode != parity.ModeCheck || rep.CountsForGate {
		t.Fatalf("report: %v %+v", err, rep)
	}
	// The saved file reads back with the same verdict.
	if code, _, _ := f.run("parity", "report", out); code != 0 {
		t.Fatalf("report exit %d", code)
	}
}

func TestParityCheckFailsOnOfflineClassAndWarn(t *testing.T) {
	f := newFixture(t)
	rs := parityRunners()
	rs[2].(map[string]any)["state"] = "offline"
	paritySetup(f, rs, "warn")
	code, out, _ := f.run("parity", "check")
	if code != ExitFindings || !strings.Contains(out, "pool.runners.vm") || !strings.Contains(out, "pool.doctor") {
		t.Fatalf("exit %d %q", code, out)
	}
}

func TestParitySoakDryRun(t *testing.T) {
	f := newFixture(t)
	code, out, errOut := f.run("parity", "soak", "--dry-run", "--jobs", "5", "--duration", "1h", "--p95", "1m")
	if code != 0 || !strings.Contains(out, "soak.vm") || !strings.Contains(errOut, "never counts") {
		t.Fatalf("clean dry run: %d %q %q", code, out, errOut)
	}
	for _, fault := range []string{"lost", "duplicate", "slow"} {
		if code, _, _ := f.run("parity", "soak", "--dry-run", "--fault", fault, "--jobs", "5", "--duration", "1h", "--p95", "1m"); code != ExitFindings {
			t.Errorf("fault %s: exit %d, want %d", fault, code, ExitFindings)
		}
	}
	if code, _, _ := f.run("parity", "soak", "--dry-run", "--fault", "nope"); code != ExitUsage {
		t.Errorf("bad fault: %d", code)
	}
	if code, _, _ := f.run("parity", "soak"); code != ExitUsage {
		t.Errorf("no source: %d", code)
	}
	if code, _, _ := f.run("parity", "soak", "--dry-run", "--jobs", "0"); code != ExitUsage {
		t.Errorf("bad plan: %d", code)
	}
}

func TestParitySoakFromObservations(t *testing.T) {
	f := newFixture(t)
	plan := parity.SoakPlan{JobsPerClass: 3, Duration: parity.DefaultPlan().Duration, P95WaitBound: parity.DefaultPlan().P95WaitBound}
	obs, err := parity.FakeSource{Epoch: f.now}.Observe(plan)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	file := filepath.Join(dir, "obs.json")
	b, _ := json.Marshal(obs)
	if err := os.WriteFile(file, b, 0o600); err != nil {
		t.Fatal(err)
	}
	out := filepath.Join(dir, "r.json")
	code, _, errOut := f.run("parity", "soak", "--observations", file, "--jobs", "3", "--out", out)
	if code != 0 || strings.Contains(errOut, "never counts") {
		t.Fatalf("live observations: %d %q", code, errOut)
	}
	fh, err := os.Open(out)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = fh.Close() }()
	rep, err := parity.ReadReport(fh)
	if err != nil || !rep.CountsForGate || rep.Mode != parity.ModeSoak {
		t.Fatalf("a passing soak from observations must count: %v %+v", err, rep)
	}
	if code, _, _ := f.run("parity", "soak", "--observations", filepath.Join(dir, "missing.json")); code != ExitFailed {
		t.Errorf("missing file: %d", code)
	}
}

func TestParityReportIsRejudged(t *testing.T) {
	f := newFixture(t)
	dir := t.TempDir()
	out := filepath.Join(dir, "r.json")
	if code, _, _ := f.run("parity", "soak", "--dry-run", "--fault", "lost", "--jobs", "3", "--duration", "1h", "--p95", "1m", "--out", out); code != ExitFindings {
		t.Fatalf("lost job: %d", code)
	}
	b, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	// Someone edits the file to say pass; the verdict is judged again.
	edited := strings.Replace(string(b), `"pass": false,
  "counts_for_gate"`, `"pass": true,
  "counts_for_gate"`, 1)
	if err := os.WriteFile(out, []byte(edited), 0o600); err != nil {
		t.Fatal(err)
	}
	if code, _, _ := f.run("parity", "report", out); code != ExitFindings {
		t.Fatalf("edited report passed: %d", code)
	}
	if code, _, _ := f.run("parity", "report"); code != ExitUsage {
		t.Errorf("no file: %d", code)
	}
	if code, _, _ := f.run("parity", "report", filepath.Join(dir, "none.json")); code != ExitNotFound {
		t.Errorf("missing: %d", code)
	}
	if code, md, _ := f.run("parity", "report", "--markdown", out); code != ExitFindings || !strings.Contains(md, "FAIL") {
		t.Errorf("markdown: %d %q", code, md)
	}
}
