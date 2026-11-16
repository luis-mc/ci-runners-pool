# CRSP106 report: secrets only in the store, redacting logger (R6.1, R6.3)

## Found (already built)
- `internal/secrets`: Store (Get/Put/Delete/Backend), Secret Service, Keychain, DPAPI file, 0600 file, Memory. Wired in `cmd/crsp/main.go`; used by auth (App key, client secret, webhook secret), notify, tlsca, machines.
- `internal/redact`: Redactor with shapes and known values; used by the agent link and runner files.
- Database holds only hashes of CLI tokens, sessions, codes (migration 00002); the CLI client keeps its token in the store.

## Missing (built here)
- A redacting slog handler (`internal/logging`) in front of controller and agent loggers and `slog.Default`.
- `secrets.Learn`: wrapper that teaches the redactor every value read or written (store API unchanged).
- Redactor shapes: any PEM block, CLI token prefix.
- Tests: `internal/logging/redact_test.go`, `internal/secrets` Learn test, `internal/store/no_secrets_test.go`.
- Spec: R6.1, R6.3 marked built; change note CRSP106.

## Status
Done. Tests: internal/logging, internal/secrets, internal/redact, internal/store, cmd/crsp pass with -race; golangci-lint 2.15 clean; GOOS=windows/darwin vet clean on touched packages (cmd/crsp on darwin fails on the cgo systray dependency, as on main). `docs_check.py` is not installed in this sandbox: not run.

Note: the agent and controller CA key stores (`agent.NewFileStore`) stay file-based at 0600; they hold no R6.1 secret.
