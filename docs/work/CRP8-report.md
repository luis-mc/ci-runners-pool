# CRP8 report: feature spec `doctor`

Branch: `CRP8-spec-doctor`. Status: SPEC DONE.

## Steps

- [x] Branch from `main`, report written.
- [x] Read brief, decisions 0001 to 0005, UX rules v1, template, DOCSPEC §4, dev-standards `delivery_doctor.py`, `delivery_runner_pool.py` `doctor_checks`, `runner_health.py`, `runner_plan.py` and their tests.
- [x] Wrote `docs/features/doctor/spec.md`: 28 functional (R5.1 to R5.28) and 8 non-functional (R6.1 to R6.8) requirements, each with a planned test in §9; check catalogue with milestone per check; ported-check table (source function, source tests, planned Go test); not-ported list with reasons.
- [x] Regenerated index (`docs_index.py build`). `docs_check.py`: only W1 (this report under `docs/work/`, expected on an agent branch; strip before the join).
- [x] Commit and push.

## Notes

- Planned test paths in §9 are plain text, not code spans, so S2 does not fail on files that do not exist yet. §12 has no `Source:` lines for the same reason.
- `generator: luismc-docs 2.6.1` (the dev-standards scripts used).

## Owner questions

1. The brief lists the doctor under milestone 2 but says every milestone ends with the doctor covering its parts. Start it in milestone 1 (spec D6 assumes yes)?
2. Should `warn` make the CLI exit 1 (spec D3), or only `fail` exit non-zero?
3. Decision 0002 says `CI_RUNS_ON`; the brief says `CRP_RUNS_ON_*`. Update decision 0002 (spec D4 follows the brief)?
4. UX-58 has no warning glyph. Add one in the next design-system version?
5. Schedule defaults: full run every 30 min, quick run every 60 s. Right?
6. May viewers start a doctor run, or only read findings?
