# CRSP21 brief: scheduler: slot queue, load gate, job hooks

Task CRSP21 for milestone 1 of CI Runners Shared Pool.

## Scope
The product's core, ported from dev-standards claude/plugins/delivery/scripts/machine_slots.py, runner_load_gate.py, runner_job_done.py and their tests test_*pool* (port each test; cite the source per test). One queue per machine across all runners and repos; machine-wide slots; job-started gate waits for a free slot AND load under budget; job-completed releases; dead-holder detection across hosts and ticket expiry; cancelled-job leftovers; queue order = repo priority then round-robin fair share, per-repo parallel limit, all configurable; when the hook cannot reach agent/controller it waits on local load only and logs. `crsp hook job-started` / `crsp hook job-completed` commands the runner hooks call (Windows .ps1 wrappers call the all-users binary; Linux/macOS .sh). listJobs, getJob, listSlots, freeStaleSlots handlers.

## Specs
docs/features/scheduling (all M1)

## You own
internal/scheduler/** (implementation), internal/hooks/**, internal/api/handlers_jobs.go

## Run rules
- Cloud routine. No subagents. Never end your turn while waiting. Push after every step.
- Write docs/work/CRSP21-report.md first and keep it current.
- No Co-Authored-By or AI attribution in commits (the commit-msg hook refuses them). Never --no-verify. Never read or print secrets. No money spend. Never call the real GitHub API: tests use the fake GitHub server (internal/github/fake, owned by CRSP19; until it lands, use an httptest server in your own test files).
- Product: CI Runners Shared Pool (CRSP), binary `crsp`, Go 1.27 + pnpm monorepo. Contracts are merged on main (CRSP17): packages/contract/openapi.yaml, packages/contract/proto/agent/v1/agent.proto, internal/store/migrations + sqlc queries, interfaces in internal/{github,secrets,backend,scheduler,events}. Build against them. If a contract must change, change it in the same branch (regenerate code), add a change note to the affected spec (docs_fold.py note) and say so in the PR body.
- Read first: CLAUDE.md, AGENTS.md, docs/overview/product.md (incl. "Owner decisions for milestone 1"), docs/architecture/decisions/*.md, and the specs named below. Implement only requirements marked (M1). In each spec you implement, change NOT YET IMPLEMENTED to built for what you built, and fill section 9 test paths and section 12 code map (via a change note, docs_fold.py note, not by editing the version).
- Owned files: only the paths listed under "You own". Other agents work in parallel on the other areas. API handlers go in your own file(s) internal/api/handlers_<area>.go; delete only your operations' stubs from internal/api/stubs.go. Wire your area into the server and `crsp` binary through one small constructor/registration function in your own package; touch cmd/crsp/main.go and internal/api/server.go only with minimal additive lines.
- Tests: every M1 requirement you build gets a test (unit, plus integration against the fake GitHub where relevant). A suite that finds no tests fails.
- Checks before finishing (all must pass in your sandbox): go build ./..., go vet ./..., go test ./..., gofmt clean, golangci-lint (go tool) clean, codegen drift clean, and when you touch TS: pnpm install, pnpm -r typecheck, pnpm -r lint, pnpm exec prettier --check ., pnpm exec vitest run. Docs: from a clone of https://github.com/luis-mc/dev-standards run docs_index.py build then docs_check.py (0 errors).
- Finish: `git fetch origin && git rebase origin/main` (resolve conflicts in your favour only for files you own; for shared files keep both sides), rerun the checks, delete docs/work/ from the branch (DOCSPEC D9) and put your report text in the PR body, push, open a pull request to main titled "CRSP21: scheduler: slot queue, load gate, job hooks" (you may open PRs; never merge). Final message: PR number, head SHA, requirements built (IDs), tests added, checks, open questions, and `CODE DONE`.
