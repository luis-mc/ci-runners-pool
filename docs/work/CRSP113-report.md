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

Updated after each step.
