# CRSP125 report: repository list follows the installation

Branch CRSP125-repo-sync, base 68d30b3.

## Plan
1. Repository gets `LeftAt`; Sync and reconcile mark repositories that left an installation; list hides them unless asked (`ListFilter.IncludeLeft`); migration 00015 + sqlc.
2. Admin flag becomes known/unknown per user. `GET /github/repositories?refresh=true` forces a Sync and asks GitHub fresh (UserCanAdmin) for unknown flags. Throttle 5 min -> 1 min; reconcile/webhook that changes the repo set invalidates it.
3. TurnOnPool: separate unknown note, no false admin-rights note, waiting state while it checks. Console return with `setup_action` forces refresh.

## Status
- [x] backend: `LeftAt`, `markLeft` in Sync (App list is the authoritative set) and reconcile, `ResolveAdmin`, `invalidateSync`, throttle 1 min, `refresh=true`
- [x] openapi + codegen (drift none); migration 00015, sqlc regenerated
- [x] web: unknown vs no-rights notes, Check again, Refresh, setup_action return
- [x] docs: spec sentences, change notes, content.md words, CHANGES C24 (docs_fold.py / docs_check.py not available in this sandbox: notes written by hand in the changes/ format)
- [x] checks: go test -race repos/api/store/cmd, gofmt, golangci-lint, vet windows+darwin, web tsc, eslint, Vitest of repositories

## Notes
- Production repos Store is the MemStore (`areas_wiring.go`): restart loses repositories and flags until the reconcile refills them; SQL migration keeps the schema ready for the SQL adapter.
- Left repositories are kept for CRSP107's reason text through `Repository.LeftAt` (list with `ListFilter.IncludeLeft`). No screen built.
- Vitest: AuditLog and ConfigExport export tests fail on the base too (Node 22 sandbox), untouched.
