# CRSP136 report: Docker disk auto-compact

Branch: CRSP136-auto-compact. Base: origin/main f6f720c.

## Plan (steps, pushed one by one)
1. Agent helper `docker-compact` (internal/dockercompact + agent wiring, GOOS-split host).
2. Machine setting (machines.Settings, API, CLI flags, openapi + codegen).
3. Policy decision + controller loop through the maintain path (hold, drain, compact, release).
4. Notices to projects, audit entries.
5. Facts + doctor line for missing admin rights, console action.
6. Console Machine page settings (packages/ui parts), content.md words + CHANGES.
7. Specs (caches, machines, operations), change notes.

## Notes
- The luismc-docs plugin scripts (`docs_fold.py`, `docs_check.py`) are not installed in this sandbox; change notes are written by hand in the existing `changes/<TASK>.md` format. `docs_check.py` was not run.
- Machine settings live in the in-memory repo (no SQL migration).

## Status
Started.
