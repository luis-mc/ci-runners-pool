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

func TestSessionCookieAttributes(t *testing.T) { // R5.13
	c := SessionCookie("v", false)
	if !c.HttpOnly || c.SameSite != http.SameSiteLaxMode || c.Secure || c.Path != "/" {
		t.Fatalf("loopback cookie: %+v", c)
	}
	if c.MaxAge <= 0 {
		t.Fatal("a browser restart must not sign anyone out")
	}
	s := SessionCookie("v", true)
	if !s.Secure {
		t.Fatal("Secure on every non-loopback address")
	}
	for host, want := range map[string]bool{"127.0.0.1:8460": false, "[::1]:8460": false, "pool.lan:8460": true, "10.0.0.2:8460": true} {
		if CookieSecure(host) != want {
			t.Errorf("CookieSecure(%q) != %v", host, want)
		}
	}
	if ClearCookie("x", false).MaxAge >= 0 {
		t.Fatal("clear")
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
