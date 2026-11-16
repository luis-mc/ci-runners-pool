# CRSP139 report: guided GitHub grant (owner decision D84)

Branch: CRSP139-guided-grant. Draft PR to main.

## Plan
1. Go: `github.Grant` diff (needs vs App asks vs installation accepted), `GET /app` read, token cache refresh,
   webhook `new_permissions_accepted`, manifest asks `secrets: write` from the start.
2. API: `GET /api/v1/github/grant` (steps with live state); parity setup answers with the same grant.
3. Web: shared `GithubGrant` part in packages/ui (steps, one primary action, Ready), used by Access for CI,
   Turn on the pool, Repositories, Setup.
4. Docs: github-integration + web-console specs (R-IDs, test rows), content.md words, CHANGES entry, change notes.
5. Tests: Go, Vitest, a11y spec.

## Status
- [ ] 1  - [ ] 2  - [ ] 3  - [ ] 4  - [ ] 5

## Places that need a permission or repository access (found)
(filled as found)
