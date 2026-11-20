# CRSP213 report: dev-standards 1.50 refresh

All 12 `.new` files merged by hand and deleted.

## Per file
| File | Taken from template | Kept from project |
|---|---|---|
| `.githooks/commit-msg` | no_attribution config check (top-level key), new regexes and messages | Enforces when `.delivery/config.json` is missing (the repo has none; CLAUDE.md/AGENTS rule is no attribution). A config that lacks the key opts out. |
| `.githooks/pre-push` | Whole template: guards loop, train_freeze, e2e_push_check, worktree re-exec, pre-push.local, node_modules check. fast_guards.py runs test_guardrails. | Go/web gates (gofmt, go vet, golangci-lint, go test, pnpm typecheck) as `project_gates()` after the guards, before pre-push.local. |
| `.github/workflows/artifact-prune.yml` | `runs-on` from `vars.CI_RUNS_ON`, `DELIVERY_SHARD: prune` | Workflow list, `scripts/ci/artifact-prune.sh`, newer action SHAs. Template's python prune and `--check-workflow` step not taken. |
| `.github/workflows/package-windows.yml` | DL-96 comment, "Name the release assets" step (`INSTALLER_NAME=crsp-windows-amd64`, matches release.yml), publish comment | No tag trigger (CRSP145), installer/ gate steps, newer SHAs. |
| `.github/workflows/train-cleanup.yml` | nothing (template had older SHAs and whitespace only) | file unchanged |
| `.github/workflows/windows-msi-check.yml` | nothing (template drops project gate and the CRSP147 authoring check) | file unchanged |
| `scripts/delivery/cancel_joined_runs.py` | D105 red-run skip, `--blocks-all` | no project change |
| `scripts/delivery/ci_fallback.py` | git timeouts, non-interactive env, fail-open markers (DL351) | no project change |
| `scripts/delivery/fast_guards.py` | `run_test_guardrails` (warn mode) | no project change |
| `scripts/delivery/smoke_packaged.py` | nothing | `probe_context` (loopback HTTPS probe, web-console R5.1): template dropped it |
| `scripts/delivery/tools.json` | nothing | syft 1.33.0, nfpm 2.49.0 (project additions) |
| `scripts/delivery/windows-msi-linux.sh` | DL-96 comment | mode 755 kept |

## New files
- `.github/workflows/ci-fallback.yml`: default-branch independent, `workflow_dispatch` only. Filled the PROJECT STEP with Go, pnpm, node and frozen install (same pins as ci.yml).
- `routines/ci-fallback-watch.json`: no placeholders; it is a template the owner creates by hand. Left as is.
- Open point: `scripts/delivery/ci-shards.json` does not exist (only `ci-shards.example.json`). `fallback_launch.py` reads it by default, so the fallback cannot start a shard until it exists. Not created here. Owner decision.
- Open point: `.delivery/config.json` does not exist in this repo. No `no_attribution` key can be read; the commit-msg hook enforces anyway (see above).

## Tests
- `py_compile` on all `scripts/delivery/*.py`: ok.
- `bash -n` / `sh -n` on both hooks and windows-msi-linux.sh: ok.
- YAML parse of all workflows: ok.
- commit-msg hook: rejects a `Co-Authored-By` line (rc 1), accepts a clean message (rc 0).
- `python3 scripts/delivery/test_guardrails.py --root .`: exit 0. Reports G1 12, G2 5, G4 37, G5 3 breaks (as expected, not fixed here).
- `python3 scripts/delivery/fast_guards.py`: guards, change-notes pass; test-guardrails ran and reported (no fail). Exit 1 from environment only: `gitleaks` not installed here (exit 127) and `golangci-lint` built with go1.25 vs go.mod 1.27.4. Neither is touched by this change.
- No `test_*.py` beside the changed scripts (only `test_guardrails.py`).

CODE DONE 6c5552cdf5 (code commit; the report commit follows it)

## Step 3 (1.51)

Status: started. Merging 11 `.new` files from luismc-delivery 1.51.0 on branch `CRSP213-dev-standards-1-50`.
