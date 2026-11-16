# CRSP107 report: app health, reconcile reason, job reconcile

Branch CRSP107-app-health-reconcile. Spec: github-integration R5.6, R5.22 (reason text), R5.38.

## Found
- R5.22: webhook route and 10-minute `ReconcileInstallations` exist (CRSP41). A repository that left is turned off with an audit line only; the console has no reason.
- R5.6: `GetApp` exists on the client; nothing calls it on a schedule; nothing stops GitHub work.
- R5.38: the poller backs off up to 5 minutes; no reconcile of the job view.

## Plan
1. `internal/github/apphealth.go`: AppHealth (check at start, hourly; gone = 404/401/missing key; transient errors keep state). Gate loops and demand targets while gone. Running jobs untouched.
2. Job reconcile: `Reconciler` lists open jobs every 5 minutes, emits jobs the view missed.
3. Repository `left installation` marker (`ChangedByInstallation`) cleared on return; API `pool_off_reason`.
4. API: `GET /api/v1/github/app-health`; console banner (overview) and reason (repositories) with shared parts only.
5. Docs: content.md words, CHANGES, spec marks, change note.

## Status
- [x] Go: `internal/github/apphealth.go`, `reconciled.go`, `repos.ChangedByInstallation`, wiring in `cmd/crsp` (loops, poller targets, installation webhook gated).
- [x] API: `GET /api/v1/github/app-health`, `Repository.pool_off_reason`; codegen drift none.
- [x] Web: `AppGoneBanner` (Overview), reason in list and repository page; shared parts only (Message, TextLink, Status, Facts).
- [x] Docs: content.md words, CHANGES C24, spec R5.6, R5.22, R5.38 marked built, change notes (github-integration, web-console).

## Checks
- go test -race: internal/github, internal/repos, internal/api, cmd/crsp (touched tests); golangci-lint 0 issues; GOOS=windows vet ok for touched packages; darwin vet ok for internal packages (cmd/crsp darwin needs cgo systray, not buildable here).
- web: tsc, eslint, vitest. Two failures (AuditLog and ConfigExport download tests) fail the same on main with Node 22 here.
- docs_check.py: the luismc-docs plugin is not in this sandbox; not run. Change notes added for github-integration and web-console.

## Not done
- No page-visual check (no running controller here). The wizard link goes to `/setup`, which says how to get a setup link.
- Poller-only demand is not wrapped by the reconcile: it already reads at least every 5 minutes.
