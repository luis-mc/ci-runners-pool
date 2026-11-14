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
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"runtime/debug"
	"syscall"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api"
	"github.com/luis-mc/ci-runners-shared-pool/internal/cli"
	"github.com/luis-mc/ci-runners-shared-pool/internal/config"
	"github.com/luis-mc/ci-runners-shared-pool/internal/store"
	"github.com/luis-mc/ci-runners-shared-pool/internal/webui"
)

// version is set at build time: -ldflags "-X main.version=1.2.3".
var version = "dev"

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
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
			"agent": func(context.Context, []string) error {
				return errors.New("agent mode is not implemented in this build")
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

func runController() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}
	logger := slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: cfg.LogLevel}))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := store.Open(ctx, cfg.DataDir)
	if err != nil {
		return err
	}
	defer func() { _ = db.Close() }()

	mux := http.NewServeMux()
	api.Register(mux, api.Options{Version: version, DB: db, Logger: logger})
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
		return srv.Shutdown(shutdownCtx)
	}
}
