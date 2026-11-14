package update

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestVersionsStableOnly(t *testing.T) {
	cases := []struct {
		cur, latest string
		want        bool
	}{
		{"1.4.0", "1.5.0", true},
		{"1.4.0", "v1.4.1", true},
		{"1.4.0", "1.4.0", false},
		{"1.4.0", "1.3.9", false},
		{"1.9.0", "1.10.0", true},
		{"dev", "1.5.0", false},          // a developer build is never replaced
		{"edge-abc1234", "1.5.0", false}, // nor an edge build
		{"1.4.0", "edge-abc1234", false}, // edge is never offered
		{"1.4.0", "1.5.0-rc1", false},    // no pre-release
		{"1.4.0", "01.5.0", false},       // malformed
	}
	for _, c := range cases {
		if got := Newer(c.cur, c.latest); got != c.want {
			t.Errorf("Newer(%q, %q) = %v, want %v", c.cur, c.latest, got, c.want)
		}
	}
}

func TestAssetNamePerOS(t *testing.T) {
	for goos, want := range map[string]string{
		"windows": "crsp-windows-amd64.msi",
		"linux":   "crsp-linux-amd64.tar.gz",
		"darwin":  "crsp-darwin-amd64.tar.gz",
	} {
		if got := AssetName(goos, "amd64"); got != want {
			t.Errorf("%s: %q, want %q", goos, got, want)
		}
	}
	if AssetName("windows", "arm64") != "crsp-windows-arm64.msi" {
		t.Error("arm64 msi name")
	}
}

func TestGitHubSourceStableOnly(t *testing.T) {
	body := `{"tag_name":"v1.5.0","draft":false,"prerelease":false,"html_url":"https://github.com/x/y/releases/tag/v1.5.0","assets":[{"name":"SHA256SUMS","browser_download_url":"https://github.com/s"}]}`
	var path atomic.Value
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path.Store(r.URL.Path)
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()
	rel, err := GitHubSource{Base: srv.URL}.Latest(context.Background())
	if err != nil || rel.Version != "1.5.0" || rel.Assets["SHA256SUMS"] != "https://github.com/s" {
		t.Fatalf("%+v %v", rel, err)
	}
	if path.Load() != "/repos/"+Repo+"/releases/latest" {
		t.Fatalf("asked %v", path.Load())
	}
	for _, bad := range []string{
		strings.Replace(body, `"prerelease":false`, `"prerelease":true`, 1),
		strings.Replace(body, `"draft":false`, `"draft":true`, 1),
		strings.Replace(body, `v1.5.0"`, `edge"`, 1),
	} {
		body = bad
		if _, err := (GitHubSource{Base: srv.URL}).Latest(context.Background()); !errors.Is(err, ErrNoRelease) {
			t.Errorf("a draft, pre-release or edge release must be refused: %v", err)
		}
	}
}

func sum(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }

type attest struct{ err error }

func (a attest) Verify(context.Context, string) error { return a.err }

func TestVerifyChecksAndProvenance(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "crsp-linux-amd64.tar.gz")
	_ = os.WriteFile(f, []byte("payload"), 0o600)
	good := []byte(sum([]byte("payload")) + "  crsp-linux-amd64.tar.gz\n")
	ctx := context.Background()
	if err := Verify(ctx, f, "crsp-linux-amd64.tar.gz", good, attest{}); err != nil {
		t.Fatal(err)
	}
	wrong := []byte(sum([]byte("other")) + "  crsp-linux-amd64.tar.gz\n")
	var fl *Failure
	if err := Verify(ctx, f, "crsp-linux-amd64.tar.gz", wrong, attest{}); !errors.As(err, &fl) || fl.Check != "checksum" {
		t.Fatalf("a wrong checksum must be refused as checksum: %v", err)
	}
	if err := Verify(ctx, f, "crsp-linux-amd64.tar.gz", []byte("nothing here\n"), attest{}); !errors.As(err, &fl) || fl.Check != "checksum" {
		t.Fatalf("a missing line must be refused: %v", err)
	}
	if err := Verify(ctx, f, "crsp-linux-amd64.tar.gz", good, attest{err: errors.New("no attestation")}); !errors.As(err, &fl) || fl.Check != "provenance" {
		t.Fatalf("a failed attestation must be refused as provenance: %v", err)
	}
	if err := Verify(ctx, f, "crsp-linux-amd64.tar.gz", good, nil); err == nil {
		t.Fatal("no attester must fail closed")
	}
}

func TestGHAttesterFailsClosedWithoutGH(t *testing.T) {
	g := GHAttester{LookPath: func(string) (string, error) { return "", errors.New("not found") }}
	if err := g.Verify(context.Background(), "x"); err == nil || !strings.Contains(err.Error(), "provenance") {
		t.Fatalf("%v", err)
	}
	var got []string
	g = GHAttester{
		LookPath: func(string) (string, error) { return "gh", nil },
		Run: func(_ context.Context, name string, args ...string) ([]byte, error) {
			got = append([]string{name}, args...)
			return nil, nil
		},
	}
	if err := g.Verify(context.Background(), "file.msi"); err != nil {
		t.Fatal(err)
	}
	line := strings.Join(got, " ")
	if !strings.Contains(line, "attestation verify file.msi") || !strings.Contains(line, "--signer-workflow "+SignerWorkflow) || !strings.Contains(line, "--repo "+Repo) {
		t.Fatalf("the attestation must name this repository's release workflow: %s", line)
	}
}

func TestLockExcludesAndTakesOverStale(t *testing.T) {
	dir := t.TempDir()
	now := time.Now()
	alive := func(int) bool { return true }
	l, err := TakeLock(dir, now, 100, alive)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := TakeLock(dir, now, 200, alive); !errors.Is(err, ErrInProgress) {
		t.Fatalf("a live lock must refuse: %v", err)
	}
	if _, err := TakeLock(dir, now, 200, func(int) bool { return false }); err != nil {
		t.Fatalf("a lock whose process is gone is stale: %v", err)
	}
	l.Release()
	// An old lock is stale even when the pid looks alive.
	_, _ = TakeLock(dir, now.Add(-2*LockMaxAge), 100, alive)
	if _, err := TakeLock(dir, now, 300, alive); err != nil {
		t.Fatalf("an old lock must be taken over: %v", err)
	}
}

func TestAutoBackoff(t *testing.T) {
	now := time.Now()
	if ok, _ := AutoAllowed(Failures{}, "1.5.0", now); !ok {
		t.Fatal("no failure: allowed")
	}
	f := Failures{Version: "1.5.0", Count: 1, FailedAt: now.Add(-30 * time.Minute)}
	if ok, why := AutoAllowed(f, "1.5.0", now); ok || why == "" {
		t.Fatal("30 minutes after the first failure it must wait an hour")
	}
	f.FailedAt = now.Add(-61 * time.Minute)
	if ok, _ := AutoAllowed(f, "1.5.0", now); !ok {
		t.Fatal("after an hour the second try may start")
	}
	f = Failures{Version: "1.5.0", Count: 2, FailedAt: now.Add(-2 * time.Hour)}
	if ok, _ := AutoAllowed(f, "1.5.0", now); ok {
		t.Fatal("the second failure waits four hours")
	}
	f.Count = AutoTries
	if ok, why := AutoAllowed(f, "1.5.0", now.Add(100*time.Hour)); ok || !strings.Contains(why, "gave up") {
		t.Fatal("after three tries the automatic path gives up")
	}
	if ok, _ := AutoAllowed(f, "1.6.0", now); !ok {
		t.Fatal("a newer release gets its own tries")
	}
}

func TestExtractBinaryOnlyTheBinary(t *testing.T) {
	dir := t.TempDir()
	arch := filepath.Join(dir, "a.tar.gz")
	f, _ := os.Create(arch)
	gz := gzip.NewWriter(f)
	tw := tar.NewWriter(gz)
	for _, e := range []struct{ name, body string }{
		{"crsp-linux-amd64/README.md", "readme"},
		{"../../evil", "evil"},
		{"crsp-linux-amd64/crsp", "BINARY"},
	} {
		_ = tw.WriteHeader(&tar.Header{Name: e.name, Mode: 0o755, Size: int64(len(e.body)), Typeflag: tar.TypeReg})
		_, _ = tw.Write([]byte(e.body))
	}
	_ = tw.Close()
	_ = gz.Close()
	_ = f.Close()
	dst := filepath.Join(dir, "crsp.new")
	if err := ExtractBinary(arch, dst); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(dst); string(b) != "BINARY" {
		t.Fatalf("%q", b)
	}
	if _, err := os.Stat(filepath.Join(dir, "..", "..", "evil")); err == nil {
		t.Fatal("a path outside the target was written")
	}
}

// ---------------------------------------------------------------- manager

type fakeDrainer struct {
	jobs    []Job
	begun   []Kind
	timeout int
}

func (d *fakeDrainer) RunningJobs(context.Context) ([]Job, error) { return d.jobs, nil }
func (d *fakeDrainer) BeginDrain(_ context.Context, k Kind, _ string) error {
	d.begun = append(d.begun, k)
	return nil
}
func (d *fakeDrainer) DrainTimeoutMinutes(context.Context) int { return 60 }

type fakeSource struct{ rel Release }

func (s fakeSource) Latest(context.Context) (Release, error) { return s.rel, nil }

type harness struct {
	m      *Manager
	d      *fakeDrainer
	auto   *bool
	spawns []Plan
	dl     []string
	dir    string
}

func newHarness(t *testing.T, goos string, auto bool, payloadOK bool) *harness {
	t.Helper()
	h := &harness{d: &fakeDrainer{}, auto: &auto, dir: t.TempDir()}
	asset := AssetName(goos, "amd64")
	payload := []byte("payload")
	sumLine := sum(payload)
	if !payloadOK {
		sumLine = sum([]byte("tampered"))
	}
	rel := Release{Version: "1.5.0", Tag: "v1.5.0", URL: "https://github.com/x/releases/v1.5.0", Assets: map[string]string{
		asset: "https://github.com/dl/" + asset, "SHA256SUMS": "https://github.com/dl/SHA256SUMS",
	}}
	exe := filepath.Join(h.dir, "bin", "crsp")
	_ = os.MkdirAll(filepath.Dir(exe), 0o750)
	_ = os.WriteFile(exe, []byte("old"), 0o755) //nolint:gosec // test
	h.m = New(Options{
		Current: "1.4.0", Source: fakeSource{rel}, Attester: attest{}, Drainer: h.d,
		AutoUpdate: func(context.Context) bool { return *h.auto },
		Dir:        filepath.Join(h.dir, "updates"), GOOS: goos, GOARCH: "amd64", Exe: exe, HealthURL: "http://127.0.0.1:1/healthz",
		Fetch: func(_ context.Context, url, dst string) error {
			h.dl = append(h.dl, url)
			if strings.HasSuffix(url, "SHA256SUMS") {
				return os.WriteFile(dst, []byte(sumLine+"  "+asset+"\n"), 0o600)
			}
			return os.WriteFile(dst, payload, 0o600)
		},
		Extract:   func(_, dst string) error { return os.WriteFile(dst, []byte("new"), 0o755) }, //nolint:gosec // test
		SelfCheck: func(context.Context, string, string) error { return nil },
		Spawn: func(_ context.Context, _ string, p Plan, _ string) (int, error) {
			h.spawns = append(h.spawns, p)
			return 4242, nil
		},
	})
	return h
}

func TestApplyRefusedWithoutConfirmedListsJobs(t *testing.T) {
	h := newHarness(t, "linux", false, true)
	h.d.jobs = []Job{{Repository: "luis-mc/app", Workflow: "ci", RunID: 7, Job: "test"}}
	ctx := context.Background()
	if _, err := h.m.Check(ctx); err != nil {
		t.Fatal(err)
	}
	for _, k := range []Kind{KindUpdate, KindRestart} {
		_, err := h.m.Apply(ctx, k, false, "octo")
		var nc *NeedsConfirmation
		if !errors.As(err, &nc) || len(nc.Jobs) != 1 || nc.Jobs[0].RunID != 7 {
			t.Fatalf("%s: want needs-confirmation with the running job, got %v", k, err)
		}
	}
	if len(h.dl) != 0 || len(h.d.begun) != 0 || len(h.spawns) != 0 {
		t.Fatalf("a refused request must download, drain and install nothing: dl=%v begun=%v", h.dl, h.d.begun)
	}
}

func TestAutoOffDoesNotInstallByItself(t *testing.T) {
	h := newHarness(t, "linux", false, true)
	st, err := h.m.Check(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !st.Available || st.Latest != "1.5.0" || st.AutoUpdate || st.State != StateIdle {
		t.Fatalf("%+v", st)
	}
	if len(h.dl) != 0 || len(h.d.begun) != 0 {
		t.Fatal("with auto-update off, a check never downloads or drains")
	}
}

func TestAutoOnDownloadsVerifiesThenDrainsThenInstallsOnIdle(t *testing.T) {
	h := newHarness(t, "linux", true, true)
	ctx := context.Background()
	h.d.jobs = []Job{{Repository: "luis-mc/app", RunID: 1, Job: "build"}}
	st, err := h.m.Check(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if st.State != StateWaitingForJobs || len(h.d.begun) != 1 || h.d.begun[0] != KindUpdate {
		t.Fatalf("auto-update must drain: %+v begun=%v", st, h.d.begun)
	}
	if len(h.dl) != 2 {
		t.Fatalf("the asset and SHA256SUMS: %v", h.dl)
	}
	// A job still runs when the drain calls back: nothing is installed, the drain goes on waiting.
	if err := h.m.OnIdle(ctx, KindUpdate); !errors.Is(err, ErrNotIdle) || len(h.spawns) != 0 {
		t.Fatalf("a running job must stop the install: err=%v spawns=%d", err, len(h.spawns))
	}
	h.d.jobs = nil
	if err := h.m.OnIdle(ctx, KindUpdate); err != nil {
		t.Fatal(err)
	}
	if len(h.spawns) != 1 || h.spawns[0].To != "1.5.0" || h.spawns[0].From != "1.4.0" || h.spawns[0].Kind != "update" {
		t.Fatalf("%+v", h.spawns)
	}
	if h.m.Status(ctx).State != StateRestarting {
		t.Fatal("state after the helper started")
	}
	// The lock is handed to the helper, so a second install is refused.
	if _, err := TakeLock(filepath.Join(h.dir, "updates"), time.Now(), 1, func(int) bool { return true }); !errors.Is(err, ErrInProgress) {
		t.Fatalf("the helper holds the lock: %v", err)
	}
}

func TestBadChecksumOrProvenanceStopsBeforeDrain(t *testing.T) {
	h := newHarness(t, "linux", true, false)
	st, err := h.m.Check(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if st.State != StateFailed || !strings.Contains(st.Error, "checksum") || len(h.d.begun) != 0 || len(h.spawns) != 0 {
		t.Fatalf("%+v begun=%v", st, h.d.begun)
	}
	// The failed try is recorded, so the automatic path backs off.
	f, _ := ReadFailures(filepath.Join(h.dir, "updates"))
	if f.Version != "1.5.0" || f.Count != 1 {
		t.Fatalf("%+v", f)
	}
	h2 := newHarness(t, "linux", true, true)
	h2.m.o.Attester = attest{err: &Failure{Check: "provenance", Reason: "signer mismatch"}}
	st, _ = h2.m.Check(context.Background())
	if st.State != StateFailed || !strings.Contains(st.Error, "provenance") || len(h2.d.begun) != 0 {
		t.Fatalf("%+v", st)
	}
}

func TestManualYesDrainsAndWindowsGetsTheMSI(t *testing.T) {
	h := newHarness(t, "windows", false, true)
	ctx := context.Background()
	if _, err := h.m.Apply(ctx, KindUpdate, true, "octo"); err != nil {
		t.Fatal(err)
	}
	if len(h.dl) != 2 || !strings.HasSuffix(h.dl[0], "crsp-windows-amd64.msi") {
		t.Fatalf("windows downloads the MSI: %v", h.dl)
	}
	if _, err := h.m.Apply(ctx, KindUpdate, true, "octo"); !errors.Is(err, ErrBusy) {
		t.Fatalf("a second request while one waits: %v", err)
	}
	if err := h.m.OnIdle(ctx, KindUpdate); err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(h.spawns[0].File, "crsp-windows-amd64.msi") || h.spawns[0].GOOS != "windows" {
		t.Fatalf("%+v", h.spawns[0])
	}
}

func TestRestartNeedsNoDownload(t *testing.T) {
	h := newHarness(t, "linux", false, true)
	ctx := context.Background()
	if _, err := h.m.Apply(ctx, KindRestart, true, "octo"); err != nil {
		t.Fatal(err)
	}
	if len(h.dl) != 0 || len(h.d.begun) != 1 || h.d.begun[0] != KindRestart {
		t.Fatalf("dl=%v begun=%v", h.dl, h.d.begun)
	}
	if err := h.m.OnIdle(ctx, KindRestart); err != nil {
		t.Fatal(err)
	}
	if h.spawns[0].Kind != "restart" {
		t.Fatalf("%+v", h.spawns[0])
	}
}

func TestNoUpdateWhenCurrent(t *testing.T) {
	h := newHarness(t, "linux", false, true)
	h.m.o.Current = "1.5.0"
	if _, err := h.m.Apply(context.Background(), KindUpdate, true, "octo"); !errors.Is(err, ErrNoUpdate) {
		t.Fatalf("%v", err)
	}
}

// ---------------------------------------------------------------- helper

type execLog struct {
	calls [][]string
	codes map[string]int
}

func (e *execLog) run(_ context.Context, name string, args ...string) (int, error) {
	e.calls = append(e.calls, append([]string{name}, args...))
	return e.codes[name], nil
}

func helperEnv(e *execLog, health func(string) (string, error)) Env {
	now := time.Unix(1_700_000_000, 0)
	return Env{
		Exec: e.run, Now: func() time.Time { now = now.Add(time.Second); return now }, Sleep: func(time.Duration) {},
		Health: func(_ context.Context, u string) (string, error) { return health(u) },
	}
}

func TestHelperWindowsRunsSilentMajorUpgrade(t *testing.T) {
	dir := t.TempDir()
	e := &execLog{}
	p := Plan{Kind: "update", GOOS: "windows", From: "1.4.0", To: "1.5.0", File: `C:\u\crsp-windows-amd64.msi`, Service: "crsp", HealthURL: "x", Dir: dir}
	if err := RunPlan(context.Background(), p, helperEnv(e, func(string) (string, error) { return "1.5.0", nil })); err != nil {
		t.Fatal(err)
	}
	want := []string{"msiexec", "/i", p.File, "/qn", "/norestart", "/l*v", filepath.Join(dir, "msi.log")}
	if strings.Join(e.calls[0], "|") != strings.Join(want, "|") {
		t.Fatalf("%v", e.calls[0])
	}
	r, ok := ReadResult(dir)
	if !ok || !r.OK || r.To != "1.5.0" {
		t.Fatalf("%+v", r)
	}
}

func TestHelperWindowsReportsMSIFailureAndBacksOff(t *testing.T) {
	dir := t.TempDir()
	e := &execLog{codes: map[string]int{"msiexec": 1603}}
	p := Plan{Kind: "update", GOOS: "windows", From: "1.4.0", To: "1.5.0", File: "x.msi", Dir: dir}
	if err := RunPlan(context.Background(), p, helperEnv(e, nil)); err == nil || !strings.Contains(err.Error(), "1603") {
		t.Fatalf("%v", err)
	}
	if r, _ := ReadResult(dir); r.OK || !strings.Contains(r.Error, "1603") {
		t.Fatalf("%+v", r)
	}
	if f, _ := ReadFailures(dir); f.Count != 1 || f.Version != "1.5.0" {
		t.Fatalf("%+v", f)
	}
	// 3010 (restart pending) counts as installed.
	e = &execLog{codes: map[string]int{"msiexec": 3010}}
	if err := RunPlan(context.Background(), p, helperEnv(e, func(string) (string, error) { return "1.5.0", nil })); err != nil {
		t.Fatal(err)
	}
}

func unixPlan(t *testing.T, goos string) (Plan, string, string) {
	t.Helper()
	dir := t.TempDir()
	exe := filepath.Join(dir, "crsp")
	nw := exe + ".new"
	_ = os.WriteFile(exe, []byte("OLD"), 0o755) //nolint:gosec // test
	_ = os.WriteFile(nw, []byte("NEW"), 0o755)  //nolint:gosec // test
	return Plan{Kind: "update", GOOS: goos, From: "1.4.0", To: "1.5.0", File: nw, Exe: exe, Service: "crsp", HealthURL: "x", HealthTimeout: 5 * time.Second, Dir: dir}, exe, dir
}

func TestHelperUnixSwapsRestartsAndKeepsPrevious(t *testing.T) {
	for goos, want := range map[string]string{"linux": "systemctl|restart|crsp", "darwin": "launchctl|kickstart|-k|system/crsp"} {
		p, exe, _ := unixPlan(t, goos)
		e := &execLog{}
		if err := RunPlan(context.Background(), p, helperEnv(e, func(string) (string, error) { return "1.5.0", nil })); err != nil {
			t.Fatal(err)
		}
		if b, _ := os.ReadFile(exe); string(b) != "NEW" {
			t.Fatalf("%s: binary not replaced: %q", goos, b)
		}
		if b, _ := os.ReadFile(exe + ".previous"); string(b) != "OLD" {
			t.Fatalf("%s: previous not kept", goos)
		}
		if strings.Join(e.calls[0], "|") != want {
			t.Fatalf("%s: %v", goos, e.calls[0])
		}
	}
}

func TestHelperUnixRollsBackWhenUnhealthy(t *testing.T) {
	p, exe, dir := unixPlan(t, "linux")
	e := &execLog{}
	err := RunPlan(context.Background(), p, helperEnv(e, func(string) (string, error) { return "1.4.0", nil }))
	if err == nil || !strings.Contains(err.Error(), "previous build is back") {
		t.Fatalf("%v", err)
	}
	if b, _ := os.ReadFile(exe); string(b) != "OLD" {
		t.Fatalf("the old binary must be back: %q", b)
	}
	if len(e.calls) != 2 { // restart onto the new build, restart onto the old one
		t.Fatalf("%v", e.calls)
	}
	// An unhealthy build is marked bad: the automatic path never tries it again.
	f, _ := ReadFailures(dir)
	if ok, _ := AutoAllowed(f, "1.5.0", time.Now().Add(1000*time.Hour)); ok {
		t.Fatal("a build that did not become healthy must not be tried again on its own")
	}
	if r, _ := ReadResult(dir); r.OK {
		t.Fatal("result must say failed")
	}
}

func TestHelperReleasesLock(t *testing.T) {
	p, _, dir := unixPlan(t, "linux")
	if _, err := TakeLock(dir, time.Now(), 1, func(int) bool { return true }); err != nil {
		t.Fatal(err)
	}
	_ = RunPlan(context.Background(), p, helperEnv(&execLog{}, func(string) (string, error) { return "1.5.0", nil }))
	if _, err := os.Stat(filepath.Join(dir, LockFile)); !os.IsNotExist(err) {
		t.Fatal("the helper releases the lock as its last step")
	}
}

func TestPlanJSONRoundTrip(t *testing.T) {
	b, _ := json.Marshal(Plan{Kind: "update", HealthTimeout: time.Minute})
	var p Plan
	if err := json.Unmarshal(b, &p); err != nil || p.HealthTimeout != time.Minute {
		t.Fatalf("%+v %v", p, err)
	}
}
