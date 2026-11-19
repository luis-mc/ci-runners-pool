package main

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/agentlink"
	"github.com/luis-mc/ci-runners-shared-pool/internal/config"
	"github.com/luis-mc/ci-runners-shared-pool/internal/events"
	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
	"github.com/luis-mc/ci-runners-shared-pool/internal/registry"
	"github.com/luis-mc/ci-runners-shared-pool/internal/registry/builds"
	"github.com/luis-mc/ci-runners-shared-pool/internal/store"
)

type nullSender struct{}

func (nullSender) Send(string, *agentv1.SessionResponse) error { return nil }

type fakeRegistry struct{ ev chan registry.Event }

func (fakeRegistry) Handler() http.Handler                                { return http.NotFoundHandler() }
func (fakeRegistry) SetReadOnly(bool)                                     {}
func (fakeRegistry) DeleteManifest(context.Context, string, string) error { return nil }
func (fakeRegistry) GC(context.Context, bool) (int64, error)              { return 0, nil }
func (f fakeRegistry) Events() <-chan registry.Event                      { return f.ev }

type fakeTokens struct{}

func (fakeTokens) Issue(context.Context, string, []registry.Scope) (registry.Token, error) {
	return registry.Token{}, nil
}
func (fakeTokens) Verify(context.Context, string) (string, []registry.Scope, error) {
	return "", nil, nil
}

func registryTestDeps(t *testing.T) (context.Context, context.CancelFunc, controllerDeps, *controller) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	dir := t.TempDir()
	db, err := store.Open(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	t.Cleanup(cancel)
	d := controllerDeps{
		Cfg: config.Config{DataDir: dir, ListenAddr: "0.0.0.0:8460"}, Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		DB: db, PublicHost: "ctl.example", Link: agentlink.New(nullSender{}),
	}
	return ctx, cancel, d, &controller{}
}

// Without a registry core the program runs as before: the registry routes keep
// answering 501, agents are not offered the registry path, and only what needs
// no core is wired (build records, profiles, key choice).
func TestWireRegistryWithoutCore(t *testing.T) {
	old := openRegistryCore
	openRegistryCore = nil
	t.Cleanup(func() { openRegistryCore = old })
	if registryAvailable() {
		t.Fatal("no core: the handshake must not offer the registry")
	}
	ctx, _, d, c := registryTestDeps(t)
	w, err := wireRegistry(ctx, d, c, nil, nil, events.NewHub(events.Options{}))
	if err != nil {
		t.Fatal(err)
	}
	if w.Core != nil || w.Keyer == nil || w.Stacks == nil || w.Builds == nil {
		t.Fatalf("wiring %+v", w)
	}
	o := c.Options
	if o.Builds == nil {
		t.Fatal("the build records are wired without a core")
	}
	if o.RegistryRead != nil || o.RegistryRetention != nil || o.RegistryReplace != nil {
		t.Fatal("the registry routes must stay 501 without a core")
	}
	if d.Link.Registry != nil {
		t.Fatal("no registry sink without a core: the agent link answers not-in-registry")
	}
	if d.Link.Builds == nil {
		t.Fatal("agents' build reports are kept")
	}
	ps, err := d.DB.Profiles().List(ctx)
	if err != nil || len(ps) == 0 {
		t.Fatalf("standard profiles: %v %v", ps, err)
	}
	c.Close()
}

// With a core the routes are served, the sink answers the agents, and the
// three promoted hooks are registered.
func TestWireRegistryWithCore(t *testing.T) {
	old := openRegistryCore
	t.Cleanup(func() { openRegistryCore = old })
	var hooks []registry.PromotedHook
	openRegistryCore = func(_ context.Context, rd registryCoreDeps) (*registryCore, error) {
		if rd.Images == nil || rd.Host != "ctl.example:8460" {
			t.Errorf("core deps %+v", rd)
		}
		return &registryCore{
			Registry: fakeRegistry{ev: make(chan registry.Event)}, Tokens: fakeTokens{},
			Layers:          layerSourceFunc(func(context.Context, string, string) ([]registry.Layer, error) { return nil, nil }),
			AddPromotedHook: func(h registry.PromotedHook) { hooks = append(hooks, h) },
		}, nil
	}
	if !registryAvailable() {
		t.Fatal("a core: the handshake offers the registry")
	}
	ctx, cancel, d, c := registryTestDeps(t)
	w, err := wireRegistry(ctx, d, c, nil, nil, events.NewHub(events.Options{}))
	if err != nil {
		t.Fatal(err)
	}
	if w.Core == nil {
		t.Fatal("the core is kept")
	}
	o := c.Options
	if o.RegistryRead == nil || o.RegistryRetention == nil || o.RegistryReplace == nil || o.Builds == nil {
		t.Fatalf("options %+v", o)
	}
	if d.Link.Registry == nil {
		t.Fatal("the sink answers the agents")
	}
	if len(hooks) != 3 {
		t.Fatalf("%d promoted hooks, want layers, detection and scan", len(hooks))
	}
	var _ builds.Sink = w.Builds
	cancel()
	c.Close()
}

type layerSourceFunc func(ctx context.Context, name, digest string) ([]registry.Layer, error)

func (f layerSourceFunc) Layers(ctx context.Context, name, digest string) ([]registry.Layer, error) {
	return f(ctx, name, digest)
}
