package api

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	"github.com/luis-mc/ci-runners-shared-pool/internal/repos"
)

// makeAccess makes an access credential as the owner and returns its value and id.
func makeAccess(t *testing.T, h *harness, owner cookies, csrf, name string) (string, string) {
	t.Helper()
	res, b := h.do("POST", "/api/v1/access-credentials", map[string]string{"name": name, "scope": "parity"}, owner, map[string]string{"X-CSRF-Token": csrf})
	if res.StatusCode != 201 {
		t.Fatalf("create: %d %s", res.StatusCode, b)
	}
	var out struct {
		Value string
		Info  struct{ ID string }
	}
	if err := json.Unmarshal(b, &out); err != nil || out.Value == "" || out.Info.ID == "" {
		t.Fatalf("create body: %v %s", err, b)
	}
	return out.Value, out.Info.ID
}

func bearer(v string) map[string]string { return map[string]string{"Authorization": "Bearer " + v} }

func TestAccessCredentialLifecycleAndAudit(t *testing.T) { // R5.82
	h := newHarness(t)
	owner, csrf := h.setup(1, "alice")
	value, id := makeAccess(t, h, owner, csrf, "ci")
	if !strings.HasPrefix(value, auth.AccessCredentialPrefix) {
		t.Fatalf("value = %q", value)
	}
	// Listed without the value.
	_, b := h.do("GET", "/api/v1/access-credentials", nil, owner, nil)
	if strings.Contains(string(b), value) || !strings.Contains(string(b), `"name":"ci"`) || !strings.Contains(string(b), `"scope":"parity"`) {
		t.Fatalf("list: %s", b)
	}
	// Audited without the value.
	var actions []string
	for _, e := range h.astore.AuditEvents() {
		if strings.Contains(e.Detail+e.Subject+e.Actor, value) || strings.Contains(e.Detail+e.Subject, "crsp_acc_") {
			t.Fatalf("the audit holds the value: %+v", e)
		}
		actions = append(actions, e.Action)
	}
	if !strings.Contains(strings.Join(actions, " "), "auth.access_made") {
		t.Fatalf("no audit row for making it: %v", actions)
	}
	// Only the hash is stored.
	cs, _ := h.astore.ListAccessCredentials(context.Background())
	if len(cs) != 1 || cs[0].Hash != auth.Hash(value) || cs[0].Hash == value {
		t.Fatalf("stored: %+v", cs)
	}
	// It works while live (the runner list passes the gate; the fake build has none wired, so 501).
	if res, b := h.do("GET", "/api/v1/runners", nil, nil, bearer(value)); res.StatusCode != 501 {
		t.Fatalf("live: %d %s", res.StatusCode, b)
	}
	// Revoke: the next request is refused, and the revoke is audited.
	if res, b := h.do("DELETE", "/api/v1/access-credentials/"+id, nil, owner, map[string]string{"X-CSRF-Token": csrf}); res.StatusCode != 204 {
		t.Fatalf("revoke: %d %s", res.StatusCode, b)
	}
	if res, b := h.do("GET", "/api/v1/runners", nil, nil, bearer(value)); res.StatusCode != 401 {
		t.Fatalf("after revoke: %d %s", res.StatusCode, b)
	}
	found := false
	for _, e := range h.astore.AuditEvents() {
		if e.Action == "auth.access_revoked" && e.Subject == id {
			found = true
		}
		if strings.Contains(e.Detail+e.Subject, value) {
			t.Fatalf("the audit holds the value: %+v", e)
		}
	}
	if !found {
		t.Fatal("no audit row for the revoke")
	}
}

func TestParityCredentialIsRefusedOnEveryOtherEndpoint(t *testing.T) { // R5.83
	h := newHarness(t)
	owner, csrf := h.setup(1, "alice")
	value, _ := makeAccess(t, h, owner, csrf, "ci")
	allowed := map[string]bool{"GET /api/v1/runners": true, "POST /api/v1/doctor/runs": true, "GET /api/v1/doctor/runs/d1": true}
	for _, c := range []struct{ method, path string }{
		{"GET", "/api/v1/runners"}, {"POST", "/api/v1/doctor/runs"}, {"GET", "/api/v1/doctor/runs/d1"},
		// Reads outside the scope.
		{"GET", "/api/v1/machines"}, {"GET", "/api/v1/settings"}, {"GET", "/api/v1/audit"}, {"GET", "/api/v1/jobs"},
		{"GET", "/api/v1/auth/cli/tokens"}, {"GET", "/api/v1/access-credentials"}, {"GET", "/api/v1/users"},
		// Writes.
		{"POST", "/api/v1/access-credentials"}, {"DELETE", "/api/v1/access-credentials/ac_x"},
		{"POST", "/api/v1/machines/m1/drain"}, {"PUT", "/api/v1/settings/pool"}, {"PATCH", "/api/v1/settings"},
		{"DELETE", "/api/v1/runners/r1"}, {"POST", "/api/v1/runner-plans"}, {"POST", "/api/v1/repository-plans"},
		{"POST", "/api/v1/repositories/100/parity-setup"}, {"POST", "/api/v1/join-codes"}, {"POST", "/api/v1/backups"},
		{"POST", "/api/v1/update/apply"}, {"POST", "/api/v1/service/restart"}, {"PUT", "/api/v1/app/private-key"},
		{"POST", "/api/v1/users"}, {"POST", "/api/v1/auth/logout"},
	} {
		var body any
		if c.method != "GET" && c.method != "DELETE" {
			body = map[string]any{}
		}
		res, b := h.do(c.method, c.path, body, nil, bearer(value))
		key := c.method + " " + c.path
		if allowed[key] {
			if res.StatusCode == 401 || res.StatusCode == 403 {
				t.Errorf("%s: refused %d %s", key, res.StatusCode, b)
			}
			continue
		}
		if res.StatusCode != 403 || !strings.Contains(string(b), "access credential cannot") {
			t.Errorf("%s: %d %s; want 403", key, res.StatusCode, b)
		}
	}
}

func TestAccessCredentialNeedsAnAdminToMakeOne(t *testing.T) { // R5.82
	h := newHarness(t)
	_, _ = h.setup(1, "alice")
	if res, _ := h.do("POST", "/api/v1/access-credentials", map[string]string{"name": "x", "scope": "parity"}, nil, nil); res.StatusCode != 401 {
		t.Fatalf("anonymous: %d", res.StatusCode)
	}
}

func TestAccessCredentialRejectsBadInput(t *testing.T) { // R5.82
	h := newHarness(t)
	owner, csrf := h.setup(1, "alice")
	for _, body := range []map[string]string{{"name": "", "scope": "parity"}, {"name": "x", "scope": "admin"}} {
		res, b := h.do("POST", "/api/v1/access-credentials", body, owner, map[string]string{"X-CSRF-Token": csrf})
		if res.StatusCode != 400 {
			t.Errorf("%v: %d %s", body, res.StatusCode, b)
		}
	}
}

// parityRepo signs the owner in and syncs one repository the owner administers.
func parityRepo(t *testing.T) (*harness, cookies, string) {
	t.Helper()
	h := newHarness(t)
	owner, csrf := h.setup(1, "alice")
	h.fake.AddInstall(10, "alice", "User", 1)
	h.fake.AddRepo(100, 10, "alice", "app", true, 1)
	_, _ = h.do("GET", "/api/v1/github/repositories", nil, owner, nil)
	return h, owner, csrf
}

func TestSetupParityWritesTheSecretAndVariablesThroughGitHub(t *testing.T) { // R5.84
	h, owner, csrf := parityRepo(t)
	res, b := h.do("POST", "/api/v1/repositories/100/parity-setup", map[string]any{}, owner, map[string]string{"X-CSRF-Token": csrf})
	if res.StatusCode != 200 || !strings.Contains(string(b), `"status":"done"`) {
		t.Fatalf("%d %s", res.StatusCode, b)
	}
	sec, ok := h.fake.Secret("alice/app", "CRSP_ACCESS")
	if !ok || !strings.HasPrefix(sec, auth.AccessCredentialPrefix) {
		t.Fatalf("secret = %q %v", sec, ok)
	}
	// The value is nowhere in the answer.
	if strings.Contains(string(b), sec) {
		t.Fatal("the answer holds the credential value")
	}
	if got, _ := h.fake.Variable("alice/app", "CRSP_URL"); got != "https://crsp.example:8460" {
		t.Fatalf("CRSP_URL = %q, want the join address, not the address of the browser (%s)", got, h.srv.URL)
	}
	sum := sha256.Sum256([]byte{0, 0, 0}) // fakeCA's certificate is 3 zero bytes
	if got, _ := h.fake.Variable("alice/app", "CRSP_CA_FINGERPRINT"); got != hex.EncodeToString(sum[:]) {
		t.Fatalf("CRSP_CA_FINGERPRINT = %q", got)
	}
	for _, n := range append(h.fake.SecretNames("alice/app"), h.fake.VariableNames("alice/app")...) {
		for _, bad := range []string{"_KEY", "_TOKEN", "_SECRET", "_PASS"} {
			if strings.HasSuffix(n, bad) {
				t.Errorf("name %s ends in %s", n, bad)
			}
		}
	}
	// What GitHub holds is a working, parity-scoped credential.
	if res, b := h.do("GET", "/api/v1/runners", nil, nil, bearer(sec)); res.StatusCode == 401 || res.StatusCode == 403 {
		t.Fatalf("written credential refused: %d %s", res.StatusCode, b)
	}
	if res, _ := h.do("POST", "/api/v1/machines/m1/drain", map[string]any{}, nil, bearer(sec)); res.StatusCode != 403 {
		t.Fatalf("written credential allowed a write: %d", res.StatusCode)
	}
	// Audited, without the value.
	seen := false
	for _, e := range h.astore.AuditEvents() {
		if strings.Contains(e.Detail+e.Subject, sec) {
			t.Fatalf("the audit holds the value: %+v", e)
		}
		if e.Action == "parity.setup" {
			seen = true
		}
	}
	if !seen {
		t.Fatal("no audit row for the setup")
	}
}

func TestSetupParityIgnoresTheAddressOfTheBrowser(t *testing.T) { // R5.84, CRSP141
	h, owner, csrf := parityRepo(t)
	for _, body := range []map[string]any{{"controller_url": "http://127.0.0.1:8460"}, {"controller_url": "https://other.example:1"}, {}} {
		res, b := h.do("POST", "/api/v1/repositories/100/parity-setup", body, owner, map[string]string{"X-CSRF-Token": csrf, "Origin": h.srv.URL})
		if res.StatusCode != 200 || !strings.Contains(string(b), `"status":"done"`) {
			t.Fatalf("%v: %d %s", body, res.StatusCode, b)
		}
		got, _ := h.fake.Variable("alice/app", "CRSP_URL")
		if got != "https://crsp.example:8460" || strings.Contains(got, "127.0.0.1") || strings.HasPrefix(got, "http://") {
			t.Fatalf("CRSP_URL = %q", got)
		}
	}
}

func TestSetupParityRefusesWhenTheControllerHasNoReachableAddress(t *testing.T) { // R5.84, CRSP141
	for _, c := range []struct{ name, public, listen, setting string }{
		{"no public host", "", "0.0.0.0:8460", "CRSP_PUBLIC_HOST"},
		{"loopback public host", "127.0.0.1", "0.0.0.0:8460", "CRSP_PUBLIC_HOST"},
		{"loopback listen", "pool.lan", "127.0.0.1:8460", "CRSP_LISTEN_ADDR"},
	} {
		t.Run(c.name, func(t *testing.T) {
			h := newHarnessWith(t, nil, func(_ *repos.Config, o *Options) { o.PublicHost, o.ListenAddr = c.public, c.listen })
			owner, csrf := h.setup(1, "alice")
			h.fake.AddInstall(10, "alice", "User", 1)
			h.fake.AddRepo(100, 10, "alice", "app", true, 1)
			_, _ = h.do("GET", "/api/v1/github/repositories", nil, owner, nil)
			res, b := h.do("POST", "/api/v1/repositories/100/parity-setup", map[string]any{}, owner, map[string]string{"X-CSRF-Token": csrf})
			var out struct {
				Status  string
				Problem string `json:"address_problem"`
				Setting string `json:"address_setting"`
			}
			_ = json.Unmarshal(b, &out)
			if res.StatusCode != 200 || out.Status != "needs_address" || out.Setting != c.setting || !strings.Contains(out.Problem, strings.Replace(c.setting, "CRSP_LISTEN_ADDR", "Settings, Console, Network", 1)) {
				t.Fatalf("%d %s", res.StatusCode, b)
			}
			cs, _ := h.astore.ListAccessCredentials(context.Background())
			if len(cs) != 0 || len(h.fake.SecretNames("alice/app")) != 0 || len(h.fake.VariableNames("alice/app")) != 0 {
				t.Fatal("something was made or written")
			}
		})
	}
}

func TestParityAddressShowsTheAddressAndChecksIt(t *testing.T) { // R5.84, CRSP141
	var called string
	var fail error
	h := newHarnessWith(t, nil, func(_ *repos.Config, o *Options) {
		o.ParityProbe = func(_ context.Context, addr string) error { called = addr; return fail }
	})
	owner, _ := h.setup(1, "alice")
	get := func() (string, string, string) {
		res, b := h.do("GET", "/api/v1/parity-address", nil, owner, nil)
		if res.StatusCode != 200 {
			t.Fatalf("%d %s", res.StatusCode, b)
		}
		var out struct{ Status, URL, Problem string }
		_ = json.Unmarshal(b, &out)
		return out.Status, out.URL, out.Problem
	}
	if st, u, _ := get(); st != "ok" || u != "https://crsp.example:8460" || called != u {
		t.Fatalf("ok: %q %q called %q", st, u, called)
	}
	fail = errors.New("connection refused")
	st, u, pr := get()
	if st != "unreachable" || u != "https://crsp.example:8460" || !strings.Contains(pr, "connection refused") || !strings.Contains(pr, u) {
		t.Fatalf("unreachable: %q %q %q", st, u, pr)
	}
	// A request that is not an admin is refused.
	if res, _ := h.do("GET", "/api/v1/parity-address", nil, nil, nil); res.StatusCode != 401 {
		t.Fatalf("anonymous: %d", res.StatusCode)
	}
}

func TestParityAddressNeedsAnAddress(t *testing.T) { // R5.84, CRSP141
	h := newHarnessWith(t, nil, func(_ *repos.Config, o *Options) {
		o.PublicHost = ""
		o.ParityProbe = func(context.Context, string) error { t.Fatal("probed with no address"); return nil }
	})
	owner, _ := h.setup(1, "alice")
	res, b := h.do("GET", "/api/v1/parity-address", nil, owner, nil)
	if res.StatusCode != 200 || !strings.Contains(string(b), `"status":"needs_address"`) || !strings.Contains(string(b), `"setting":"CRSP_PUBLIC_HOST"`) || strings.Contains(string(b), `"url"`) {
		t.Fatalf("%d %s", res.StatusCode, b)
	}
}

type pemCA []byte

func (p pemCA) CAPEM() []byte { return p }

func TestProbeControllerCallsOverHTTPSWithTheControllerCA(t *testing.T) { // R5.84, CRSP141
	var srv *httptest.Server
	srv = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/ca.pem" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: srv.Certificate().Raw}))
	}))
	defer srv.Close()
	ca := pemCA(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: srv.Certificate().Raw}))
	if err := probeController(context.Background(), srv.URL, ca); err != nil {
		t.Fatalf("answers: %v", err)
	}
	// A CA that did not sign the server certificate does not trust it.
	k, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tpl := &x509.Certificate{SerialNumber: big.NewInt(7), Subject: pkix.Name{CommonName: "another ca"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true}
	der, err := x509.CreateCertificate(rand.Reader, tpl, tpl, &k.PublicKey, k)
	if err != nil {
		t.Fatal(err)
	}
	otherCA := pemCA(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}))
	if err := probeController(context.Background(), srv.URL, otherCA); err == nil {
		t.Fatal("a server the CA did not sign was accepted")
	}
	// The answer is not the controller's CA.
	wrong := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write(otherCA)
	}))
	defer wrong.Close()
	if err := probeController(context.Background(), wrong.URL, ca); err == nil {
		t.Fatal("an address that serves another CA was accepted")
	}
	// Nothing listens, or plain http.
	plain := httptest.NewServer(http.NotFoundHandler())
	plain.Close()
	if err := probeController(context.Background(), plain.URL, ca); err == nil {
		t.Fatal("a closed address was accepted")
	}
	if err := probeController(context.Background(), srv.URL, nil); err == nil {
		t.Fatal("no CA was accepted")
	}
}

func TestSetupParityWithoutThePermissionMakesNothingAndNamesThePages(t *testing.T) { // R5.84
	h, owner, csrf := parityRepo(t)
	h.fake.Installs[10].Perms["secrets"] = "read"
	res, b := h.do("POST", "/api/v1/repositories/100/parity-setup", map[string]any{}, owner, map[string]string{"X-CSRF-Token": csrf})
	if res.StatusCode != 200 {
		t.Fatalf("%d %s", res.StatusCode, b)
	}
	var out struct {
		Status  string
		Missing []string `json:"missing_permissions"`
		Grant   struct {
			Ready bool
			Next  string
			Steps []struct {
				ID          string
				Done        bool
				Permissions []string
				URL         string
			}
		}
	}
	_ = json.Unmarshal(b, &out)
	if out.Status != "needs_permission" || len(out.Missing) != 1 || out.Missing[0] != "secrets" {
		t.Fatalf("%s", b)
	}
	// One step list: installed (done), ask (waiting, next), accept (waiting).
	if out.Grant.Ready || out.Grant.Next != "ask" || len(out.Grant.Steps) != 3 {
		t.Fatalf("grant: %s", b)
	}
	ask, accept := out.Grant.Steps[1], out.Grant.Steps[2]
	if ask.ID != "ask" || ask.Done || !strings.HasPrefix(ask.URL, "https://github.com/settings/apps/") || !strings.HasSuffix(ask.URL, "/permissions") ||
		accept.ID != "accept" || accept.Done || accept.URL != "https://github.com/settings/installations/10" ||
		strings.Join(accept.Permissions, ",") != "secrets" {
		t.Fatalf("pages: %s", b)
	}
	// Nothing was made or written.
	cs, _ := h.astore.ListAccessCredentials(context.Background())
	if len(cs) != 0 || len(h.fake.SecretNames("alice/app")) != 0 || len(h.fake.VariableNames("alice/app")) != 0 {
		t.Fatalf("something was made: %v %v %v", cs, h.fake.SecretNames("alice/app"), h.fake.VariableNames("alice/app"))
	}
	// Granting the permission is enough: the next try goes through.
	h.fake.Installs[10].Perms["secrets"] = "write"
	if res, b := h.do("POST", "/api/v1/repositories/100/parity-setup", map[string]any{}, owner, map[string]string{"X-CSRF-Token": csrf}); res.StatusCode != 200 || !strings.Contains(string(b), `"done"`) {
		t.Fatalf("after the grant: %d %s", res.StatusCode, b)
	}
}

func TestSetupParityRevokesTheCredentialWhenGitHubRefuses(t *testing.T) { // R5.84
	h, owner, csrf := parityRepo(t)
	h.fake.FailMatching("/repos/alice/app/actions/secrets", 500, 10)
	res, b := h.do("POST", "/api/v1/repositories/100/parity-setup", map[string]any{}, owner, map[string]string{"X-CSRF-Token": csrf})
	if res.StatusCode < 400 {
		t.Fatalf("%d %s", res.StatusCode, b)
	}
	cs, _ := h.astore.ListAccessCredentials(context.Background())
	for _, c := range cs {
		if c.RevokedAt.IsZero() {
			t.Fatalf("a live credential was left: %+v", c)
		}
	}
	if len(h.fake.VariableNames("alice/app")) != 0 {
		t.Fatal("variables were written without the secret")
	}
}

func TestSetupParityNeedsGitHubAdminOfTheRepository(t *testing.T) { // R5.84
	h := newHarness(t)
	owner, csrf := h.setup(1, "alice")
	h.fake.AddInstall(10, "alice", "User", 1)
	h.fake.AddRepo(100, 10, "alice", "theirs", true) // alice is no admin here
	_, _ = h.do("GET", "/api/v1/github/repositories", nil, owner, nil)
	res, b := h.do("POST", "/api/v1/repositories/100/parity-setup", map[string]any{}, owner, map[string]string{"X-CSRF-Token": csrf})
	if res.StatusCode != 403 {
		t.Fatalf("%d %s", res.StatusCode, b)
	}
	if len(h.fake.SecretNames("alice/theirs")) != 0 {
		t.Fatal("a secret was written")
	}
}

type grantOut struct {
	Ready bool
	Next  string
	Steps []struct {
		ID          string
		Done        bool
		Permissions []string
		URL         string
	}
	Missing []string
}

func getGrant(t *testing.T, h *harness, owner cookies, query string) grantOut {
	t.Helper()
	res, b := h.do("GET", "/api/v1/github/grant?"+query, nil, owner, nil)
	if res.StatusCode != 200 {
		t.Fatalf("%d %s", res.StatusCode, b)
	}
	var g grantOut
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatal(err)
	}
	return g
}

func TestGrantReadsBothSidesOfGitHub(t *testing.T) { // R5.86
	h, owner, _ := parityRepo(t)
	h.fake.Installs[10].Perms["secrets"] = "read"
	// The App does not ask for it yet: step ask is next.
	h.fake.SetAppPermissions(map[string]string{"actions_variables": "write"})
	g := getGrant(t, h, owner, "permissions=secrets,actions_variables&repository_id=100")
	if g.Ready || g.Next != "ask" || strings.Join(g.Missing, ",") != "secrets" {
		t.Fatalf("not asked: %+v", g)
	}
	// The App asks, the installation has not accepted: step accept is next.
	h.fake.SetAppPermissions(map[string]string{"actions_variables": "write", "secrets": "write"})
	g = getGrant(t, h, owner, "permissions=secrets,actions_variables&repository_id=100")
	if g.Ready || g.Next != "accept" || !g.Steps[1].Done || g.Steps[2].Done || g.Steps[2].URL != "https://github.com/settings/installations/10" {
		t.Fatalf("asked, not accepted: %+v", g)
	}
	// The installation accepts: everything is granted.
	h.fake.Installs[10].Perms["secrets"] = "write"
	g = getGrant(t, h, owner, "permissions=secrets,actions_variables&installation_id=10")
	if !g.Ready || g.Next != "" || len(g.Missing) != 0 || !g.Steps[1].Done || !g.Steps[2].Done {
		t.Fatalf("all done: %+v", g)
	}
}

func TestGrantWithoutAnInstallationStartsWithInstall(t *testing.T) { // R5.86
	h := newHarness(t)
	owner, _ := h.setup(1, "alice")
	g := getGrant(t, h, owner, "permissions=secrets")
	if g.Ready || g.Next != "install" || len(g.Steps) != 3 || g.Steps[0].ID != "install" ||
		!strings.HasPrefix(g.Steps[0].URL, "https://github.com/apps/") || !strings.HasSuffix(g.Steps[0].URL, "/installations/new") {
		t.Fatalf("%+v", g)
	}
}

func TestGrantNeedsAPermissionNameAndAnAdmin(t *testing.T) { // R5.86
	h, owner, _ := parityRepo(t)
	if res, _ := h.do("GET", "/api/v1/github/grant", nil, owner, nil); res.StatusCode != 400 {
		t.Fatalf("no permission named: %d", res.StatusCode)
	}
	if res, _ := h.do("GET", "/api/v1/github/grant?permissions=secrets", nil, nil, nil); res.StatusCode != 401 {
		t.Fatalf("signed out: %d", res.StatusCode)
	}
}

func TestAcceptedPermissionsRefreshTheInstallationToken(t *testing.T) { // R5.87
	h, owner, csrf := parityRepo(t)
	h.fake.Installs[10].Perms["secrets"] = "read"
	h.do("POST", "/api/v1/repositories/100/parity-setup", map[string]any{}, owner, map[string]string{"X-CSRF-Token": csrf}) //nolint:errcheck // the answer is needs_permission, checked elsewhere
	// The owner accepts on GitHub; the next read sees it and the token is new.
	before := h.fake.TokensMade()
	h.fake.Installs[10].Perms["secrets"] = "write"
	g := getGrant(t, h, owner, "permissions=secrets&installation_id=10")
	if !g.Ready {
		t.Fatalf("%+v", g)
	}
	if err := h.repos.PermissionsAccepted(context.Background(), 10); err != nil {
		t.Fatal(err)
	}
	if res, b := h.do("POST", "/api/v1/repositories/100/parity-setup", map[string]any{}, owner, map[string]string{"X-CSRF-Token": csrf}); res.StatusCode != 200 || !strings.Contains(string(b), `"done"`) {
		t.Fatalf("%d %s", res.StatusCode, b)
	}
	if h.fake.TokensMade() <= before {
		t.Fatalf("no new installation token after the permissions were accepted: %d <= %d", h.fake.TokensMade(), before)
	}
}
