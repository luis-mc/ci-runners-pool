package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api"
	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/registry"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backup"
	"github.com/luis-mc/ci-runners-shared-pool/internal/caches"
	"github.com/luis-mc/ci-runners-shared-pool/internal/config"
	"github.com/luis-mc/ci-runners-shared-pool/internal/configexport"
	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor"
	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor/wire"
	"github.com/luis-mc/ci-runners-shared-pool/internal/events"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
	"github.com/luis-mc/ci-runners-shared-pool/internal/notify"
	"github.com/luis-mc/ci-runners-shared-pool/internal/overview"
	"github.com/luis-mc/ci-runners-shared-pool/internal/repos"
	"github.com/luis-mc/ci-runners-shared-pool/internal/runners"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler"
	"github.com/luis-mc/ci-runners-shared-pool/internal/secrets"
	"github.com/luis-mc/ci-runners-shared-pool/internal/store"
	"github.com/luis-mc/ci-runners-shared-pool/internal/tlsca"
)

const (
	envPoolName     = "CRSP_POOL_NAME"
	defaultPoolName = "crsp-home"
	// runsOnRestoreEvery is how often the RUNS_ON variables are put back to
	// what the policy wants (github-integration R5.28).
	runsOnRestoreEvery = 10 * time.Minute
)

// controllerDeps is everything buildController needs that runController (or a
// test) makes first. runController and the wiring guard test both call
// buildController, so the test checks the wiring the binary runs.
type controllerDeps struct {
	Cfg     config.Config
	Logger  *slog.Logger
	DB      *store.Store
	Secrets secrets.Store
	Ops     *backup.Ops
	// Machines is the machines service; CA the controller's certificate authority.
	Machines *machines.Service
	CA       api.CAProvider
	Updates  api.UpdateService
	Queue    scheduler.SlotQueue
	// Caches is the caches service of the machines runtime (web-console R5.25).
	Caches *caches.Service
	// MachineSecrets is the secret source the config export reads (mr.Secrets).
	MachineSecrets secrets.Store
	// Backends are the runner backends of the controller's own OS; nil means none.
	Backends backend.Registry
	Now      func() time.Time
}

// controller is the built controller: the API options, the setup link printed
// at start, and the pieces runController also needs.
type controller struct {
	Options api.Options
	// SetupLink is the one-time first-run link; empty when an owner exists.
	SetupLink string
	Auth      *auth.Service
	Repos     *repos.Service
	Hub       *events.MemHub
	closers   []func()
}

// Close stops what buildController started.
func (c *controller) Close() {
	for i := len(c.closers) - 1; i >= 0; i-- {
		c.closers[i]()
	}
}

// buildController wires the GitHub area, the runners service and the doctor
// beside what runController made, and starts their background work under ctx
// (the RUNS_ON restore loop, the first installation sync).
func buildController(ctx context.Context, d controllerDeps) (*controller, error) {
	if d.Now == nil {
		d.Now = time.Now
	}
	logger := d.Logger
	console := consoleURL(d.Cfg.ListenAddr)
	pool := os.Getenv(envPoolName)
	if pool == "" {
		pool = defaultPoolName
	}
	c := &controller{}

	// GitHub: client, sign-in, repositories, webhook.
	gh := github.New(github.Config{Secrets: d.Secrets, Logger: logger})
	authStore, repoStore := d.DB.Auth(), repos.NewMemStore()
	asvc := auth.New(authStore, auth.Config{
		GitHub: gh, Secrets: d.Secrets, Now: d.Now,
		ConsoleURLs: func() []string { return []string{console} },
		OnApp:       func(a auth.AppRecord) { gh.UseApp(a.ID, a.ClientID) },
	})
	asvc.SetConsoleURLs([]string{console})
	if st, err := asvc.State(ctx); err == nil && st.HasApp {
		gh.UseApp(st.App.ID, st.App.ClientID)
	}
	rsvc := repos.New(repos.Config{Store: repoStore, GitHub: gh, Tokens: asvc, Audit: asvc,
		Capacity: machineCapacity{svc: d.Machines, pool: pool}, Now: d.Now})
	hook := &github.WebhookHandler{
		Verifier: func() (github.WebhookVerifier, error) {
			app := gh.AppID()
			if app == 0 {
				return nil, errors.New("no GitHub App yet")
			}
			b, err := d.Secrets.Get(context.Background(), github.SecretKey(app, github.SecretWebhookSecret))
			if err != nil {
				return nil, err
			}
			return github.NewWebhookVerifier(b), nil
		},
		FirstDelivery: newDeliveryLog(4096).first,
		Events:        webhookEvents{ctx: ctx, logger: logger, repos: rsvc},
	}
	c.Options.GitHub = &api.GitHubArea{Auth: asvc, Repos: rsvc, Webhook: hook, Logger: logger}
	c.Auth, c.Repos = asvc, rsvc

	// RUNS_ON variables: put back to the policy every 10 minutes, and once now.
	loopCtx, stopLoop := context.WithCancel(ctx)
	loopDone := make(chan struct{})
	go func() {
		defer close(loopDone)
		runsOnLoop(loopCtx, logger, gh, rsvc)
	}()
	c.closers = append(c.closers, func() { stopLoop(); <-loopDone })

	// Live view over an empty source until the store adapter is wired (CRSP23).
	hub, live := wire.NewLive(overview.EmptySource{}, events.Options{})
	c.Hub = hub
	c.closers = append(c.closers, hub.Stop)

	// Runners: the controller's own OS through the backend registry; other
	// machines wait for the runner messages on the agent link.
	reg := d.Backends
	if reg == nil {
		reg = registry.Platform(registry.RealDeps(nil, secretRedactor.Redact, secretRedactor.Add))
	}
	rstore := runners.NewMemStore()
	runnerSvc := &runners.Service{
		Store: rstore, Machines: machineLookup{svc: d.Machines}, Resolver: scopeResolver{repos: repoStore, auth: asvc},
		GitHub: gh, Agent: linkAgent{local: runners.NewLocalAgent(reg), svc: d.Machines}, Audit: runnerAudit{auth: asvc},
		PoolName: pool, CacheQuota: d.Cfg.Cache, Now: d.Now,
	}

	// Light runners: one per repository and OS, on a machine with a light slot
	// (scheduling R5.65).
	runnerSvc.Light = lightPlacer{svc: d.Machines}
	rsvc.SetLight(lightKeeper{svc: runnerSvc})

	// Doctor: the M1 check registry over the controller's own data.
	_, docSvc := wire.NewDoctor(wire.DoctorDeps{
		Fleet: doctorFleet{machines: d.Machines, runners: rstore, repos: repoStore, rsvc: rsvc},
		GitHub: func(context.Context) (doctor.GitHub, error) {
			if gh.AppID() == 0 {
				return nil, nil
			}
			return gh, nil
		},
		Store: doctor.NewMemStore(), Events: hub, Logger: logger, PoolName: pool,
	})

	c.Options.Version, c.Options.DB, c.Options.Logger = version, d.DB, logger
	c.Options.Settings, c.Options.Audit, c.Options.Backup = d.Ops.Settings, d.Ops.Audit, d.Ops.Backup
	c.Options.Machines, c.Options.CA, c.Options.Update = d.Machines, d.CA, d.Updates
	c.Options.Jobs, c.Options.Slots, c.Options.Live = d.DB, d.Queue, live
	c.Options.Runners, c.Options.Doctor = runnerSvc, docSvc
	c.Options.Caches, c.Options.Events = d.Caches, hub
	c.Options.Notify = notify.New(notify.Config{DB: d.DB, Secrets: d.Secrets, Logger: logger})
	c.Options.Config = configexport.Source{
		Version: version, Config: d.Cfg, Settings: d.Ops.Settings, Secrets: d.MachineSecrets,
		Named: []configexport.NamedSecret{
			{Name: "Controller certificate authority key", Key: tlsca.CAKeySecret},
			{Name: "Controller server key", Key: tlsca.ServerKeySecret},
		},
	}

	// First run: a one-time setup link while there is no owner (github-integration R5.1).
	code, err := asvc.NewSetupCode(ctx)
	if err != nil {
		c.Close()
		return nil, fmt.Errorf("make the setup link: %w", err)
	}
	if code != "" {
		c.SetupLink = setupLink(console, code)
		logger.Info("first run: open this one-time setup link to connect GitHub", "link", c.SetupLink)
		_, _ = fmt.Fprintf(os.Stderr, "First run: open this one-time setup link to connect GitHub:\n  %s\n", c.SetupLink)
	}
	return c, nil
}

// setupLink is the address of the setup page with its one-time code.
func setupLink(console, code string) string {
	return strings.TrimRight(console, "/") + "/setup?code=" + url.QueryEscape(code)
}

// runsOnLoop syncs installations and puts the RUNS_ON variables back every 10
// minutes until ctx ends. It does nothing until a GitHub App exists.
func runsOnLoop(ctx context.Context, logger *slog.Logger, gh *github.REST, rsvc *repos.Service) {
	tick := func() {
		if gh.AppID() == 0 {
			return
		}
		if err := rsvc.ReconcileInstallations(ctx); err != nil && ctx.Err() == nil {
			logger.Warn("reconcile installations", "err", err)
		}
		if err := rsvc.ReconcileAllVariables(ctx); err != nil && ctx.Err() == nil {
			logger.Warn("restore RUNS_ON variables", "err", err)
		}
	}
	tick()
	t := time.NewTicker(runsOnRestoreEvery)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			tick()
		}
	}
}

// deliveryLog remembers recent webhook delivery ids so a repeat is ignored (R5.36).
type deliveryLog struct {
	mu    sync.Mutex
	seen  map[string]bool
	order []string
	max   int
}

func newDeliveryLog(max int) *deliveryLog { return &deliveryLog{seen: map[string]bool{}, max: max} }

func (l *deliveryLog) first(id, _ string) (bool, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.seen[id] {
		return false, nil
	}
	l.seen[id] = true
	l.order = append(l.order, id)
	if len(l.order) > l.max {
		delete(l.seen, l.order[0])
		l.order = l.order[1:]
	}
	return true, nil
}

// webhookEvents receives verified deliveries. An installation change starts a
// reconcile; job events are logged until the scheduler takes them from here.
type webhookEvents struct {
	ctx    context.Context
	logger *slog.Logger
	repos  *repos.Service
}

func (w webhookEvents) Job(j github.Job) {
	w.logger.Debug("workflow_job event", "repository", j.Repository, "job", j.ID, "status", j.Status)
}

func (w webhookEvents) Installation(event string, _ []byte) {
	w.logger.Info("installation event", "event", event)
	go func() {
		if err := w.repos.ReconcileInstallations(w.ctx); err != nil && w.ctx.Err() == nil {
			w.logger.Warn("reconcile installations", "err", err)
		}
	}()
}

// setupOrConsole is the tray's link issuer: while no owner exists the link
// carries the one-time setup code; after that it is the one-time sign-in link
// of the signed-in OS user (next, TRAY1), or the plain console address.
type setupOrConsole struct {
	auth    *auth.Service
	console string
	// next makes the link once an owner exists; nil gives the plain address.
	next interface {
		LinkFor(ctx context.Context, osUser, target string) (string, error)
	}
}

func (s setupOrConsole) LinkFor(ctx context.Context, osUser string, target string) (string, error) {
	if code, err := s.auth.NewSetupCode(ctx); err == nil && code != "" {
		return setupLink(s.console, code), nil
	}
	if s.next != nil {
		return s.next.LinkFor(ctx, osUser, target)
	}
	u, err := url.Parse(s.console)
	if err != nil {
		return "", errors.New("the console address is not valid")
	}
	if len(target) > 0 && target[0] == '/' && (len(target) == 1 || target[1] != '/') {
		u.Path = target
	}
	return u.String(), nil
}
