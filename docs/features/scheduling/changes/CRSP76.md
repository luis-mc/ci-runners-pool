---
change: minor
task: CRSP76
---
R5.22 and R5.23 changed (owner decision D53, 2026-11-15, different from the old pool on purpose): a load that cannot be measured holds the job (reason "load not measured") instead of letting it run; the hook warns once and keeps waiting; on timeout such a job fails, the rule "run" never runs it unmeasured (R5.20, R5.61, R5.62 follow). R5.48 built early in part (decision D51): `getOverview` returns `waiting`, every queued job with its first blocking reason in words.
