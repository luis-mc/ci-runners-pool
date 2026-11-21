---
change: minor
task: CIX18
---
Workflow file checks (R5.29, R5.30, R5.43): six checks per job aligned with DL-99 limits (timeout-minutes at most 30, no test retries, mutation and many-run tests off pull requests), stored per commit in workflow_checks, shown as findings and as Doctor checks in the Workflows area; guardrail status store (R5.31, R5.32).
