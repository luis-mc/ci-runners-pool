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
In progress.
