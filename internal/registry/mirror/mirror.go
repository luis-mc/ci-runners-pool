package mirror

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/distribution/distribution/v3/registry/handlers"
	// The storage driver the proxy instances keep their content in.
	_ "github.com/distribution/distribution/v3/registry/storage/driver/filesystem"

	"github.com/luis-mc/ci-runners-shared-pool/internal/registry"
)

// Guard wraps the mirror's handler with the registry token check (R5.3, R5.67).
// REG1 owns the token issuer and verifier and passes the guard in.
type Guard func(http.Handler) http.Handler

// Options build a Mirror.
type Options struct {
	DataDir string
	Logger  *slog.Logger
	// Guard checks the registry token of every request. Nil refuses every
	// request with 401: the mirror is never served anonymously.
	Guard Guard
	// Now is the clock of the used-bytes cache; nil uses the real one.
	Now func() time.Time
}

// Mirror implements registry.Mirror.
type Mirror struct {
	opts Options

	mu       sync.RWMutex
	settings registry.MirrorSettings
	apps     map[string]*handlers.App // by upstream host
	folder   string

	usedMu   sync.Mutex
	usedAt   time.Time
	usedSize int64
}

var _ registry.Mirror = (*Mirror)(nil)

// New returns a mirror that serves nothing until Apply is called.
func New(o Options) *Mirror {
	if o.Logger == nil {
		o.Logger = slog.Default()
	}
	if o.Now == nil {
		o.Now = time.Now
	}
	return &Mirror{opts: o, apps: map[string]*handlers.App{}}
}

// Handler serves PathPrefix: /mirror/<upstream>/v2/... goes to the proxy of that
// upstream with the prefix removed. A request for an upstream that is not
// mirrored, or while the mirror is off, is a 404.
func (m *Mirror) Handler() http.Handler {
	inner := http.Handler(http.HandlerFunc(m.serve))
	if m.opts.Guard == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Www-Authenticate", `Bearer realm="crsp"`)
			http.Error(w, "the mirror needs a registry token", http.StatusUnauthorized)
		})
	}
	return m.opts.Guard(inner)
}

func (m *Mirror) serve(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, PathPrefix)
	host, tail, ok := strings.Cut(rest, "/")
	if !ok || host == "" {
		http.NotFound(w, r)
		return
	}
	m.mu.RLock()
	app := m.apps[strings.ToLower(host)]
	budget := m.settings.BudgetBytes
	m.mu.RUnlock()
	if app == nil {
		http.NotFound(w, r)
		return
	}
	// Over budget: refuse new reads so the folder stops growing. Engines fall
	// back to the upstream when a mirror answers an error (R5.64).
	if budget > 0 && m.UsedBytes() > budget {
		w.Header().Set("Retry-After", "300")
		http.Error(w, "the mirror is full", http.StatusServiceUnavailable)
		return
	}
	r2 := r.Clone(r.Context())
	r2.URL.Path = "/" + tail
	r2.URL.RawPath = ""
	app.ServeHTTP(w, r2)
}

// Apply starts one proxy per upstream, or stops them all when the mirror is off.
// The old instances are shut down after the new ones are in place.
func (m *Mirror) Apply(ctx context.Context, s registry.MirrorSettings) error {
	s, err := Validate(s)
	if err != nil {
		return err
	}
	folder := Folder(s, m.opts.DataDir)
	apps := map[string]*handlers.App{}
	if s.Enabled {
		for _, up := range s.Upstreams {
			app, err := m.start(ctx, s, up)
			if err != nil {
				closeAll(apps)
				return err
			}
			apps[up] = app
		}
	}
	m.mu.Lock()
	old := m.apps
	m.apps, m.settings, m.folder = apps, s, folder
	m.mu.Unlock()
	closeAll(old)
	m.usedMu.Lock()
	m.usedAt = time.Time{}
	m.usedMu.Unlock()
	return nil
}

func (m *Mirror) start(ctx context.Context, s registry.MirrorSettings, up string) (app *handlers.App, err error) {
	cfg, err := ProxyConfig(s, m.opts.DataDir, up)
	if err != nil {
		return nil, err
	}
	root := cfg.Storage.Parameters()["rootdirectory"].(string)
	if err := os.MkdirAll(root, 0o700); err != nil {
		return nil, fmt.Errorf("create the mirror folder for %s: %w", up, err)
	}
	// Distribution panics on a configuration it cannot run with.
	defer func() {
		if p := recover(); p != nil {
			app, err = nil, fmt.Errorf("start the mirror of %s: %v", up, p)
		}
	}()
	return handlers.NewApp(context.WithoutCancel(ctx), cfg), nil
}

func closeAll(apps map[string]*handlers.App) {
	for _, a := range apps {
		_ = a.Shutdown()
	}
}

// Close stops every proxy.
func (m *Mirror) Close() error {
	m.mu.Lock()
	old := m.apps
	m.apps = map[string]*handlers.App{}
	m.mu.Unlock()
	closeAll(old)
	return nil
}

// Settings returns the settings now applied.
func (m *Mirror) Settings() registry.MirrorSettings {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.settings
}

// UsedBytes is the size of the mirror folder, measured at most every 30 seconds.
func (m *Mirror) UsedBytes() int64 {
	m.mu.RLock()
	folder := m.folder
	m.mu.RUnlock()
	if folder == "" {
		return 0
	}
	m.usedMu.Lock()
	defer m.usedMu.Unlock()
	if now := m.opts.Now(); now.Sub(m.usedAt) > 30*time.Second {
		m.usedSize, m.usedAt = DirSize(folder), now
	}
	return m.usedSize
}

// DirSize adds up the files under dir; a missing folder is 0 bytes.
func DirSize(dir string) int64 {
	var n int64
	_ = filepath.WalkDir(dir, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				return nil
			}
			return nil
		}
		if !d.IsDir() {
			if info, err := d.Info(); err == nil {
				n += info.Size()
			}
		}
		return nil
	})
	return n
}
