// Package api is the controller's HTTP API. Its routes come from
// packages/contract/openapi.yaml through oapi-codegen (STACKSPEC 4.1); this
// package implements the generated strict server interface.
//
// It reaches the database only through the small interfaces declared here,
// never by importing internal/store (STACKSPEC 3.2, enforced by depguard).
package api

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/slots"
)

// Pinger is what the health route needs from the database.
type Pinger interface {
	Ping(ctx context.Context) error
}

// Options are the dependencies of the API.
type Options struct {
	Version string
	DB      Pinger
	Logger  *slog.Logger
	// Jobs and Slots serve the jobs and slot routes (handlers_jobs.go).
	Jobs  slots.Jobs
	Slots scheduler.SlotQueue
}

type server struct {
	opts Options
}

var _ gen.StrictServerInterface = (*server)(nil)

// Register mounts the API routes on mux. Unknown paths under /api/ answer with
// the JSON error envelope, not the web app.
func Register(mux *http.ServeMux, opts Options) {
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	strict := gen.NewStrictHandlerWithOptions(&server{opts: opts}, nil, gen.StrictHTTPServerOptions{
		RequestErrorHandlerFunc: func(w http.ResponseWriter, _ *http.Request, err error) {
			opts.Logger.Debug("bad request", "err", err)
			WriteError(w, http.StatusBadRequest, CodeBadRequest, "the request is not valid")
		},
		ResponseErrorHandlerFunc: func(w http.ResponseWriter, _ *http.Request, err error) {
			opts.Logger.Error("handler failed", "err", err)
			WriteError(w, http.StatusInternalServerError, CodeInternal, "internal error")
		},
	})
	gen.HandlerWithOptions(strict, gen.StdHTTPServerOptions{BaseRouter: mux})
	mux.HandleFunc("/api/", notFound)
}

// GetHealth implements GET /healthz.
func (s *server) GetHealth(ctx context.Context, _ gen.GetHealthRequestObject) (gen.GetHealthResponseObject, error) {
	if err := s.opts.DB.Ping(ctx); err != nil {
		s.opts.Logger.Error("health: database down", "err", err)
		return gen.GetHealth503JSONResponse{Error: gen.ErrorBody{Code: CodeUnavailable, Message: "database is not available"}}, nil
	}
	return gen.GetHealth200JSONResponse{Status: gen.HealthStatusOk, Version: s.opts.Version}, nil
}

// Recover turns a panic in any handler into a 500 with the error envelope.
func Recover(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				logger.Error("panic in handler", "panic", v, "path", r.URL.Path)
				WriteError(w, http.StatusInternalServerError, CodeInternal, "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
