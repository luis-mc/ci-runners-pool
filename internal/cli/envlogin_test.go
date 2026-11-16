package cli

import (
	"bytes"
	"net/http"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/cli/contexts"
)

// envRun runs the CLI with no login context and the given environment
// (cli R5.60).
func envRun(t *testing.T, f *fixture, env map[string]string, args ...string) (int, string, string) {
	t.Helper()
	if err := os.Remove(contexts.Path(f.dir)); err != nil {
		t.Fatal(err)
	}
	var out, errOut bytes.Buffer
	e := f.env(&out, &errOut)
	e.Getenv = func(k string) string { return env[k] }
	code := Run(e, args)
	return code, out.String(), errOut.String()
}

const accessValue = "crsp_acc_testvalue0123456789"

func TestEnvSignInWorksWithoutAContext(t *testing.T) { // R5.60
	f := newFixture(t)
	paritySetup(f, parityRunners(), "ok")
	var mu sync.Mutex
	var auths []string
	f.handle("GET /api/v1/runners", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		auths = append(auths, r.Header.Get("Authorization"))
		mu.Unlock()
		writeJSON(w, 200, map[string]any{"items": parityRunners()})
	})
	code, out, errOut := envRun(t, f, map[string]string{envURL: f.srv.URL, envAccess: accessValue, envFingerprint: f.fingerprint()}, "parity", "check")
	if code != 0 {
		t.Fatalf("exit %d %q %q", code, out, errOut)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(auths) == 0 || auths[0] != "Bearer "+accessValue {
		t.Fatalf("authorization = %q", auths)
	}
	if strings.Contains(out+errOut, accessValue) {
		t.Fatal("the access value is in the output")
	}
}

func TestEnvSignInWorksForOtherCommands(t *testing.T) { // R5.60: every command
	f := newFixture(t)
	f.reply("GET /api/v1/runners", 200, map[string]any{"items": []any{}})
	code, _, errOut := envRun(t, f, map[string]string{envURL: f.srv.URL, envAccess: accessValue, envFingerprint: f.fingerprint()}, "runner", "list")
	if code != 0 {
		t.Fatalf("exit %d %q", code, errOut)
	}
}

func TestEnvSignInPinsTheFingerprint(t *testing.T) { // R5.60
	f := newFixture(t)
	paritySetup(f, parityRunners(), "ok")
	wrong := strings.Repeat("ab", 32)
	code, _, errOut := envRun(t, f, map[string]string{envURL: f.srv.URL, envAccess: accessValue, envFingerprint: wrong}, "parity", "check")
	if code != ExitUnreachable || !strings.Contains(errOut, "fingerprint") {
		t.Fatalf("exit %d %q", code, errOut)
	}
	if f.called("GET /api/v1/runners") {
		t.Fatal("a request reached a controller with the wrong certificate")
	}
}

func TestEnvSignInNeedsTheFingerprintForHTTPS(t *testing.T) { // R5.60
	f := newFixture(t)
	code, _, errOut := envRun(t, f, map[string]string{envURL: f.srv.URL, envAccess: accessValue}, "parity", "check")
	if code != ExitUsage || !strings.Contains(errOut, envFingerprint) {
		t.Fatalf("exit %d %q", code, errOut)
	}
}

func TestEnvSignInPartialSetNamesWhatIsMissing(t *testing.T) { // R5.60
	f := newFixture(t)
	code, _, errOut := envRun(t, f, map[string]string{envURL: f.srv.URL}, "parity", "check")
	if code != ExitAuth || !strings.Contains(errOut, envAccess) || !strings.Contains(errOut, "Settings") {
		t.Fatalf("exit %d %q", code, errOut)
	}
}

func TestNoContextNoEnvKeepsNotSignedIn(t *testing.T) { // R5.60
	f := newFixture(t)
	code, _, errOut := envRun(t, f, map[string]string{}, "parity", "check")
	if code != ExitAuth || !strings.Contains(errOut, "Not signed in") || !strings.Contains(errOut, envURL) {
		t.Fatalf("exit %d %q", code, errOut)
	}
}

func TestLoginContextWinsOverEnv(t *testing.T) { // R5.60: the environment is for when no context exists
	f := newFixture(t)
	paritySetup(f, parityRunners(), "ok")
	var out, errOut bytes.Buffer
	e := f.env(&out, &errOut)
	e.Getenv = func(k string) string {
		return map[string]string{envURL: "https://127.0.0.2:1", envAccess: accessValue, envFingerprint: strings.Repeat("cd", 32)}[k]
	}
	if code := Run(e, []string{"parity", "check"}); code != 0 {
		t.Fatalf("exit %d %q", code, errOut.String())
	}
}
