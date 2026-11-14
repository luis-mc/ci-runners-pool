# CRP3 report: spec github-integration

Branch: `CRP3-spec-github-integration` (from `main` 5bedb33). No pull request; the orchestrator joins spec branches.

## Status

- [x] Branch created, report written.
- [x] Inputs read (product brief, decisions 0001-0005, stack profile, UX rules, contract, template, DOCSPEC §4, dev-standards runner-pool spec and DELIVERYSPEC).
- [x] `docs/features/github-integration/spec.md` written: 38 functional (R5.1-R5.38) and 12 non-functional (R6.1-R6.12) requirements, 50 in all, each with a milestone, NOT YET IMPLEMENTED, and a planned test path in §9.
- [x] `docs_index.py build` and `docs_check.py` run. Only error: W1 for this report under `docs/work/` (expected; strip at the join with `docs_work.py strip`).
- [x] Committed and pushed.

## Notes

- §9 test paths are written as plain text with `planned:` (no backticks), because `docs_check.py` S2 fails on a backticked path that does not exist yet. Add backticks when each test lands.
- §12 `Source:` lines name only files that exist now (contract, config, API server, first migration); planned packages are listed as text.
- Ported from dev-standards: runner-pool R5.32 (registration token on demand, never stored), R5.32 rerun / R5.33 / DL315 (remove token, stop on failure), R5.36 (repository variable, renamed to `CRP_RUNS_ON_*`), R5.37 (non-generic label removal only with a yes), R5.39 (doctor `runs-on` check), DELIVERYSPEC DL-09 (runners online for every label).

## Open questions for the owner

1. Decision 0002 still names `CI_RUNS_ON` / `CI_RUNS_ON_WINDOWS`; the brief says `CRP_RUNS_ON_*`. Amend 0002 (the spec follows the brief, decision GI-1)?
2. When the pool is turned off, delete the `CRP_RUNS_ON_*` variables after a yes (R5.29, as written), or keep them?
3. Config default listen is `127.0.0.1:8080`; the brief and the dev callback use 8460. Move the default to 8460 in M1 (as written)?
4. GitHub user refresh tokens: keep them in the OS secret store (R6.1, as written) or keep no user token after sign-in?
5. Organization pool (R5.21) placed in M3; M1 does repositories only. Agree?
