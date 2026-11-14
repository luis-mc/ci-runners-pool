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
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
	"github.com/luis-mc/ci-runners-shared-pool/internal/audit"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backup"
	"github.com/luis-mc/ci-runners-shared-pool/internal/events"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/slots"
	"github.com/luis-mc/ci-runners-shared-pool/internal/settings"
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
	// Runners serves the runner operations; nil answers 501 (runners R5.1 to R5.7).
	Runners RunnersService

	// Operations area (CRSP18): settings, audit log, backups. A nil service
	// answers 501 on its routes, like an unbuilt operation.
	Settings *settings.Service
	Audit    *audit.Log
	Backup   *backup.Service
	// Config writes the configuration export (exportConfig); nil answers 501.
	Config ConfigExporter
	// Now stamps export file names; nil uses the clock.
	Now func() time.Time
	// Events receives plan.progress after a stop request; nil publishes nothing.
	Events events.Publisher
	// Update serves the update and restart routes (handlers_update.go). Nil answers 501.
	Update UpdateService
	// GitHub is the GitHub integration area (setup, sign-in, users,
	// repositories). Nil leaves its operations without a backend.
	GitHub *GitHubArea
	// Machines serves the machines routes; nil answers 501 (machines area).
	Machines MachinesService
	// CA serves GET /api/v1/ca.pem.
	CA CAProvider
	// Jobs and Slots serve the jobs and slot routes (handlers_jobs.go).
	Jobs  slots.Jobs
	Slots scheduler.SlotQueue
	// Live serves the overview and the event stream (handlers_live.go). Nil
	// answers 501 like an unbuilt operation.
	Live LiveService
	// Doctor serves the doctor routes (handlers_doctor.go). Nil answers 501.
	Doctor DoctorService
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
	var strictMW []gen.StrictMiddlewareFunc
	var httpMW []gen.MiddlewareFunc
	if opts.GitHub != nil {
		strictMW = append(strictMW, opts.GitHub.StrictMiddleware())
		httpMW = append(httpMW, opts.GitHub.HTTPMiddleware())
	} else {
		strictMW = append(strictMW, unwiredGitHub())
	}
	strict := gen.NewStrictHandlerWithOptions(&server{opts: opts}, strictMW, gen.StrictHTTPServerOptions{
		RequestErrorHandlerFunc: func(w http.ResponseWriter, _ *http.Request, err error) {
			opts.Logger.Debug("bad request", "err", err)
			WriteError(w, http.StatusBadRequest, CodeBadRequest, "the request is not valid")
		},
		ResponseErrorHandlerFunc: func(w http.ResponseWriter, _ *http.Request, err error) {
			opts.Logger.Error("handler failed", "err", err)
			WriteError(w, http.StatusInternalServerError, CodeInternal, "internal error")
		},
	})
	gen.HandlerWithOptions(strict, gen.StdHTTPServerOptions{BaseRouter: mux, Middlewares: httpMW})
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
