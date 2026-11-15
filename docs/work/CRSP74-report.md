# CRSP74 report: hosted fallback (opt-in)

Branch `CRSP74-hosted-fallback`. Draft PR to main.

## Built
- Machine record: `Accepting` (default true) and `PauseReason` added (CRSP75 not on main when started).
- `internal/repos/fallback.go`: policy fields (`hosted_fallback`, `fallback_cap_minutes`, `hosted_labels`), engine (`EvaluateFallback`, every 30 s), grace time setting `fallback_grace_minutes` (default 3), minutes per month with cap, routing view, `DesiredNow`.
- Controller wiring: `machineUp` (online AND accepting), loop in `runsOnLoop`.
- API: policy fields, `routing` on the repository, `needs_confirmation` for the cost question, settings key.
- Doctor: `repo.waiting` (info), `repo.fallback` (warn); vars checks accept the hosted label.
- Web: Hosted fallback section with question card, list column, repository facts, Overview line in the banner slot.
- Docs: github-integration R5.40 to R5.44, doctor R5.37, R5.38, web-console R5.33, R5.34, content.md, CHANGES C17, change notes (hand-written; `docs_fold.py` not available here).

## Checks run
- `go test -race` on repos, machines, doctor, settings, api, cmd/crsp (fallback test); `GOOS=windows go vet` on the touched packages; gofmt.
- `pnpm --filter web typecheck lint test`: green except 2 failures in AuditLog and ConfigExport that fail the same way on main (Node 22 here, repo needs 24).
- `golangci-lint` could not run (built with Go 1.25, repo targets 1.27).
- `docs_check.py` not available here.

## Open points
- The grace setting has no field in Settings (LOOK2 owns that screen); it is in the API settings.
- The fallback state is in memory; after a restart the grace time counts again. The repository store in the controller is in memory too.
- `internal` visibility is not refused (only `public`).
