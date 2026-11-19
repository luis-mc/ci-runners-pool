package main

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/agentlink"
	"github.com/luis-mc/ci-runners-shared-pool/internal/profiles"
	"github.com/luis-mc/ci-runners-shared-pool/internal/registry"
	"github.com/luis-mc/ci-runners-shared-pool/internal/registry/core"
	"github.com/luis-mc/ci-runners-shared-pool/internal/secrets"
	"github.com/luis-mc/ci-runners-shared-pool/internal/store"
)

// registryTokenKey is the secret-store entry of the key that signs registry
// tokens (registry R5.10).
const registryTokenKey secrets.Key = "crsp/registry/token-key"

// leasePrune is how often the token leases that ended are deleted.
const leasePrune = 5 * time.Minute

// registryCore is the registry core of the controller (REG1): the mounted
// Distribution, the token issuer, the promoter and the agent sink. The sink
// answers tokens and promotes pushes on its own; the join of the other registry
// services sets Sink.Locator, Sink.Recorder and Sink.Outcomes, and hooks into
// Promoter.OnPromoted.
type registryCore struct {
	Registry *core.Registry
	Issuer   *core.Issuer
	Promoter *core.Promoter
	Sink     *core.Sink
	stop     context.CancelFunc
}

// Close stops the registry.
func (r *registryCore) Close() {
	if r != nil {
		r.stop()
		_ = r.Registry.Close()
	}
}

// tokenKey reads the signing key, making it on the first start.
func tokenKey(ctx context.Context, sec secrets.Store) ([]byte, error) {
	k, err := sec.Get(ctx, registryTokenKey)
	if err == nil && len(k) >= 32 {
		return k, nil
	}
	if err != nil && !errors.Is(err, secrets.ErrNotFound) {
		return nil, err
	}
	k = make([]byte, 32)
	if _, err := rand.Read(k); err != nil {
		return nil, err
	}
	return k, sec.Put(ctx, registryTokenKey, k)
}

// startRegistryCore mounts the registry (R5.1). It returns nil and says why in
// the log when the listen address is not a private LAN one (R5.2) or anything
// else stops it: the controller then runs with no registry and agents build
// locally, as before. listenAt is the address the console listens on; the
// registry is served on it and never on another.
func startRegistryCore(ctx context.Context, logger *slog.Logger, db *store.Store, sec secrets.Store, dataDir, listenAt, publicHost string, link *agentlink.Link) *registryCore {
	if err := core.CheckListen(listenAt); err != nil {
		logger.Info("the image registry is not served", "addr", listenAt, "why", err.Error())
		return nil
	}
	rc, err := newRegistryCore(ctx, logger, db, sec, dataDir, listenAt, publicHost)
	if err != nil {
		logger.Warn("the image registry did not start", "err", err)
		return nil
	}
	link.Registry = rc.Sink
	logger.Info("image registry ready", "addr", rc.Sink.Host)
	return rc
}

func newRegistryCore(ctx context.Context, logger *slog.Logger, db *store.Store, sec secrets.Store, dataDir, listenAt, publicHost string) (*registryCore, error) {
	folder := filepath.Join(dataDir, "registry")
	if st, err := db.RegistryRetention().Settings(ctx); err == nil && st.Folder != "" {
		folder = st.Folder
	}
	key, err := tokenKey(ctx, sec)
	if err != nil {
		return nil, fmt.Errorf("the token key: %w", err)
	}
	core0 := db.RegistryCore()
	issuer := &core.Issuer{Secret: key, Leases: core0, Gate: &core.DiskGate{Folder: folder}}
	reg, err := core.New(ctx, core.Options{Dir: folder, ListenAddr: listenAt, Tokens: issuer, Logger: logger})
	if err != nil {
		return nil, err
	}
	_, port, err := net.SplitHostPort(listenAt)
	if err != nil {
		_ = reg.Close()
		return nil, err
	}
	promoter := &core.Promoter{Registry: reg, Ledger: core0, Log: logger}
	prof := db.Profiles()
	sink := &core.Sink{
		Tokens: issuer, Promoter: promoter, Host: net.JoinHostPort(publicHost, port), ReadOnly: reg.ReadOnly, Log: logger,
		Target: func(ctx context.Context, repository, profile string) (string, error) {
			return imageTarget(ctx, prof, repository, profile)
		},
	}
	runCtx, stop := context.WithCancel(ctx)
	go core.LogEvents(runCtx, reg.Events(), logger)
	go func() {
		t := time.NewTicker(leasePrune)
		defer t.Stop()
		for {
			select {
			case <-runCtx.Done():
				return
			case now := <-t.C:
				if _, err := core0.PruneLeases(runCtx, now); err != nil && runCtx.Err() == nil {
					logger.Warn("registry: could not prune the token leases", "err", err)
				}
			}
		}
	}()
	return &registryCore{Registry: reg, Issuer: issuer, Promoter: promoter, Sink: sink, stop: stop}, nil
}

// imageTarget names the image a build of (repository, profile) is promoted to:
// the standard image of a standard profile, the custom image of the repository
// for a custom one (registry R5.4).
func imageTarget(ctx context.Context, ps interface {
	Get(ctx context.Context, id string) (profiles.Profile, error)
}, repository, profile string) (string, error) {
	p, err := ps.Get(ctx, profile)
	if err != nil {
		return "", err
	}
	if p.Kind == registry.KindStandard {
		return registry.StdName(profile), nil
	}
	owner, repo, ok := splitRepository(repository)
	if !ok {
		return "", fmt.Errorf("a custom image needs the owner/name of its repository, got %q", repository)
	}
	return registry.CustomName(owner, repo, profile), nil
}

func splitRepository(r string) (owner, repo string, ok bool) {
	owner, repo, ok = strings.Cut(r, "/")
	return owner, repo, ok && owner != "" && repo != ""
}

// mountRegistry puts /v2/ on the mux of the console listener.
func mountRegistry(mux *http.ServeMux, rc *registryCore) {
	if rc != nil {
		mux.Handle("/v2/", rc.Registry.Handler())
	}
}
