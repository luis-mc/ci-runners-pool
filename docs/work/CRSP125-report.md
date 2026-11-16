# CRSP125 report: repository list follows the installation

Branch CRSP125-repo-sync, base 68d30b3.

## Plan
1. Repository gets `LeftAt`; Sync and reconcile mark repositories that left an installation; list hides them unless asked (`ListFilter.IncludeLeft`); migration 00015 + sqlc.
2. Admin flag becomes known/unknown per user. `GET /github/repositories?refresh=true` forces a Sync and asks GitHub fresh (UserCanAdmin) for unknown flags. Throttle 5 min -> 1 min; reconcile/webhook that changes the repo set invalidates it.
3. TurnOnPool: separate unknown note, no false admin-rights note, waiting state while it checks. Console return with `setup_action` forces refresh.

## Status
- [ ] backend
- [ ] openapi + codegen
- [ ] web
- [ ] docs + change notes
- [ ] checks, draft PR
