package main

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api"
)

type fakeEngine struct{ ran chan struct{} }

func (e fakeEngine) RunOnce(context.Context, time.Time) error { return nil }
func (e fakeEngine) Run(ctx context.Context) error {
	close(e.ran)
	<-ctx.Done()
	return ctx.Err()
}

// The wiring mounts the area on the API options and starts the engine; no deps starts nothing.
func TestStartInsights(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	var opts api.Options
	startInsights(context.Background(), logger, &opts, insightsDeps{})
	if opts.Insights != nil || opts.JobRunners != nil {
		t.Fatalf("empty deps mounted something: %+v", opts)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	eng := fakeEngine{ran: make(chan struct{})}
	area := &api.InsightsArea{}
	startInsights(ctx, logger, &opts, insightsDeps{Area: area, Engine: eng})
	<-eng.ran
	if opts.Insights != area {
		t.Error("area not mounted")
	}
}
