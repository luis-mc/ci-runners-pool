// Command crsp manages shared self-hosted GitHub Actions runners.
//
// Modes: controller (config, GitHub, scheduling, web app and API), agent (runs
// on every machine and dials the controller), version. The tray mode comes later.
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
	"runtime/debug"
	"syscall"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api"
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
	if len(args) == 0 {
		usage(stderr)
		return 2
	}
	switch args[0] {
	case "version", "--version", "-v":
		_, _ = fmt.Fprintln(stdout, versionString())
		return 0
	case "controller":
		return report(stderr, runController())
	case "agent":
		return report(stderr, errors.New("agent mode is not implemented in this build"))
	case "help", "--help", "-h":
		usage(stdout)
		return 0
	default:
		_, _ = fmt.Fprintf(stderr, "unknown command %q\n\n", args[0])
		usage(stderr)
		return 2
	}
}

func usage(w io.Writer) {
	_, _ = fmt.Fprint(w, `Usage: crsp <command>

Commands:
  controller   run the controller: web console, API and scheduling
  agent        run the agent on a runner machine (not implemented yet)
  version      print the version

Configuration is read from CRSP_* environment variables; see .env.example.
`)
}

func report(stderr io.Writer, err error) int {
	if err == nil {
		return 0
	}
	_, _ = fmt.Fprintln(stderr, "error:", err)
	return 1
}

func versionString() string {
	v := version
	if info, ok := debug.ReadBuildInfo(); ok {
		v += " (" + info.GoVersion + ")"
	}
	return "crsp " + v
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
