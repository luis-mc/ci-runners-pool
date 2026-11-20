package main

import (
	"context"
	"log/slog"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api"
	"github.com/luis-mc/ci-runners-shared-pool/internal/insights"
)

// insightsDeps is what the CI run insights routes and the engine run on (docs/features/ci-run-insights R5.42).
// Each analyser family builds its own service over the store; the join of the wave fills the fields. A nil
// Area field answers 501 on its routes; a nil Engine starts no pass.
type insightsDeps struct {
	Area *api.InsightsArea
	// Runners says who ran a job (R5.39 to R5.41); nil leaves those job fields absent.
	Runners api.JobRunnerReader
	// Engine runs the analysers every 15 minutes (R6.3).
	Engine insights.Engine
}

// startInsights mounts the insights services on the API options and starts the engine until ctx ends. A
// failed pass never stops the controller (R6.8): the engine logs it and the next pass runs.
func startInsights(ctx context.Context, logger *slog.Logger, opts *api.Options, d insightsDeps) {
	opts.Insights = d.Area
	opts.JobRunners = d.Runners
	if d.Engine == nil {
		return
	}
	go func() {
		if err := d.Engine.Run(ctx); err != nil && ctx.Err() == nil {
			logger.Error("insights engine stopped", "err", err)
		}
	}()
}
