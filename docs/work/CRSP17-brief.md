# CRSP17 brief: milestone 1 contracts

Repo luis-mc/ci-runners-shared-pool. Product CI Runners Shared Pool, binary `crsp`, Go 1.27 + pnpm monorepo.

## Run rules
- Cloud routine. No subagents. Never end your turn while waiting. Push after every step.
- Write docs/work/CRSP17-report.md first and keep it current.
- No Co-Authored-By or AI attribution in commits (the commit-msg hook refuses them). Never --no-verify. Never read secrets. No money spend.
- When done, open a pull request to main titled "CRSP17: milestone 1 contracts" (you may open PRs; never merge). Before opening it, delete docs/work/ from the branch (DOCSPEC D9) and keep your report text in the PR body.

## Goal
Write the milestone 1 CONTRACTS that parallel code agents will build against (STACKSPEC 4.1, contract first). No product logic beyond stubs that compile.

## Read first
- docs/overview/product.md (incl. "Owner decisions for milestone 1"), docs/architecture/decisions/*.md, docs/architecture/stack-profile.md.
- Every requirement marked (M1) in docs/features/*/spec.md.
- Existing contract: packages/contract/openapi.yaml, packages/contract/proto/agent/v1/agent.proto, internal/store/migrations/00001_init.sql, sqlc.yaml, internal/api (route-coverage test: every operation needs x-auth and x-rate-limit).

## Deliver
1. packages/contract/openapi.yaml: every M1 HTTP operation the specs need. Auth (GitHub OAuth start and callback, CLI device flow, session, sign-out), users and roles (owner, admin, viewer), repositories (list, enable, disable, policy incl. priority, parallel limit, fork setting, variable status; queue order settings), machines (list, join code, install command, drain, remove, settings incl. budget, slots, backends), runners (list, add, remove, replace unmanaged), jobs (queue, basic history), doctor (run, results), events (SSE stream), settings, audit log, backup (run, list, restore), tray link. Schemas with examples, the error envelope, x-auth (public|user|admin|owner) and x-rate-limit on each operation, stable operationIds.
2. packages/contract/proto/agent/v1/agent.proto: M1 agent link. Join (code -> machine key, cert pin), Session bidi stream: agent -> capabilities, load reports, runner states, job-started/job-completed gate requests, logs; controller -> slot grants, runner add/remove/drain commands, settings. Versioned, with comments.
3. internal/store/migrations: new numbered goose migrations for M1 tables (users, sessions, github installations, repositories + policies, machines, machine settings, join codes, runners, job queue + slot tickets with expiry, jobs history, doctor findings, audit log, settings, backups). sqlc queries for the basic reads and writes each feature needs.
4. Go interfaces (no logic) where packages meet: internal/github (client interface over the GitHub API, so tests use a fake), internal/secrets (OS secret store interface), internal/backend (runner backend plugin interface per decision 0003), internal/scheduler (slot queue interface), internal/events (publish/subscribe). Each with a doc comment citing the spec requirement IDs.
5. Regenerate all generated code (Go server stubs, TS client, connect-go, sqlc) with the repo's codegen task; handlers return 501 Not Implemented for every new operation so the route-coverage test passes.
6. docs: add one change note per feature spec touched under docs/specs/changes/ if a spec needs a correction; otherwise none.

## Checks (all must pass in your sandbox)
go build ./..., go vet ./..., go test ./..., gofmt clean, codegen drift clean, pnpm install, pnpm -r typecheck, pnpm -r lint, pnpm exec prettier --check ., pnpm exec vitest run, and from a clone of https://github.com/luis-mc/dev-standards: docs_index.py build then docs_check.py (0 errors).

Final message: PR number, head SHA, list of operations / messages / tables, check results, open questions, and `CODE DONE`.
