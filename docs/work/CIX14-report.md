# CIX14 report (plan CIX12): waits, holds, housekeeping, timeline, idle runners

Branch CIX14-waits-timeline from CIX-integration 6b2697f.

## Built per requirement
- R5.12 `waits/split.go` `NewSplitter`: crsp job wait = created to slot_at, hold = slot_at to started_at, run; other runner wait = created to started_at, hold not known (not zero); never negative, unknown is Known=false; GitHubWait = created to queued.
- R5.13 `waits/split.go` `Aggregate`, `NewReader` (`SplitBy` 7/14/30 days; by repository, job key, UTC day): count, total, median, p95 (nearest rank).
- R5.14 `waits/analyser.go` `Analyser`: holds over the cap (setting 30..900 s via `HoldCap` func, default 2 min) with reason from `HoldExplainer` (error = unknown); over-cap holds adding to 10 min or more a week per job key give `wait.hold`; minutes = excess over cap, scaled to a week.
- R5.28 same analyser: median run under 1 min and median wait over 2 min (at least 3 jobs, my choice) gives `housekeeping.lane`; action `light_lane` when `LightRoom.HasLightRoom` is true.
- R5.21 `timeline/build.go` `NewBuilder`: lanes (crsp by machine, others by name), job and idle segments, markers idle_while_waiting (label subset check) and after_merge_work; range over 24 h is an error; sorted origin then name.
- R5.22 `timeline/idle.go` `IdleAnalyser`: idle spans of 2 min or more, merged per label set, against waiting jobs the idle runners cannot take by labels; 15 min a week or more gives `pool.idle_next_to_queue`; action `machine_slots` when the idle runner has a machine.
- Spec section 9 rows R5.12 to R5.14, R5.21, R5.22, R5.28 now real paths; change note `changes/CIX14.md`.

## Tests
`go test -race -count=2 ./internal/insights/waits/ ./internal/insights/timeline/`: both ok, about 1 s each. `go vet` clean. No sleeps, no tables over 20, no test guardrail finding in my files. Files: waits/{split,hold,housekeeping}_test.go, timeline/{timeline,idle}_test.go (+ helpers_test.go each).
- docs_check: only the expected W1 (docs/work on branch).
- fast_guards.py: gitleaks not installed here; golangci-lint in this sandbox is built with go1.25 and refuses go 1.27.4 config. Both are tooling, not my code. CI is the gate.

## Contract gaps (questions for orchestrator)
1. No contract interface gives crsp runner idle history. I defined `timeline.RunnerStates.IdleSpans(ctx, window) []RunnerIdle` in my package. Who implements it over runner state history (CIX18 wiring or a store reader)? Until then the timeline and idle analyser have no production source.
2. No implementation of `waits.HoldExplainer` (runner set-up log) or `waits.LightRoom` (machine room for a light slot) exists; both nil-safe (reason unknown, no light_lane action). Wiring must supply them, and a `HoldCap` func reading `insights_hold_cap_seconds`.
3. Analysers are exported as `waits.Analyser` and `timeline.IdleAnalyser` with struct fields for dependencies (no constructors); builder `timeline.NewBuilder(JobSource, RunnerStates)`.
4. R5.28 busiest-hours heatmap not used; the fix text is generic.

## Left
Nothing for my requirements; store-side readers for the gaps above.

CODE DONE (sha in final message)

Draft PR: #323. Code head: d071d09
CODE DONE d071d0962ad58480d10db7dab788ad6fbd81df96
