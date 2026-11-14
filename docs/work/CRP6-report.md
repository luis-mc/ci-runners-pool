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
- [x] Spec written: `docs/features/scheduling/spec.md`, 59 functional (R5.1 to R5.59) and 8 non-functional (R6.1 to R6.8) requirements, 67 in all, each with a planned Go test in section 9.
- [x] Docs index rebuilt (luismc-docs 2.6.1). `docs_check.py`: only W1 for this report, which is expected on an agent branch and is stripped at the join.
- [x] Pushed.

## Owner questions

Listed in the spec, section 11:

1. Order of service: repository priority before or after the event class (ready PR or default branch first)?
2. Milestones: fair share, priority and parallel limit M1; quiet hours and maintenance windows M3; scale-set demand M2. Right?
3. Hook cannot reach the agent or controller: load-only wait (source behaviour) or hold until the maximum wait?
4. Placement: cache warmth only as a tie-break, or stronger?
5. Defaults: keep 2 job slots, 1 light, 1 heavy, 30 min wait, on timeout `fail`, or size job slots from the budget at join?
6. Quiet hours model (fewer slots and a lower budget by day) and which time zone.

Summary: scheduling spec proposed, 67 requirements, all NOT YET IMPLEMENTED, ported from dev-standards with sources cited per requirement.
