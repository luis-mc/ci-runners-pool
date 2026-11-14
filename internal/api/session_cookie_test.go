package api

import (
	"encoding/base64"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
)

// signInCookie runs a fresh sign-in of user 1 (after h.setup) and returns the
// Set-Cookie of the session.
func signInCookie(t *testing.T, h *harness) *http.Cookie {
	t.Helper()
	res, _ := h.do("GET", "/auth/github/login", nil, nil, nil)
	loc, _ := url.Parse(res.Header.Get("Location"))
	h.fake.IssueOAuthCode("zz", 1, loc.Query().Get("code_challenge"))
	res, _ = h.do("GET", "/auth/github/callback?code=zz&state="+url.QueryEscape(loc.Query().Get("state")), nil, nil, nil)
	for _, c := range res.Cookies() {
		if c.Name == auth.SessionCookieName {
			return c
		}
	}
	t.Fatal("sign-in set no session cookie")
	return nil
}

// R6.1: HttpOnly, Secure, SameSite=Lax and host-only, on every address.
func TestSessionCookieIsHttpOnlySecureLaxHostOnly(t *testing.T) {
	h := newHarness(t)
	h.setup(1, "alice")
	ck := signInCookie(t, h)
	if !ck.HttpOnly || !ck.Secure || ck.SameSite != http.SameSiteLaxMode || ck.Domain != "" || ck.Path != "/" {
		t.Fatalf("session cookie: %+v", ck)
	}
	// The test server is on loopback; Secure must not depend on the address.
	if !strings.HasPrefix(h.srv.URL, "http://127.0.0.1") {
		t.Skipf("harness is not on loopback: %s", h.srv.URL)
	}
}

// R6.1: the setup cookie follows the same rules.
func TestSetupCookieIsSecureToo(t *testing.T) {
	h := newHarness(t)
	code, _ := h.auth.NewSetupCode(t.Context())
	res, _ := h.do("POST", "/api/v1/setup/redeem", map[string]string{"code": code}, nil, nil)
	for _, c := range res.Cookies() {
		if c.Name == auth.SetupCookieName {
			if !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteLaxMode || c.Domain != "" {
				t.Fatalf("setup cookie: %+v", c)
			}
			return
		}
	}
	t.Fatal("no setup cookie")
}

// R6.1: the value is a random 256-bit id and the controller stores only its hash.
func TestSessionCookieValueIs256BitsAndOnlyItsHashIsStored(t *testing.T) {
	h := newHarness(t)
	h.setup(1, "alice")
	a, b := signInCookie(t, h), signInCookie(t, h)
	for _, ck := range []*http.Cookie{a, b} {
		raw, err := base64.RawURLEncoding.DecodeString(ck.Value)
		if err != nil || len(raw) != 32 {
			t.Fatalf("session id %q: %d bytes, err %v; want 32 random bytes", ck.Value, len(raw), err)
		}
		for _, stored := range h.astore.Dump() {
			if stored == ck.Value {
				t.Fatal("the session id itself is stored; only its hash may be")
			}
		}
		if _, _, err := h.astore.GetSession(t.Context(), auth.Hash(ck.Value)); err != nil {
			t.Fatalf("the session must be found by the hash of its id: %v", err)
		}
	}
	if a.Value == b.Value {
		t.Fatal("two sign-ins got the same session id")
	}
}
