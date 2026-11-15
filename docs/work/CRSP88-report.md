# CRSP88 report: trial modes (observe, shadow, canary)

Branch `CRSP88-trial-modes` from origin/main. Status: in progress.

## Plan
1. `internal/trial` (new files): modes, per-repository state, report, canary hash, tests.
2. Small hooks: `internal/repos/trialvars.go` (variable access through existing owner code), wiring in `cmd/crsp`.
3. CLI `crsp trial <owner/repo> observe|shadow|canary|off`, read-only API `GET /api/v1/repositories/{id}/trial`.
4. Spec: github-integration next requirement ID + change note.

## Decisions
- State stored as JSON in the settings table (no migration).
- Canary writes one variable per selected job, `RUNS_ON_CANARY_<JOB>`; `off` restores the snapshot of RUNS_ON variables taken on entry.
- Public repositories refused for observe, shadow and canary; `off` always works.
- Hosted fallback (CRSP74), public-repo stop (CRSP82), webhook/polling (RES14) untouched.

## Log
