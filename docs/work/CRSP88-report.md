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
- Built: `internal/trial` (modes, canary hash, report, MemKV), `internal/repos/trialvars.go` (variable + dispatch hooks through owner code), `internal/github/dispatch.go` (DispatchWorkflow), API `GET`/`PUT /api/v1/repositories/{id}/trial`, CLI `crsp trial`, wiring in `cmd/crsp/trial_wiring.go`, spec R5.47 + change note CRSP88.
- Tests green with -race: internal/trial, internal/repos, internal/api, internal/cli, cmd/crsp. `GOOS=windows go vet` clean on touched packages.

## Things the owner should know
- **Deviation:** the task said "read-only API endpoint", but `crsp trial ... observe|shadow|canary|off` is an API client and needs a write. I added `PUT` (admin) next to the `GET`. Delete the PUT and the CLI mode argument if you want it strictly read-only.
- **Not wired:** `trial.Manager.OnJob` is not called from the webhook (RES14 owns it). Until that wave calls it, observe/shadow record nothing and shadow dispatches nothing; canary works with job names given by `--jobs` (or seen jobs once OnJob is wired).
- Canary variables are `RUNS_ON_CANARY_<JOB>`; workflows must read them (`fromJSON(vars.RUNS_ON_CANARY_BUILD || '["ubuntu-latest"]')`). Shadow needs a `crsp-shadow.yml` with `workflow_dispatch` in the repository.
- TS client `packages/contract/ts/generated/schema.d.ts` regenerated with openapi-typescript 7.13.0 via npx.
- `golangci-lint` here is built with go1.25 and refuses the repo config (go 1.27); not run. `go vet` and gofmt clean.
- `docs_check.py` / `docs_fold.py` not available here (no luismc-docs plugin); change note written by hand in the existing format. R5.47 taken as next free ID; another branch may claim it.
