# CIX18 report: workflow file checks, their store, Doctor area Workflows

Branch CIX18-workflow-checks (plan row 8, plan name CIX16). Requirements R5.29, R5.30, R5.43. Aligned with DL-99.

## Built (per requirement)
- R5.29: `internal/insights/workflows/checks.go`, pure `Checker` (yaml.v3 nodes for lines). Six checks per job, each failing result names its fix and line. DL-99: timeout over 30 or missing, retries (retry actions, `--retries`/`--reruns` over 0, `rerun-failed`, `retry:` over 0), mutation and runs >= 1000 property tests on pull_request or non-default push (jobs gated to schedule/main are OK), matrix axis/value growth vs previous with job counts, e2e not needing lint/type job and lint after test, missing caches (setup-node, setup-go false, cargo/pip without a cache step). Unreadable or invalid file: one Skip per check with reason.
- R5.30: `analyser.go`, `Analyser` (insights.Analyser): one finding per repository and failing check, jobs and lines in evidence JSON, guardrail G2/G3/G6 set. Minutes: timeout findings count minutes past 30 of jobs in the window (from `JobSource`); others 0.
- R5.29/R5.31/R5.32 stores: `internal/store/insights_checks.go` (`Store.WorkflowChecks()`, `Store.GuardrailReports()` implementing `guardrails.Store`: SaveReport, SaveOwn, Status with latest-per-guardrail and 30-day known-count). Added query `ListGuardrailStatusRows` to `insights_checks.sql` and regenerated sqlc (`sqlcgen/db.go` changed: regenerate at join).
- R5.43: `internal/doctor/checks/workflows.go`: checks `workflow.timeout|retry|matrix_axis|step_order|cache|slow_tests_on_pr` (group workflow, area Workflows), one finding per repository and check, one registration line in `checks.go`. Doctor check counts in `checks_test.go` and `doctor/wire/wire_test.go` raised by 6 (39->45, 41->47); these two files are outside my row, edit is the count only.
- Docs: spec section 9 rows R5.29, R5.30 (web part still planned), R5.43; change note `changes/CIX18.md`.

## Tests and times
- `go test -race -count=2 ./internal/insights/workflows/ ./internal/doctor/... ./internal/store/ -run 'WorkflowChecks|GuardrailStore'`: all ok; workflows 1.0 s, doctor/checks 2.2 s, store subset 5.9 s.
- `go vet` clean. `test_guardrails.py --root .`: no break in my files (existing breaks elsewhere). TestEachCheck has 20 cases, no sleeps.
- docs_check: only the expected W1 for docs/work.
- Not run here: golangci-lint (the sandbox binary is built with go1.25, repo targets 1.27.4) and gitleaks (missing): `fast_guards.py` lint and secret-scan failed for that reason; typecheck PASS.

## Contract gaps (questions for the orchestrator)
- `workflows.Result` has no workflow file path, but `workflow_checks.workflow` does. Workaround: `Store.Latest` and `ForCommit` return `Result.Job` as `<path>#<job>` (job empty: `<path>`); `workflows.SplitJob` splits it. Question: add `Path string` to `Result`?
- `doctor.Env` has no workflow-check source (and `internal/doctor/env.go` is not mine). Workaround: `checks.WorkflowSource` interface plus `checks.SetWorkflowSource`, called at wiring (CIX18/api task); with no source the doctor checks skip.

- `JobFact` has no step times, so `workflow.cache` minutes stay 0 (R5.30 asks for set-up step time over the median). Needs step data from CIX11; left as 0.
- Store `Save` stamps `checked_at` with the wall clock (no clock in the interface).
- A test file `internal/store/insights_checks_test.go` was added (not in the plan row) for the store.

## Left
- Wiring: whoever builds `cmd/crsp/insights_wiring.go` (CIX21) calls `checks.SetWorkflowSource(store.WorkflowChecks())`, registers `workflows.Analyser{Repos, Store, Jobs}`, and feeds `Checker.Check` + `Save` from the file fetch at new head commits (the fetch is not in my row).
- Pruning with `DeleteWorkflowChecksBefore` belongs to CIX10 retention.
- Draft PR: https://github.com/luis-mc/ci-runners-shared-pool/pull/327 (opened with the GitHub MCP tool; gh not used)

CODE DONE a90dfc2
