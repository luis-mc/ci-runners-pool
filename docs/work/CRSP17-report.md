# CRSP17 report: milestone 1 contracts

Status: in progress 2026-11-14. Specs read. Writing openapi.yaml.

## Environment notes
- pnpm needs Node >= 24: use /opt/node24/bin and `corepack pnpm` (Node 22 is the default here).
- Baseline `go tool task codegen` (Go parts) had no drift before changes.

## Steps
- [x] Read specs and existing contracts
- [x] openapi.yaml (72 operations; 501 stubs in internal/api/stubs.go)
- [x] agent.proto (Join + Session; buf lint STANDARD clean)
- [x] migrations 00002-00008 + sqlc queries (every query prepared against real SQLite in a test)
- [x] Go interfaces: internal/github, secrets, backend, scheduler, events
- [ ] codegen + 501 handlers
- [ ] checks
- [ ] PR
