# CRSP113 report: pool per organization (github-integration R5.21, M3)

Branch `CRSP113-org-pool`, from main at 68d30b3.

## Plan

1. GitHub adapter (`internal/github/orgs.go`): owner check (`GET /user/memberships/orgs/{org}` with the user token; as the App, `GET /orgs/{org}/memberships/{login}`, for a CLI token), runner groups (list, create with `visibility: selected`, set selected repositories, read repositories, force `selected`).
2. Fake GitHub: organizations, members, runner groups with selected repositories.
3. `internal/repos/org_pool.go`: enable, disable, status, group sync. The group holds exactly the pool-on repositories of the organization. Never `all`.
4. Registration at org level: the scope resolver gives an organization target (with the runner group id) for a repository of an organization whose pool is on. The runner record keeps the organization scope, so removal uses the same scope. A personal account stays repository-level.
5. API (`/api/v1/installations/{id}/org-pool`), CLI (`crsp org-pool`), console section through shared UI parts.
6. Spec R5.21 built (text only), change notes, design-system next-version words and CHANGES entry.

## Status


- Done: GitHub adapter and fake (owner check, runner groups, selected repositories); repos service (enable, disable, group sync after each pool switch and the reconcile); registration scope at organization level (runners, resolver, doctor adapter); API `listOrgPools`, `setOrgPool`; CLI `crsp org-pool`; console section `OrgPools` with shared parts only; tests; spec R5.21 marked built (text only); change notes for github-integration, runners, cli, web-console, doctor; design-system next-version content words and CHANGES C24.
- Tests: fake GitHub covers owner allowed, non-owner refused (member, outsider, App read for a CLI token), group restricted to selected repositories (a wide group is narrowed, follows the pool switch, default group refused), personal account stays repository level.
- Checks run: gofmt, golangci-lint (0 issues), `go test -race` on cmd/crsp, internal/api, cli, github, repos, runners, doctor; GOOS=windows vet; GOOS=darwin vet of the touched internal packages (`cmd/crsp` darwin vet fails on main too, in the systray cgo code); codegen drift none; web typecheck, eslint, vitest (repositories); Playwright design-layout (360, 393, 1300) and web-console specs, 151 passed, with the browser at `/opt/pw-browsers/chromium`.
- Docs: `docs_fold.py` and `docs_check.py` (the luismc-docs plugin) are not in this sandbox, so the change notes were written by hand in the format of the existing ones (`change: minor`, `task: CRSP113`) and `docs_check.py` was not run. Run it before merging.

## Seams and open points

- Scale-set runners (JIT from a scale set) keep registering where the scale set lives, the repository. Moving scale sets to the organization level is open.
- The mode is kept in memory with the rest of the repository store (the SQL store is open); it is lost at restart and the owner turns it on again. Existing org runners keep their scope in their record.
- `GET /user/memberships/orgs/{org}` is used for the owner check; whether the App needs the Members read permission for the App-level read (CLI tokens) is to confirm on a real organization. R5.23 is not widened.
- Whether runner groups with selected repositories exist on the owner's GitHub plan stays an open check (spec section 11).
- `pnpm install` made the prepare hook set `core.hooksPath`; the mode change of `.githooks/*` is not committed.
