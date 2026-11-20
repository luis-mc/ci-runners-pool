# CIX21 report: insights API handlers, Job and Settings fields, controller wiring

Branch `CIX21-insights-api` from `CIX-integration` 6b2697f. Plan row 11 (plan id CIX18).

## Built per requirement
- R5.42 and the API side of R5.5/R5.10/R5.11: `internal/api/handlers_insights.go` implements all 15 operations over `InsightsArea` (one optional service per family; nil answers 501). `stubs_insights.go` deleted. Plans pass the signed-in login; ErrNoAction, resolved finding and not-draft plan give 409; unknown id 404. Ranges (days 7/14/30, limit 1 to 100, timeline at most 24 h) give 400. Hold cap from `InsightsArea.HoldCap` (default 120 s). Unknown stays absent, never 0 (known, assertions, estimates).
- R5.39 to R5.41, D7: `JobRunnerReader` on `Options.JobRunners`; `withRunnerInfo` adds runner_origin, runner_group, runner_labels, steps_source, checked_at on list and detail. Queued/running lists drop jobs whose origin is other or hosted.
- Wiring: `cmd/crsp/insights_wiring.go` (`startInsights`, `insightsDeps`), one call in main.go with empty deps until the join fills them.
- R6.7 (speed) is the store's benchmark (row 1), not here.

## Contract gaps (questions for the orchestrator)
1. `jobsdata.Job` (internal/jobsdata/types.go) has no runner origin, group, labels, steps source or checked at; only the sqlc row has them. Local workaround: optional interface `JobRunnerReader` on `Options.JobRunners`; nil leaves the fields absent.
2. `listJobs` in openapi.yaml has no parameter for the D7 "run elsewhere" filter (and `jobsdata.JobFilter` has no origin), so the filter that returns the other jobs is NOT built. Not changed (contract). Workaround: with `state` queued or running, jobs whose origin is other or hosted are dropped from the page when origin is known (page can be shorter than limit). Needs a contract decision: param name and where the filter runs (store).
3. `workflows.Result` has no workflow path, but `WorkflowCheck.workflow` is required. Workaround: it is sent empty. Question: add `Workflow string` to `workflows.Result` (CIX16 data) or take it from `File.Path` at Save.
4. `settings.Settings` / `settings.Patch` have no insights keys yet (CIX10 owns settings.go), so the mapping in handlers_ops.go cannot compile yet. Left for the join.

## Tests and times
`go test -race -count=2 ./internal/api/` (whole package) 60 s; new tests in it under 1 s: TestRolesAndShapes, TestWaitSplitHoldCapAndRanges, TestTimelineSpan, TestUnwiredServiceAnswers501, TestRunnerInfoOnJob. `./cmd/crsp` TestStartInsights ~1 s. go vet, gofmt clean. test_guardrails: no break from my files. fast_guards: secret-scan fails here only because gitleaks is not installed; the rest pass.
Env note: installed golangci-lint (built go1.25) cannot load the repo config (go 1.27.4); I built one with go1.27.4 into $HOME/go/bin so the pre-push hook runs.

## Left
- Settings mapping (gap 4) in handlers_ops.go at the join, after CIX10 adds the keys.
- Wire real services into `insightsDeps` at the join (store readers of CIX9 to CIX17, CIX20; `ErrInsightNotFound` / `ErrPlanNotDraft` / `ErrFindingResolved` mapping for their store errors).
- "Run elsewhere" filter (gap 2).

PR: draft #330 opened with the GitHub tool (gh not used).

CODE DONE 023610d94fd3d0194c43c14d083d2118b81bbcaa
