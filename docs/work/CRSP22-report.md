# CRSP22 report: persistent runners on Windows, Linux, macOS

## Built (requirement IDs, runners spec)
R5.1 to R5.8, R5.10, R5.13 to R5.24, R5.36, R5.37, R6.1 to R6.4, R6.8. In part: R5.5 (finders built, console list not), R5.9 (`Detect` built, allow list is `machines`), R5.11 (redactor hook, secret list not wired), R5.12 (`ReportUsage`, no 15 s sender). Not built: R5.38, R6.7, R6.9 CI jobs.

## What is in the branch
- `internal/backend/{windows,linux,macos}`: persistent backends over injected `sys.Commands`, `sys.FS`, `sys.Fetcher`. Tests assert the exact PowerShell, systemctl, useradd, dscl and launchctl calls; nothing real is made. `internal/backend/registry` holds build-tagged files so each binary has only its OS backend.
- `internal/runners`: generic labels, pinned versions with SHA-256 (real hashes of the official v2.330.0 assets, computed from the downloads), account names, states, drain with the idle check right before the act, plan/apply for add and replace, remove with a remove token, found runners (not managed), `LocalAgent`.
- `internal/api/handlers_runners.go`: the seven runner operations; their stubs are removed from `stubs.go`. `Options.Runners` nil keeps the 501 answer.
- `packaging/hooks`: .ps1 and .sh hooks.
- Spec `docs/features/runners`: section 5, 9, 11, 12 updated, change note CRSP22.

## Contract changes
None to openapi or proto. Additive in Go: `backend.StartConfig.Removal` (remove token for an in-place re-register), optional `backend.Finder` and `backend.Deregisterer`.

## Checks
go build, go vet, go test ./..., gofmt, golangci-lint (0 issues; also GOOS=windows for internal/backend), GOOS=windows and darwin build, Go codegen no drift, docs_check 0 errors after docs/work is removed, prettier on touched paths. TS not touched.

## Open questions
1. Runner version pin: 2.330.0 with hashes I computed from the release downloads. Compare with the release notes.
2. Scripts were written without a Windows, Linux or macOS machine; the first real run is the CI matrix job (R5.24, R6.9), not added (CI files are not mine).
3. `runners.Store`, `runners.Resolver`, `runners.GitHub`, `runners.Auditor` need adapters from CRSP18 (store), CRSP19 (GitHub), CRSP20 (agent link maps `runners.Agent` to messages; `LocalAgent` is the executor). No wiring in `cmd/crsp/main.go` until they land.
4. The hooks call `crsp hook job-started|job-completed`; the CLI owner (CRSP25) must provide it.
5. Agent link: `RemoveRunner` has a `KeepFiles` flag and there is a `CleanUp` call, so the replace steps (stop, deregister, delete) each get their own yes; the proto `RemoveRunner` has `delete_folder`, which maps to CleanUp.
6. Windows service `BinaryPathName` uses `bin\RunnerService.exe`; confirm on a real runner.
7. `ActorFromContext` is `api.ContextWithActor`; the auth middleware must set it.
8. Drain: warn at 30 min (owner decision), timeout from a setting, never kills.
