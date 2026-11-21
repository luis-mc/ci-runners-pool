---
change: minor
task: OPS60
---
R5.99, R5.100: Add runners never says the runners are added while one failed (step ends with the real outcome, Done counts failed and done and names the next step); a failed pool runner stays in Runners as Failed with its reason and is no longer removed and retried by the reconcile.
