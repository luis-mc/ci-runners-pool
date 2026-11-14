---
change: minor
task: CRSP25
---
Repository variables are now `RUNS_ON_LINUX`, `RUNS_ON_WINDOWS` and `RUNS_ON_MACOS` (D300), written with lowercase labels; a variable is deleted when the repository has no runner for that OS or the pool is off for it, and the old `CRSP_RUNS_ON_*` variables are deleted on upgrade.
