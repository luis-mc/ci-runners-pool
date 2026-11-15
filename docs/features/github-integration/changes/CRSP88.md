---
change: minor
task: CRSP88
---
Trial modes before a repository is switched (R5.49): `observe`, `shadow`, `canary` and `off` per private repository, a per-repository report of hosted against crsp outcomes and times, `crsp trial OWNER/NAME [mode]`, and `GET`/`PUT /api/v1/repositories/{id}/trial`. A canary writes `RUNS_ON_CANARY_<JOB>` variables through the repos owner code and `off` restores the earlier variables exactly; public repositories are refused.
