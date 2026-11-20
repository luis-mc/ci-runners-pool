# CIX23 report: CI run insights follow-ups

Branch `CIX23-insights-follow-ups`, base `origin/CRSP208-release-48`.

## Plan (owner decisions 20 Nov)

| Step | Decision | State |
|---|---|---|
| 1 Flaky window 14 days (tests analyser and view) | D21 | done (tests: TestFlakyWindowIs14Days) |
| 2 Digest Monday 08:00 Europe/Lisbon, draft file, tray link | D18 | done in code (digest.Location, tray item Open weekly digest, trayBackend.Digest); digest writer start in startInsights still to wire in step 3 |
| 3 Engine: re-analyse on job completed, pass meter, cost finding, update period | D18, D19 | done in code: Trigger, Period, ProcessMeter, KindCost; ingest OnJobCompleted; cmd/crsp bridge, digest start, newInsightsEngine |
| 4 Settings: update period | D19 | Go, openapi and TS types done; Settings screen section todo |
| 5 Dismiss, back after 7 days | D17 | todo |
| 6 Spec, change note, content, tiers, docs_check | all | todo |

## Log
- Note: `startInsights` is still called with empty deps in `main.go` (no analyser is constructed there on RELEASE-48, the wave join left it). CIX23 adds the pieces (`newInsightsEngine`, the bridge, the digest writer start) and tests them; building the analyser list in `main.go` stays with the owner of that join.
- Note: pre-push needs `gitleaks`; installed through `scripts/delivery/ci_tool.py gitleaks` and linked into `$HOME/go/bin` (no check weakened).
