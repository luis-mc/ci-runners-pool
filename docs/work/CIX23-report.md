# CIX23 report: CI run insights follow-ups

Branch `CIX23-insights-follow-ups`, base `origin/CRSP208-release-48`. Draft PR to `main`.

## What was built (owner decisions 20 Nov)

| Decision | Built | Where |
|---|---|---|
| D18 re-analyse after each CI run | `Engine.Trigger` (new `insights.Triggerer`), runs counted and decided after a pass, 15 min timer kept as a safety net; ingest calls `OnJobCompleted` once when a job first reaches done; `cmd/crsp` bridge forwards it | `internal/insights/engine.go`, `period.go`, `internal/jobsdata/ingest/recorder.go`, `cmd/crsp/insights_wiring.go`, `jobsdata_wiring.go` |
| D18/D19 measure each pass | `ProcessMeter`: average CPU over the pass (percent of one core, whole process), peak memory, insights store size (CI data folder + database file); `KindCost` warning finding (pool, area pool, 0 minutes) over 5% CPU, 300 MB or 1 GB; resolves when back under | `internal/insights/meter.go`, `newInsightsEngine` in `cmd/crsp/insights_wiring.go` |
| D19 slower period, chosen in Settings | settings `insights_update_period` (`every_run`, `every_nth_run`, `hourly`) and `insights_update_every_n_runs` (2 to 50, default 5); openapi, generated Go and TS; Settings, Data section "CI run insights" | `internal/settings`, `internal/api/handlers_ops.go`, `packages/contract/openapi.yaml`, `apps/web/src/screens/settings/InsightsUpdate.tsx` |
| D17 dismissed finding back after 7 days | migration 00031 `hidden_until`; open list, counts and digest skip a hidden finding; `insights.Dismisser`; `POST /api/v1/insights/findings/{id}/dismiss` (admin); finding page button "Hide for 7 days". `FindingStore` still has no close/delete method | `internal/store`, `internal/api`, `apps/web/src/screens/insights/Finding.tsx` |
| D18 digest Monday 08:00 Europe/Lisbon, draft, tray link | `digest.Hour = 8`, `digest.Location()` (tzdata built in), tray item "Open weekly digest" from status field `digest_path` | `internal/insights/digest`, `internal/tray`, `cmd/crsp/tray_wiring.go` |
| D21 flaky window 14 days | analyser and Tests view use 14 days for flaky, 7 for the rest | `internal/insights/tests/service.go` |

Docs: `docs/features/ci-run-insights/spec.md` (R5.8, R5.35, R5.38, R5.42, new R5.44 and R5.45, sections 3, 4, 7, 9, 10), change note `changes/CIX23.md`, design system `next-version/content.md` and `CHANGES.md` C5 (words only; no rule, token or component changed).

## Things the owner should know

- The insights web screens still answer from `mock.ts` on RELEASE-48 (CIX22 left them mocked until CIX21 joins). The new Hide for 7 days button therefore calls a mocked `dismissFinding`, the same way; the real route and its tests exist on the Go side. The Settings section uses the real settings API.
- `main.go` still calls `startInsights(..., insightsDeps{})`: no analyser list is built there on RELEASE-48. CIX23 adds and tests `newInsightsEngine` (period from Settings, meter), the trigger bridge and the digest start, but the join that builds the analysers has to pass them. Until then the engine does not run in the controller.
- The meter's CPU is the whole controller process during the pass, so it can overstate the pass itself (upper bound, stated in R5.45).
- `go-tiers.json`: no new Go test package was added (the new tests sit in existing packages), so no tier entry changed. Measured locally with `-race`: insights 1.6 s, tray 2.0 s, ingest/digest/tests about 1 s, settings and cmd/crsp stay in the integration tier.
- Dismiss writes no audit row (it hides, changes no setup); say so if the owner wants one.
- `docs_check.py` and `docs_fold.py` (luismc-docs plugin) are not installed in this sandbox, so `docs_check.py` could not be run; the change note was written in the same file format as CIX21/CIX22 and `scripts/delivery/change_notes.py check` passes. Run `docs_check.py --strict` at the join.
- `gitleaks` was missing for the pre-push hook; installed through `scripts/delivery/ci_tool.py gitleaks` and linked in `$HOME/go/bin`. No check was weakened. No e2e spec changed, so the DL-88 gate step was not needed.

## Local checks (touched packages only)

`go test` of `internal/insights/...`, `internal/store` (insight tests), `internal/api`, `internal/settings`, `internal/tray`, `internal/jobsdata/ingest`, `cmd/crsp` (wiring tests); `golangci-lint run ./cmd/... ./internal/...`: 0 issues; web `tsc`, `eslint`, vitest of `screens/insights` and `screens/settings` (155 tests), `scripts/design` guards (128 tests). Full suite: branch CI.
