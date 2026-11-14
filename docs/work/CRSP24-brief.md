# CRSP24 brief: web console M1 screens

Task CRSP24 for milestone 1 of CI Runners Shared Pool.

## Scope
Console shell (header, nav, command palette Ctrl/Cmd+K, j/k lists, / search, ? shortcuts per UX-57), auth states, M1 screens: sign-in + first-run wizard (GitHub App manifest, first machine, first repository; wizard rules UX-5/UX-30/UX-54 and the 10 harness states), overview (live via SSE), repositories (pool on/off with plan + yes, policy, priority/queue order editable, variable status), machines (install command + join code, budget, slots, drain), runners (list with isolation named per UX-61, add, remove, replace not-managed), settings (users and roles, retention, backups). Use the generated TS client from packages/contract; use only --ds-* tokens and shared UI classes (the design kit guards in scripts/design must stay green; no app CSS). Every status = word + glyph + colour (UX-58). Vitest tests per screen and Playwright e2e for the main flows against a mocked API. Keep known-breach lists unchanged or shrinking.

## Specs
docs/features/web-console (M1 screens), design system docs/design-system/v1 (binding; cite rule and component IDs; never copy rules)

## You own
apps/web/**, packages/ui/** (shared components the screens need), e2e/**

## Run rules
- Cloud routine. No subagents. Never end your turn while waiting. Push after every step.
- Write docs/work/CRSP24-report.md first and keep it current.
- No Co-Authored-By or AI attribution in commits (the commit-msg hook refuses them). Never --no-verify. Never read or print secrets. No money spend. Never call the real GitHub API: tests use the fake GitHub server (internal/github/fake, owned by CRSP19; until it lands, use an httptest server in your own test files).
- Product: CI Runners Shared Pool (CRSP), binary `crsp`, Go 1.27 + pnpm monorepo. Contracts are merged on main (CRSP17): packages/contract/openapi.yaml, packages/contract/proto/agent/v1/agent.proto, internal/store/migrations + sqlc queries, interfaces in internal/{github,secrets,backend,scheduler,events}. Build against them. If a contract must change, change it in the same branch (regenerate code), add a change note to the affected spec (docs_fold.py note) and say so in the PR body.
- Read first: CLAUDE.md, AGENTS.md, docs/overview/product.md (incl. "Owner decisions for milestone 1"), docs/architecture/decisions/*.md, and the specs named below. Implement only requirements marked (M1). In each spec you implement, change NOT YET IMPLEMENTED to built for what you built, and fill section 9 test paths and section 12 code map (via a change note, docs_fold.py note, not by editing the version).
- Owned files: only the paths listed under "You own". Other agents work in parallel on the other areas. API handlers go in your own file(s) internal/api/handlers_<area>.go; delete only your operations' stubs from internal/api/stubs.go. Wire your area into the server and `crsp` binary through one small constructor/registration function in your own package; touch cmd/crsp/main.go and internal/api/server.go only with minimal additive lines.
- Tests: every M1 requirement you build gets a test (unit, plus integration against the fake GitHub where relevant). A suite that finds no tests fails.
- Checks before finishing (all must pass in your sandbox): go build ./..., go vet ./..., go test ./..., gofmt clean, golangci-lint (go tool) clean, codegen drift clean, and when you touch TS: pnpm install, pnpm -r typecheck, pnpm -r lint, pnpm exec prettier --check ., pnpm exec vitest run. Docs: from a clone of https://github.com/luis-mc/dev-standards run docs_index.py build then docs_check.py (0 errors).
- Finish: `git fetch origin && git rebase origin/main` (resolve conflicts in your favour only for files you own; for shared files keep both sides), rerun the checks, delete docs/work/ from the branch (DOCSPEC D9) and put your report text in the PR body, push, open a pull request to main titled "CRSP24: web console M1 screens" (you may open PRs; never merge). Final message: PR number, head SHA, requirements built (IDs), tests added, checks, open questions, and `CODE DONE`.
