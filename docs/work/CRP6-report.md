# CRP6 report: feature spec `scheduling`

Branch: `CRP6-spec-scheduling`. Task: write `docs/features/scheduling/spec.md`.

## Status

- [x] Branch created from `main` (5bedb33).
- [x] Read brief, decisions, stack profile, UX rules, template, DOCSPEC section 4.
- [x] Read the dev-standards sources and tests (dev-standards `afe32358`): `machine_slots.py`, `runner_load_gate.py`, `runner_job_done.py` and wrappers, `load.py`, `load_guard.py`, `delivery_runner_pool.py` (WSL VM, Docker CLI, median), tests `test_machine.py`, `test_load.py`, `test_dl200`, `test_dl267`, `test_dl270`, `test_dl292`, `test_dl327`, `test_dl176`, `test_dl177`, `test_dl289`, `test_dl310`, `test_dl324`, `test_runner_pool.py`, `test_doctor.py`.

## Findings

- `docs_check.py` S2 fails on test paths in backticks that do not exist. Planned Go test paths are written without backticks until the code exists.
- No `Source:` lines yet: no code exists. Section 12 lists the planned files.
- The sibling specs (github-integration, machines, runners) are not on `main` yet, so they are named, not linked.
- `load.py` smooths CPU with a mean of up to 3 samples in 30 s, not a median. The median (5 samples, 1 s apart) is the pool sizing read in `delivery_runner_pool.py`. The spec keeps both as they are.
- The ci-wait marker and claim-lost exit 3 in `runner_load_gate.py` belong to the dev-standards cloud fallback. Not ported.
- `load_guard.py` classifies Claude Code tool calls. Only its rules (hold new work, never kill, fail open, lower-never-raise) are ported.
- [ ] Spec written.
- [ ] Docs index rebuilt, docs check clean.
- [ ] Pushed.

## Owner questions

None yet.
