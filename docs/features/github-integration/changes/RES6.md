---
change: minor
task: RES6
---
Tests pin that the policy of a repository (priority, parallel jobs, labels, budgets, light runner, hosted fallback, cap, hosted labels) is not changed by a sync, the installation reconcile, the 10-minute RUNS_ON restore, the fallback pass or a restart (R5.25, R5.28). Turning the hosted fallback off while a repository is on fallback now writes `fallback.ended` to the audit log, as R5.43 says every switch does. Fixture-driven edge tests for the fallback (grace boundary, flapping, cap mid-month, month rollover, opt-out, public repository, heartbeat age) are in the test table (R5.42, R5.43, R5.45; RES13).
