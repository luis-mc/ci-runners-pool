# CRSP20 report: agent link, machines, join, TLS CA, load

## What this adds
- `internal/tlsca`: controller CA (ECDSA P-256) and server cert, TLS 1.3 only, SHA-256 pin of the CA cert, keys only in `secrets.Store`.
- `internal/load`: probe seam, parsers, medians, WSL VM = max(working set, private bytes), Docker via Windows CLI first, cgroup v2, slot sizing. Ported from dev-standards `load.py` / `load_guard.py` with their tests, cited in the code.
- `internal/machines`: join codes (hashed, single use, TTL), per-machine keys, session stream, offline detection, settings, drain/resume (never kills), remove, controller's own machine, `AgentService` handler on 8461. Repository interface with an in-memory implementation.
- `internal/agent`: detection (OS, CPU, memory, disk, 9 backends, GPU), pinned join, session with backoff, settings cache, gate with the idle check, install plan per OS, 0600 file secret store. No listener.
- `internal/api/handlers_machines.go`: machines, settings, drain/resume/remove, load history, changes, join codes, install command, `ca.pem`.
- `cmd/crsp`: `crsp agent run|join|install`; the controller starts its CA, the link on 8461 and its own agent through the same join path.

## Requirements built
R5.1-R5.13, R5.15-R5.26, R5.30-R5.43, R5.44-R5.48 (plan, no real-host run), R5.50-R5.52, R6.1-R6.4, R6.5 (short-window test), R6.6-R6.8.

## Not built
R5.14 (M5), R5.27/R5.28 (M3), R5.29 (M7), R5.49 uninstall (M3), R6.9 (M3), R6.10 and the web console screens (web area), the `crsp machines` CLI commands.

## Tests added
`internal/tlsca`, `internal/load`, `internal/machines`, `internal/agent` (incl. `idle_cost_unix_test.go`), `internal/api/machines_*_test.go`, `cmd/crsp`.

## Checks
`go build`, `go vet`, `go test -race` (all packages), gofmt, golangci-lint (0 issues), docs_index build + docs_check (0 errors besides the docs/work files removed before the PR). Codegen: contract untouched versus main; `task codegen:check` could not run here (Node 22 vs the repo's engines field), so CI is the check. No TS touched.

## Contract
No change to `packages/contract`.

## Open questions
- SQLite adapter for `machines.Repository` belongs to `internal/store` (CRSP18, depguard bans `database/sql` elsewhere). Machines, keys and codes are lost on restart until it lands.
- Stop-jobs (R5.33 choice 3) needs the runners feature: `JobStopper` hook returns `ErrNotSupported` without it.
- Real OS secret stores (Credential Manager, Keychain, Secret Service) not done; the 0600 file store is used.
- Windows service control-manager integration and the Windows/macOS install scripts are untested on real hosts.
- The audit actor comes from `machines.WithActor(ctx)`; the auth middleware must set it. The events hub is not wired (`Notify` nil).
- R6.5 is a 3 s window test; the 10-minute mean needs a manual soak.
