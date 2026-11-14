# CRSP19 brief: GitHub App, sign-in, users, repositories, variables

Task CRSP19 for milestone 1 of CI Runners Shared Pool.

## Scope
First-run setup code and App manifest flow; web OAuth sign-in (dev callback http://127.0.0.1:8460/auth/github/callback), sessions that never expire by time (end at sign-out), owner = first sign-in, owner adds users as admin/viewer; CLI device flow + CLI tokens; tray link redemption (GitHub user bound to OS user, loopback only); list installations and administrable repos; enable/disable pool per repo with plan + apply; policy (priority, parallel limit, fork PRs off by default with warning, labels); CRSP_RUNS_ON_LINUX/_WINDOWS/_MACOS variables kept correct (drift restore, audit), deleted after a yes when the pool is turned off; workflow runs-on label check; registration/remove/JIT token helpers (remove token to deregister); demand via polling the REST API in M1 (scale-set client behind the Demand interface may come later; keep the interface). Secrets only in the OS store; App private key import from a file path (dev: CRSP_GITHUB_APP_KEY_FILE).

## Specs
docs/features/github-integration (all M1), docs/architecture/decisions/0002-github-auth.md

## You own
internal/github/** (implementations + internal/github/fake: a fake GitHub API server with recorded-shape fixtures), internal/auth/**, internal/secrets/** (implementations per OS: Windows Credential Manager, macOS Keychain, Linux Secret Service with 0600 file fallback; build tags), internal/repos/**, internal/api/handlers_auth.go, internal/api/handlers_repos.go

## Run rules
- Cloud routine. No subagents. Never end your turn while waiting. Push after every step.
- Write docs/work/CRSP19-report.md first and keep it current.
- No Co-Authored-By or AI attribution in commits (the commit-msg hook refuses them). Never --no-verify. Never read or print secrets. No money spend. Never call the real GitHub API: tests use the fake GitHub server (internal/github/fake, owned by CRSP19; until it lands, use an httptest server in your own test files).
- Product: CI Runners Shared Pool (CRSP), binary `crsp`, Go 1.27 + pnpm monorepo. Contracts are merged on main (CRSP17): packages/contract/openapi.yaml, packages/contract/proto/agent/v1/agent.proto, internal/store/migrations + sqlc queries, interfaces in internal/{github,secrets,backend,scheduler,events}. Build against them. If a contract must change, change it in the same branch (regenerate code), add a change note to the affected spec (docs_fold.py note) and say so in the PR body.
- Read first: CLAUDE.md, AGENTS.md, docs/overview/product.md (incl. "Owner decisions for milestone 1"), docs/architecture/decisions/*.md, and the specs named below. Implement only requirements marked (M1). In each spec you implement, change NOT YET IMPLEMENTED to built for what you built, and fill section 9 test paths and section 12 code map (via a change note, docs_fold.py note, not by editing the version).
- Owned files: only the paths listed under "You own". Other agents work in parallel on the other areas. API handlers go in your own file(s) internal/api/handlers_<area>.go; delete only your operations' stubs from internal/api/stubs.go. Wire your area into the server and `crsp` binary through one small constructor/registration function in your own package; touch cmd/crsp/main.go and internal/api/server.go only with minimal additive lines.
- Tests: every M1 requirement you build gets a test (unit, plus integration against the fake GitHub where relevant). A suite that finds no tests fails.
- Checks before finishing (all must pass in your sandbox): go build ./..., go vet ./..., go test ./..., gofmt clean, golangci-lint (go tool) clean, codegen drift clean, and when you touch TS: pnpm install, pnpm -r typecheck, pnpm -r lint, pnpm exec prettier --check ., pnpm exec vitest run. Docs: from a clone of https://github.com/luis-mc/dev-standards run docs_index.py build then docs_check.py (0 errors).
- Finish: `git fetch origin && git rebase origin/main` (resolve conflicts in your favour only for files you own; for shared files keep both sides), rerun the checks, delete docs/work/ from the branch (DOCSPEC D9) and put your report text in the PR body, push, open a pull request to main titled "CRSP19: GitHub App, sign-in, users, repositories, variables" (you may open PRs; never merge). Final message: PR number, head SHA, requirements built (IDs), tests added, checks, open questions, and `CODE DONE`.
