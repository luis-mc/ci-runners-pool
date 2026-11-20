# CIX19 report: test report parsers, test times, flaky, duplicate tests, guardrails

Branch `CIX19-test-reports` from `CIX-integration` (6b2697f). Plan row 9 (plan id CIX17). Requirements R5.31 to R5.37.

## Built per requirement
- R5.33 parsers (`internal/insights/tests`): JUnit XML (also nextest, pytest; surefire rerun elements count as retries), Playwright JSON, vitest JSON, `go test -json` (artifact or job log, noise lines skipped), cargo libtest JSON, dotnet TRX, plus the dev-standards `ci-run-times` and `ci-timings.json` (both forms) as formats `ci-run-times` and `ci-timings`. Detection by content (`Detect`, `ParseAny`). JSON parsers stream one top-level element at a time. `DefaultNormaliser` (test id with no durations or seeds; kind from job and file names). Fixtures in `testdata/` (not in `*_test` files).
- R5.34 `Times`, `SlowTests`, `OverLimitCount`: median, p95, failures, G1 limit mark; `test.slow` for the top 5 tests of a repository with 5 min or more of tests in the window.
- R5.35 `FlakyTests`: same test, job key and head commit, different results across attempts, or passed after a retry. Skipped is no result. Minutes = re-run time.
- R5.36 `DuplicateTests`: same test id in 2 or more job keys of one run attempt; a job key drops the matrix values (`build (linux)` and `build (mac)` are one). Minutes = all runs but the longest.
- R5.37 `FindNoAssertions`: only `Assertions == 0` on a passed test; -1 (not reported) never counts. JUnit reports `assertions`; every other parser gives -1.
- `Service` (tests): `insights.Analyser` ("tests") and the `Reader` for listTestInsights (views slowest, flaky, duplicated, no_assertions; cursor = offset).
- R5.31 `guardrails.ReportParser`: detect by content, parse G1 to G7 (state, reason, count, breaks). Known-list count: `known_count` or `known` at the top or per guardrail, else -1.
- R5.32 `guardrails.Service` (analyser "guardrails"): per repository a fresh (7 days) guard report covers a guardrail; otherwise `OwnCheck` (G1 from times, G2/G3/G6 from workflow checks, G3 also from retries, G7 from test reports found, G4/G5 unknown) goes to `SaveOwn`. One finding per repository and breaking guardrail (kind `guardrail.gN`, subject the repository name).
- Store `internal/store/insights_tests.go`: `InsightTests` (tests.Store); `ReplaceReport` in one transaction (report id 0 = job log, replaced per repo, run attempt, job and format).
- Spec: R5.31 to R5.37 rows name their tests; change note `changes/CIX19.md`.

## Tests and times (go test -race -count=2)
- `internal/insights/tests`: ok 1.0 s (parsers, times, flaky, duplicate, assertions, service)
- `internal/insights/guardrails`: ok 1.0 s
- `internal/store` `-run InsightTests`: ok 5.3 s (real SQLite)
- `go vet` clean for `internal/insights/...` and `internal/store`; gofmt clean.
- test_guardrails.py: no break from my files. docs_check: only the expected W1 (docs/work).
- fast_guards.py: typecheck PASS; `secret-scan` and `lint` could not run in this sandbox (no `gitleaks`; the installed golangci-lint is built with Go 1.25, the repo targets 1.27.4). Not caused by this branch; the CI run is the gate.

## Contract gaps (questions for the orchestrator)
1. `ListTestResultsBetween` (and `insights_findings.sql` at line 352 of its generated code): sqlc numbers `LIMIT ?5 OFFSET ?4` while the Go call passes limit as the 4th argument, so LIMIT reads the offset and a page returns nothing. Workaround: `InsightTests.Between` uses raw SQL. CIX9 should check its findings list query for the same bug.
2. R5.34 "slowest tests of a repository with 5 min or more a week": read as a repository with 5 min of test time in the window; top 5 by weekly time; minutes saved = weekly time above each run's G1 limit (0 when none is over). Say if the minutes should be something else.
3. The guard report has no known-list field today (`test_guardrails.py --json` gives mode, results, notes). Accepted `known_count` / `known` forms are guesses until dev-standards adds one.
4. TRX counters are run totals, not per test; per-test assertions are "not reported" (-1).
5. `guardrails.Store.Status` is CIX16's; `Service.Evaluate` reads it for fresh guard-report entries (ReportedAt within 7 days, source guard_report) and relies on `workflows.Store.Latest` for G2/G3/G6.
6. Wiring (CIX18): `tests.Service{Store, Jobs, Now, Red}` and `guardrails.Service{Store, Tests, Workflows, Jobs, Now, Red}`. The collector (CIX10) must fill `Row.Kind` with `DefaultNormaliser.Kind` and `Row.TestID` with `TestID`.
7. Added `internal/store/insights_tests_test.go` (not in the row list) to test my store file, and one query `DeleteTestResultsForJobLog` in my own `insights_tests.sql`; `sqlcgen/db.go` was regenerated (prepared statement), to be regenerated again at the join.

## Left
Nothing for this row. Not done by design: a CPU-light streaming bound check for XML parsers beyond the token decoder; no bench file (none listed).

CODE DONE eba5bb4
