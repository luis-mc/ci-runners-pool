# CIX17 report (plan row 7, CIX15): run savings, superseded, duplicate, fail-fast

Branch CIX17-run-savings from CIX-integration 6b2697f. Owns `internal/insights/runs/**`.

## Built (internal/insights/runs)
- R5.23 `savings.go`: `NewSavings().Top` — critical path by latest-ending need; for each job on it simulates the run end with (a) no queue/slot wait, (b) median run, (c) start at needs end; top 3, >= 30 s, words "The run would end {n} min sooner if ...". Analyser: `run.critical_path`, subject workflow|job|change, 10 min/week.
- R5.24 `SupersededMinutes` (same workflow, branch, event; newer run, other head, created before job start; cancelled not counted; schedule excluded). Fix = concurrency snippet; skipping queued superseded jobs is advice only.
- R5.25 `TwoEventsOneHead` (second run's minutes). R5.26 `FindRetestedTrees` over `TreeReader` (ok=false skips; PR run must be all green and earlier).
- R5.27 `FailFastMinutes`; release branches (prefix "release", `Analyser.Release` overridable) never get advice (DL-98).
- `analyser.go` (insights.Analyser "runs", 5 kinds), `reader.go` (`StoreReader`, getRunSavings + fail-fast waste).

## Tests
`go test -race -count=2 ./internal/insights/runs` ok (~1 s). go vet ok. No sleeps, no tables.

## Contract gaps (questions for orchestrator)
1. No needs-edge reader and no run reader in the contract: local `GraphSource` and `RunSource` interfaces (CIX9/CIX18 must implement or adapt).
2. How is a release run known? Local workaround: branch prefix "release" (case-insensitive), injectable.
3. Reader returns fail-fast waste only; superseded/duplicate/retested waste need sibling runs and come via findings.
4. Medians keyed by `JobIdent`, successful jobs, over the window.
5. Superseded on default branch is counted as in spec; fix text warns to keep cancel off there if needed.

## Left
Nothing for the spec rows; wiring in cmd/crsp is CIX18's.

## Checks
fast_guards.py: lint step fails here (golangci-lint built with go1.25, repo targets 1.27.4) and gitleaks is missing: sandbox tooling, not my files. test_guardrails: my files add no break (existing break: internal/notify/notify_test.go:144). docs_check: only the expected W1.

CODE DONE 4eb3fca
