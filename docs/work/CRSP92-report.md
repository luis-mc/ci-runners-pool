# CRSP92 report: speed comparison (crsp vs GitHub-hosted)

Branch `CRSP92-speed-comparison` from origin/main.

## Status
- [ ] internal/compare package (source, matching, stats, cost, prices.json)
- [ ] tests with fake GitHub API
- [ ] API route getSpeedComparison (openapi + handler + registration)
- [ ] CLI `crsp compare <owner/repo> [--days N]`
- [ ] A/B workflow template under docs/guides/
- [ ] feature spec requirement + change note
- [ ] lint, race tests, GOOS=windows vet, docs_check

## Notes
- `docs/project/feature-crsp-features-research.html` is not in the repo; landscape-2026-11.md has no speed section. Design taken from the task text.
- Definitions: queue wait = started_at - created_at; run = completed_at - started_at. crsp job = labels hold `self-hosted`; else hosted.
