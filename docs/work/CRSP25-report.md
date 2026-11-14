# CRSP25 report: CLI

## Done
- Contract: added `createConsoleLink` (POST /api/v1/auth/console-links) for `crsp open`; stub in internal/api/stubs.go; TS types regenerated.
- Go client target: packages/contract/oapi-codegen-client.yaml -> internal/api/client; Taskfile and drift script cover it.

## Next
Command tree (stdlib flag, choice recorded), contexts, secrets, commands, tests, spec notes.
