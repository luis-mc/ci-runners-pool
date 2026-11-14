// Command crsp manages shared self-hosted GitHub Actions runners.
//
// Modes: controller (config, GitHub, scheduling, web app and API), agent (runs
// on every machine and dials the controller), tray (comes later). Every other
// command is the command line for people and scripts, in internal/cli. A mode
// is added with one line in the Modes map of run.
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"runtime/debug"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backup"
	"github.com/luis-mc/ci-runners-shared-pool/internal/cli"
	"github.com/luis-mc/ci-runners-shared-pool/internal/config"
	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor/wire"
	"github.com/luis-mc/ci-runners-shared-pool/internal/events"
	"github.com/luis-mc/ci-runners-shared-pool/internal/hooks"
	"github.com/luis-mc/ci-runners-shared-pool/internal/overview"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler"
	"github.com/luis-mc/ci-runners-shared-pool/internal/store"
	"github.com/luis-mc/ci-runners-shared-pool/internal/tray"
	"github.com/luis-mc/ci-runners-shared-pool/internal/update"
	"github.com/luis-mc/ci-runners-shared-pool/internal/webui"
)

// version is set at build time: -ldflags "-X main.version=1.2.3".
var version = "dev"

// baseContext is the context the controller runs under. A Windows service
// replaces it with one that the service manager's Stop cancels.
var baseContext = context.Background()

func main() {
	if runAsService() {
		return
	}
	hideConsoleForTray(os.Args[1:])
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	if len(args) > 0 && args[0] == "hook" {
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()
		return hooks.Run(ctx, args[1:], hooks.Env{Stdout: stdout, Stderr: stderr})
	}
	if len(args) > 0 && args[0] == "update-helper" {
		// The detached install helper (internal/update); it outlives the service it restarts.
		return update.RunHelper(context.Background(), args[1:], stderr)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	return cli.Run(&cli.Env{
		Stdin:       os.Stdin,
		Stdout:      stdout,
		Stderr:      stderr,
		IsTerminal:  stdinIsTerminal,
		OpenBrowser: openBrowser,
		Version:     version,
		GoVersion:   goVersion(),
		Context:     ctx,
		Modes: map[string]cli.ModeFunc{
			"controller": func(context.Context, []string) error { return runController() },
			"agent": func(_ context.Context, a []string) error {
				return runAgentCmd(a, stdout, stderr)
			},
			"tray": func(_ context.Context, a []string) error {
				if code := tray.Run(a, tray.Options{Version: version, Stdout: stdout, Stderr: stderr}); code != 0 {
					return cli.Exit(code, "the tray could not start")
				}
				return nil
			},
		},
	}, args)
}

func goVersion() string {
	if info, ok := debug.ReadBuildInfo(); ok {
		return info.GoVersion
	}
	return runtime.Version()
}

func stdinIsTerminal() bool {
	fi, err := os.Stdin.Stat()
	return err == nil && fi.Mode()&os.ModeCharDevice != 0
}

// runController runs the controller until a signal or a staged restore ends it.
// After a restore it returns an error, so the exit code is non-zero and the
// service manager starts the controller again.
func runController() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}
	logger := slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: cfg.LogLevel}))

	ctx, stop := signal.NotifyContext(baseContext, os.Interrupt, syscall.SIGTERM)
	defer stop()

	// A restore that was staged before the last exit goes in place now, before
	// the database opens (operations R5.25).
	if applied, err := backup.ApplyPending(cfg.DataDir, cfg.File); err != nil {
		return fmt.Errorf("apply the staged restore: %w", err)
	} else if applied {
		logger.Info("restore applied")
	}

	db, err := store.Open(ctx, cfg.DataDir)
	if err != nil {
		return err
	}
	defer func() { _ = db.Close() }()

	var restarting atomic.Bool
	ops := backup.Start(ctx, backup.StartOptions{
		DB: db, DataDir: cfg.DataDir, ConfigFile: cfg.File, Version: version, Logger: logger,
		Restart: func() {
			// Exit non-zero after the answer is sent; the service manager restarts us.
			restarting.Store(true)
			time.AfterFunc(time.Second, stop)
		},
		DrillHandler: func(drillDB *store.Store) http.Handler {
			m := http.NewServeMux()
			api.Register(m, api.Options{Version: version, DB: drillDB, Logger: logger})
			return m
		},
	})

	idle := &idleHook{}
	mr, err := startMachines(ctx, cfg, logger, idle)
	if err != nil {
		return err
	}
	defer mr.Close()
	// A drain names the job that holds it and flags one far past its usual
	// duration, from job history (machines R5.55, R5.56).
	mr.Service.SetTypical(usualDuration(db))

	// Live view over an empty source until the store adapter is wired (CRSP23).
	hub, live := wire.NewLive(overview.EmptySource{}, events.Options{})
	defer hub.Stop()

	um := startUpdates(ctx, cfg, logger, mr, ops.Settings, idle)
	startTrayChannel(ctx, logger, trayBackend{Updates: um, Drain: machineDrainer{svc: mr.Service}, Console: consoleURL(cfg.ListenAddr)})

	mux := http.NewServeMux()
	queue := scheduler.NewEngine(db, scheduler.WithLogger(logger))
	go scheduler.RunSweeper(ctx, queue, logger, 30*time.Second)
	api.Register(mux, api.Options{
		Version: version, DB: db, Logger: logger,
		Settings: ops.Settings, Audit: ops.Audit, Backup: ops.Backup,
		Machines: mr.Service, CA: mr.CA, Update: um,
		Jobs: db, Slots: queue,
		Live: live,
	})
	mux.Handle("/", webui.Handler())

	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           api.Recover(logger, mux),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}

	errc := make(chan error, 1)
	go func() {
		logger.Info("controller listening", "addr", cfg.ListenAddr, "version", version)
		errc <- srv.ListenAndServe()
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
		logger.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			return err
		}
		if restarting.Load() {
			return errors.New("restarting to apply a restore")
		}
		return nil
	}
}
