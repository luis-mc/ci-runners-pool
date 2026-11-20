# CIX11 report: insights engine, findings store, Do next ranking and weekly digest

Branch CIX11-insights-engine (plan row 1, "CIX9"). Base origin/CIX-integration 6b2697f.

## Built, per requirement
- R5.1: `store.InsightJobSource` (`insights_jobsource.go`) reads `jobs` + `runs` + `repositories` for every runner origin; window bounds compare correctly with stored times with or without milliseconds. Test TestJobSourceAllOrigins, engine_test TestSeesOtherRunnersJobs.
- R5.7: `store.InsightFindings` (`insights_findings.go`) implements `insights.FindingStore` and `insights.RunLog`. TestFindingRoundTrip.
- R5.8: `Sync` opens, refreshes and resolves by owned kind in one transaction; no dismiss method anywhere. Foreign-kind findings are refused by the store and dropped by the engine. TestResolvedAndReopened, TestResolvedWhenConditionEnds, TestFailedRunResolvesNothing, TestNoDismissRoute.
- R5.9: `insights.Minutes` rounds to whole minutes, never negative; store clamps negatives to 0; digest labels "(estimate)". Zero-minute findings rank after the others by guardrail order (Rank and the SQL ORDER BY agree).
- R5.11: `insights.Rank/TopN`, store List ranked in SQL with filters (repository, area, guardrail, open or resolved) and offset cursor. TestListRankFilterPage.
- R5.38: `digest.NewWriter/NewReader/NextRun/Run`: Monday 07:00 local, file `ci-data/digests/<YYYY>-W<ww>.md` for the previous ISO week, top 3, opened and resolved, guardrail changes, wait/hold/run totals, keeps 52. Draft file only, never sent. Store: `InsightDigest` (Findings + Index).
- R6.3: engine (`insights/engine.go`): every 15 min, one analyser at a time, 7-day window, slow pass (>30 s) logged and in `PassStats` (doctor feed via `WithPassHook`). BenchmarkPass20kJobs.
- R6.6: analysers get a window only; FindingStore is the only writer. TestAnalysersNeverWriteSettings.
- R6.7: BenchmarkFindingsPage, page of 50 from 10,000 findings: about 11 ms.
- R6.8: panic or error in an analyser is a failed pass: nothing resolved, others still run, error redacted (`internal/redact`) before log and run row. TestFailOpen.
- R6.9: stored UTC. TestStoredUTC.

## Tests and times (local, -race)
- `go test -race -count=2` of the CIX11 store tests: 28 s total for 9 tests (each opens a migrated DB; each under 10 s).
- `go test -race ./internal/insights/...`: about 1 s per package.
- lint (golangci-lint 2.15.0 on go1.27.4): 0 issues. go vet clean. test_guardrails: no break in my files (existing breaks are in other files).
- fast_guards: change-notes, guards, lint, typecheck PASS; secret-scan FAIL only because `gitleaks` is not installed in this sandbox.
- docs_check: only the expected W1 (docs/work on branch).

## Contract gaps and workarounds
1. `Engine`, `RunLog` and `FindingStore` need no change, but the contract has no Clock: I added `insights.Clock`, `NewEngine(analysers, store, runs, opts...)` in `engine.go` (not the contract file). CIX21 wiring calls `NewEngine` and `Engine.Run`.
2. `JobFact.NodeID` is not in the jobs table; the job source leaves it empty. Needs a value from CIX13 or the waits and runs owners if they read needs edges by node id.
3. `JobFact.QueuedAt` and `SlotAt` come from `jobs.queued_at`/`slot_at`; crsp-less jobs leave them zero as the contract says.
4. Generated `internal/store/sqlcgen/db.go` and `insights_findings.sql.go` changed by my new queries; db.go is a shared file, regenerate at the join (`go tool task codegen:sql`).
5. The weekly digest needs a runner: `digest.Run(ctx, writer, clock, loc, onErr)` exists, CIX21 starts it with the engine.
6. Digest wait/hold/run totals use the R5.12 rule locally (`digest.SumTotals`); if CIX14 exports its split, swap it in.

## Left
Nothing for CIX11. Spec rows of section 9 for my requirements point at real tests; change note `changes/CIX11.md`.
