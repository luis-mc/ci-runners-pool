# CRSP131 + CRSP132 report (branch CRSP131-private-repos-toolbar)

Owner decisions D79-D82. Branch only; never in the PR.

## Contract (orchestrator, fixed before agents start)

Setting (CRSP131 a)
- Store: settings table key `public_repositories`, JSON `{enabled, changed_at, changed_by}`; default off. Service in `internal/settings`.
- API (owner role to change, user to read):
  - `GET /api/v1/settings/public-repositories` -> `PublicRepositories {enabled, changed_at?, changed_by?, public_on_pool: int}`; `public_on_pool` = public repositories whose pool is on now (used by the off-confirm text and the Problem).
  - `PUT /api/v1/settings/public-repositories` body `{enabled}` -> same schema plus `stopped: int` (repositories whose pool was switched off). On -> off: per public repository with pool on: pool off (policy kept), RUNS_ON to hosted labels, runners drained and removed (reuse `repos.StopServingPublic`). Audit `public_repositories.on` / `public_repositories.off` (+ the existing `pool.off` rows).
  - CLI: `crsp settings public-repositories [--on|--off]` (x-cli per the repo convention).
- Refusals while off: turn on pool (plan/apply and policy paths) and add runners for a public repository -> HTTP 409, code `public_repositories_off`, reason in plain words that links nothing but names the setting; CLI prints the same.
- Repository already on pool when this ships and public, setting off: keep serving (reconcile and the `publicized` webhook stop stopping them when the setting is off... they are NOT stopped), and expose `problem` on the repository: code `public_pool_on_while_off`, text, actions "Turn on public repositories" / "Turn off the pool". Doctor finding optional.
- Visibility: already stored (`repositories.visibility`, migration 00003) and in the API as `visibility`; verify sync fills it; add a migration only if a gap is found.
- Specs: github-integration new R-IDs (setting, refusals, off-drain, problem, audit); R5.41 amended (stops only when setting off is switched, no longer on its own). Fork refusal R5.26 stays.

Web (CRSP131 b/c, CRSP132)
- Shared `ListToolbar` in packages/ui (one row; wraps only narrow) used by Repositories, Machines, Runners, Jobs, Images and caches, Users, Audit log. Two-state filters use shared segmented/toggle part.
- Settings page: toggle `Enable for public repositories` + shared confirm dialog.
- Repositories: active-types line near title ("Private (default)" / "Private & Public") linking to the setting; Visibility column; public rows greyed with reason + link while off.
- New words in docs/design-system/next-version/content.md; CHANGES entries C35+.

## Log
- Step 1 (openapi + codegen): GET/PUT /api/v1/settings/public-repositories (getPublicRepositories, setPublicRepositories), schemas PublicRepositories, PublicRepositoriesSet, PublicRepositoriesResult, RepositoryProblem(+Action); Repository.problem. Handlers are stubs (501) until step 2.
- Step 2-4 (Go): `internal/settings/public.go` (setting, audit `public_repositories.on|off`), `internal/repos/publicsetting.go` (PublicOffError, StopPublicOnPool, Problem), refusals in PlanChanges/ApplyPlan and `runners.Service.Gate` (PlanAdd, StartApply), 409 `public_repositories_off`, reconcile and `publicized` no longer stop, demand wiring serves a public repo whose pool is on, API handlers (owner PUT), `crsp settings public-repositories [--on|--off] [--yes]`. Visibility: no gap (REST sync, app sync and reconcile all map and upsert it; table column from 00003), a test pins it. Setting off again repeats the drain on purpose (finishes a half-done run).
