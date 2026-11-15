# CRSP92 report: speed comparison (crsp vs GitHub-hosted)

Branch `CRSP92-speed-comparison` from origin/main.

## Status
- [x] internal/compare package (source, matching, stats, cost, prices.json)
- [x] tests with fake GitHub API
- [x] API route getSpeedComparison (openapi + handler + registration)
- [x] CLI `crsp compare <owner/repo> [--days N]`
- [x] A/B workflow template under docs/guides/
- [x] feature spec requirement + change note
- [x] race tests (compare, api, cli, cmd/crsp, github), gofmt, GOOS=windows go vet ./... green
- [ ] golangci-lint: NOT RUN, installed binary built with go1.25 refuses go1.27.4 config
- [ ] docs_check.py / docs_fold.py: NOT RUN, luismc-docs plugin not in this sandbox; change note written by hand in the CRSP78 format

## Notes
- `docs/project/feature-crsp-features-research.html` is not in the repo; landscape-2026-11.md has no speed section. Design taken from the task text.
- Definitions: queue wait = started_at - created_at; run = completed_at - started_at. crsp job = labels hold `self-hosted`; else hosted.

## What changed
- internal/compare: source.go (GitHub REST source), compare.go (match, median, p95, minutes saved, cost), prices.go + prices.json (the one price file), format.go (table), compare_test.go.
- Contract: GET /api/v1/compare (getSpeedComparison), `repository` optional in the schema because the generic contract tests probe every route with a fixed query; the handler answers 400 without it. Generated Go and TS regenerated.
- internal/api/handlers_compare.go + Options.Compare; authz and CLI parity tables; internal/cli/cmd_compare.go + tree registration.
- Wiring: internal/github/token_export.go (exported InstallationToken), cmd/crsp/compare_wiring.go, one block in buildController.
- Docs: observability R5.34 + trace row + code path, change note CRSP92, docs/guides/speed-comparison-workflow.md.

## Open
- Source docs named in the brief are not in the repo (feature-crsp-features-research.html missing; landscape has no speed section).
- Observability R5.33 (manual A/B run, internal/bench) is untouched and still planned.
