# CRSP17 report: milestone 1 contracts

Status: in progress 2026-11-14. Specs read. Writing openapi.yaml.

## Environment notes
- pnpm needs Node >= 24: use /opt/node24/bin and `corepack pnpm` (Node 22 is the default here).
- Baseline `go tool task codegen` (Go parts) had no drift before changes.

## Steps
- [x] Read specs and existing contracts
- [ ] openapi.yaml
- [ ] agent.proto
- [ ] migrations + sqlc queries
- [ ] Go interfaces
- [ ] codegen + 501 handlers
- [ ] checks
- [ ] PR
