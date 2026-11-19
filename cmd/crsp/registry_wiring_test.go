package main

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/agentlink"
	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
	"github.com/luis-mc/ci-runners-shared-pool/internal/profiles"
	"github.com/luis-mc/ci-runners-shared-pool/internal/registry"
	"github.com/luis-mc/ci-runners-shared-pool/internal/secrets"
	"github.com/luis-mc/ci-runners-shared-pool/internal/store"
)

func quietLog() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// R5.1, R5.2, R5.3: the core mounts under /v2/ on a private address, answers
// nothing without a token, and refuses a wildcard or public address.
func TestRegistryCoreWiring(t *testing.T) {
	ctx := context.Background()
	db, err := store.OpenForTests(ctx, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()
	sec := secrets.NewMemory()
	data := t.TempDir()

	for _, addr := range []string{"0.0.0.0:8460", "[::]:8460", "8.8.8.8:8460", ":8460"} {
		link := &agentlink.Link{}
		if rc := startRegistryCore(ctx, quietLog(), db, sec, data, addr, "ctl.lan", link); rc != nil || link.Registry != nil {
			t.Fatalf("the registry started on %q", addr)
		}
	}
	if _, err := filepath.Glob(filepath.Join(data, "registry", "*")); err != nil {
		t.Fatal(err)
	}

	link := &agentlink.Link{}
	rc := startRegistryCore(ctx, quietLog(), db, sec, data, "192.168.1.20:8460", "ctl.lan", link)
	if rc == nil {
		t.Fatal("the registry did not start on a private address")
	}
	defer rc.Close()
	if link.Registry != rc.Sink || rc.Sink.Host != "ctl.lan:8460" {
		t.Fatalf("sink = %v host = %q", link.Registry, rc.Sink.Host)
	}
	mux := http.NewServeMux()
	mountRegistry(mux, rc)
	srv := httptest.NewServer(mux)
	defer srv.Close()
	get := func(token string) int {
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/v2/", nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		_ = resp.Body.Close()
		return resp.StatusCode
	}
	if c := get(""); c != http.StatusUnauthorized {
		t.Fatalf("anonymous: %d", c)
	}
	tok := rc.Sink.RegistryToken(ctx, "m1", &agentv1.RegistryTokenRequest{Action: agentv1.RegistryTokenRequest_ACTION_PULL, Names: []string{"crsp/std/base"}})
	if tok.GetToken() == "" {
		t.Fatalf("no token: %q", tok.GetRefused())
	}
	if c := get(tok.GetToken()); c != http.StatusOK {
		t.Fatalf("with a token: %d", c)
	}
	// the lease is recorded by id, machine and names
	if n, err := db.RegistryRetention().LiveLeases(ctx, time.Now(), "crsp/std/base"); err != nil || n != 1 {
		t.Fatalf("live leases = %d %v", n, err)
	}
	// the key is kept: a restart reads the same key and the token still verifies
	rc2, err := newRegistryCore(ctx, quietLog(), db, sec, t.TempDir(), "192.168.1.20:8460", "ctl.lan")
	if err != nil {
		t.Fatal(err)
	}
	defer rc2.Close()
	if _, _, err := rc2.Issuer.Verify(ctx, tok.GetToken()); err != nil {
		t.Fatalf("the token key changed: %v", err)
	}
}

type fakeProfiles map[string]profiles.Profile

func (f fakeProfiles) Get(_ context.Context, id string) (profiles.Profile, error) {
	p, ok := f[id]
	if !ok {
		return profiles.Profile{}, registry.ErrNotFound
	}
	return p, nil
}

// R5.4: the target of a build follows the kind of its profile.
func TestImageTarget(t *testing.T) {
	ctx := context.Background()
	ps := fakeProfiles{"base": {ID: "base", Kind: registry.KindStandard}, "web": {ID: "web", Kind: registry.KindCustom}}
	for _, c := range []struct{ repo, profile, want string }{
		{"Acme/App", "base", "crsp/std/base"},
		{"Acme/App", "web", "crsp/custom/acme-app/web"},
	} {
		if got, err := imageTarget(ctx, ps, c.repo, c.profile); err != nil || got != c.want {
			t.Errorf("%v = %q %v", c, got, err)
		}
	}
	for _, c := range [][2]string{{"", "web"}, {"noslash", "web"}, {"a/b", "nope"}} {
		if got, err := imageTarget(ctx, ps, c[0], c[1]); err == nil {
			t.Errorf("%v gave %q", c, got)
		}
	}
	if !strings.HasPrefix(registry.IncomingPrefix, "crsp/incoming/") {
		t.Fatal("staging root")
	}
}
