package auth

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"
)

func TestSessionNeverExpiresByTime(t *testing.T) { // R5.13 (owner decision for M1)
	e := newEnv(t)
	ctx := context.Background()
	si := e.ownerSignIn(1, "alice")
	e.advance(5 * 365 * 24 * time.Hour)
	p, err := e.svc.Authenticate(ctx, si.Cookie)
	if err != nil || p.UserID != 1 || p.Role != RoleOwner {
		t.Fatalf("a session ends at sign-out, not by time: %+v %v", p, err)
	}
}

func TestSessionEndsAtSignOut(t *testing.T) { // R5.13
	e := newEnv(t)
	ctx := context.Background()
	si := e.ownerSignIn(1, "alice")
	p, _ := e.svc.Authenticate(ctx, si.Cookie)
	if err := e.svc.SignOut(ctx, p); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Authenticate(ctx, si.Cookie); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("%v", err)
	}
	if !hasAudit(e.store, "auth.signout") {
		t.Fatal("audit")
	}
}

func TestSessionStoresOnlyHash(t *testing.T) { // R5.13
	e := newEnv(t)
	si := e.ownerSignIn(1, "alice")
	for _, v := range e.store.Dump() {
		if v == si.Cookie {
			t.Fatal("the session id must not be stored")
		}
	}
	if _, _, err := e.store.GetSession(context.Background(), Hash(si.Cookie)); err != nil {
		t.Fatalf("the session is found by its hash: %v", err)
	}
	if si.Principal.SessionHash != Hash(si.Cookie) {
		t.Fatal("hash")
	}
}

func TestUnknownAndEmptyCookie(t *testing.T) {
	e := newEnv(t)
	for _, c := range []string{"", "nope"} {
		if _, err := e.svc.Authenticate(context.Background(), c); !errors.Is(err, ErrUnauthenticated) {
			t.Fatalf("%q: %v", c, err)
		}
	}
}

func TestSessionCookieAttributes(t *testing.T) { // web-console R6.1
	c := SessionCookie("v")
	if !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteLaxMode || c.Path != "/" || c.Domain != "" {
		t.Fatalf("session cookie must be HttpOnly, Secure, Lax and host-only: %+v", c)
	}
	if c.MaxAge <= 0 {
		t.Fatal("a browser restart must not sign anyone out")
	}
	if cl := ClearCookie("x"); cl.MaxAge >= 0 || !cl.Secure || !cl.HttpOnly {
		t.Fatalf("clear: %+v", cl)
	}
}

func TestCSRF(t *testing.T) {
	e := newEnv(t)
	si := e.ownerSignIn(1, "alice")
	p, _ := e.svc.Authenticate(context.Background(), si.Cookie)
	if p.CSRF == "" || p.CSRF != si.Principal.CSRF {
		t.Fatal("csrf must be stable for a session so GET /me can show it again")
	}
	if !CheckCSRF(p, p.CSRF) || CheckCSRF(p, "") || CheckCSRF(p, "wrong") {
		t.Fatal("csrf check")
	}
	if CheckCSRF(Principal{CSRF: "x"}, "x") {
		t.Fatal("a CLI principal has no session csrf")
	}
}

func TestGitHubTokenInMemoryOnly(t *testing.T) { // R6.2
	e := newEnv(t)
	ctx := context.Background()
	si := e.ownerSignIn(1, "alice")
	tok, err := e.svc.GitHubToken(1)
	if err != nil || tok.Value == "" {
		t.Fatalf("%v", err)
	}
	noSecretIn(t, e.store.Dump(), tok.Value)
	for _, k := range e.secrets.Keys() {
		v, _ := e.secrets.Get(ctx, k)
		if string(v) == tok.Value {
			t.Fatal("the user token must not be stored")
		}
	}
	e.advance(9 * time.Hour) // GitHub user tokens last 8 hours
	if _, err := e.svc.GitHubToken(1); !errors.Is(err, ErrGitHubSessionExpired) {
		t.Fatalf("%v", err)
	}
	// Web session still lives; only GitHub-backed calls ask for a new sign-in.
	if _, err := e.svc.Authenticate(ctx, si.Cookie); err != nil {
		t.Fatal(err)
	}
	e.signIn(1, "")
	p, _ := e.svc.Authenticate(ctx, si.Cookie)
	if _, err := e.svc.GitHubToken(1); err != nil {
		t.Fatal(err)
	}
	_ = e.svc.SignOut(ctx, p)
	if _, err := e.svc.GitHubToken(1); !errors.Is(err, ErrGitHubSessionExpired) {
		t.Fatal("sign-out drops the token")
	}
}
