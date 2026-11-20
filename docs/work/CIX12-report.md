# CIX12 report: CI data collector (plan row 2, "CIX10")

Branch `CIX12-ci-data-collector` from `CIX-integration` 6b2697f. Requirements: R5.2 to R5.6, R6.1, R6.2, R6.5.

## Built, per requirement

| Req | What | Where |
|---|---|---|
| R5.2 | `FSVault.PutLog`: line-by-line redaction (`internal/redact`, values the controller holds), env: block values dropped (names kept, `NAME: ***`, continuation lines removed), email addresses masked, multi-line key blocks redacted whole, gzip, atomic write, 0600/0700, `<data>/ci-data/<repo>/logs/<run>-<attempt>-<job>.log.gz`; over 64 MiB is `too_large` (also when GitHub reports the size); 404/410 is `missing`; redactor error or panic stores nothing (`failed`) | `collect/vault.go`, `scrub.go`, `collector.go` |
| R5.3 | `Service.RunCompleted`: lists artifacts, reads the guard-report-named ones first, downloads at most 50 MiB each and 200 MiB per run, picks members by content (`DefaultDetectors`: guardrails, trx, junit, playwright, vitest, gotest, libtest), stores them redacted, indexes in `ci_report_files`, hands them to a `Sink` (parsers of CIX17/CIX16) and marks `parsed` or `broken` | `collect/collector.go`, `detect.go` |
| R5.4 | no secret, env value or email stored; rows hold paths, sizes, hashes and fixed words | `scrub.go`, `privacy_test.go` |
| R5.5 | 7 Settings keys (the 5 of R5.5 plus `insights_hold_cap_seconds` and `insights_guardrail_artifact` of the openapi Settings schema), defaults, ranges, audit row on change; `settings.CIDataLimits` | `internal/settings/settings.go` |
| R5.6 | `FileRetention.Prune`: rows past `expires_at`, then per repository past the days, then oldest first over the size cap; rows kept and marked `expired`; hooked into the hourly `settings.Retention` (`CIData []collect.Retention`) | `collect/retention.go`, `settings/retention.go` |
| R6.1 | `HourlyBudget`: 25 percent of the installation's hourly limit per clock hour; each priority has a ceiling of that share (reconcile 100, steps 90, workflow files 80, artifacts 65, logs 50, trees 35 percent) so earlier work keeps room; halted installations get nothing; the collector keeps an item's place when the share is spent and reports its backlog; the REST calls are `Background` calls | `collect/budget.go`, `github/rest_insights.go` |
| R6.2 | defaults, floors, ceilings proven against the settings | `retention_test.go` |
| R6.5 | redaction test over both sinks; no `net` or `net/http` import in `internal/insights` | `privacy_test.go` |

Also: `internal/github/rest_insights.go` (JobLog, DownloadArtifact streamed through the redirect with the installation token never sent on, RunArtifacts paged, CommitTree), `internal/store/insights_ci_data.go` (Store methods over the contract queries) and two queries added to `insights_ci_data.sql` (`ListCIReportFilesOldestFirst`, `GetCIReportFile`).

## Tests (go test -race -count=2, foreground)

| Package | Result | Time |
|---|---|---|
| internal/insights/collect | ok | 32 s for 2 runs; slowest test 1.4 s (store open) |
| internal/github | ok | 3.4 s |
| internal/settings | ok | 48 s |
| internal/store | ok | 155 s |

`go vet ./...` and `golangci-lint` (touched packages): clean. `test_guardrails.py --root .`: no break in my files (the existing breaks are in files owned by others). `docs_check`: only the expected W1. `fast_guards.py`: guards, lint, typecheck, change-notes pass; `secret-scan` fails here because `gitleaks` is not installed in this sandbox (exit 127), not because of a finding.

## Contract gaps (questions for the orchestrator)

1. **Import cycle.** `internal/github` cannot import `collect` (collect -> store -> auth -> github). Workaround: `github.REST` has its own `ErrGone` and `Artifact`, and `collect.FromREST(*github.REST)` adapts it to the `collect.GitHub` interface (maps `ErrGone`). Wiring (CIX18) should pass `collect.FromREST(rest)`.
2. **Parsers.** The collector detects the format by its own `DefaultDetectors`; parsing is a `collect.Sink` (`ReportStored(ctx, ReportRecord)`) that CIX17 (tests) and CIX16 (guardrails) must implement, or wire through one adapter in CIX18. Without a sink files stay `stored`.
3. **Other retention.** `test_results`, `job_resource_samples` and the other insights tables need their own pruners; `settings.Retention.CIData` takes any `collect.Retention` (the `Limits` carry `TestResultsDays` and `ResourceSamplesDays`). Owners of those stores should implement one.
4. **Generated files.** I regenerated sqlc for my two new queries; `internal/store/sqlcgen/db.go` changed (prepared statements) and is committed so the branch builds. Regenerate with `go tool task codegen` at the join; take the generated result on conflict.
5. **`HourlyBudget.Limit`** needs the installation's hourly limit and `Halted` the half-limit stop; the REST client keeps both private (`budgets`). Wiring should pass closures over them, or CIX18 can add an exported reader (I did not touch `client.go`).
6. **Settings API mapping** (`handlers_ops.go`, CIX18): new `settings.Settings` fields `InsightsKeepCIData`, `InsightsCIDataDays`, `InsightsCIDataMiBPerRepository`, `InsightsTestResultsDays`, `InsightsResourceSamplesDays`, `InsightsHoldCapSeconds`, `InsightsGuardrailArtifact` and the same names in `settings.Patch`.
7. The git hook `golangci-lint` in the image was built with go1.25 and refused the repo's go 1.27; I installed a go1.27.4 build into `$HOME/go/bin` (outside the repo) so the pre-push hook runs. No `--no-verify` was used.

## Known limits

- A commit message or actor name inside a log cannot be told from other text; only email addresses are masked.
- A job log whose fetch fails (not 404/410) leaves no row and is not retried until the next `JobCompleted` for it.
- The collector queue is in memory; a restart drops it (the next completed jobs queue again).

CODE DONE 3ad9ecc
