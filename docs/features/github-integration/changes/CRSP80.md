---
change: minor
task: CRSP80
---
Builds the automatic sweep of R5.33: `runner_sweep_days` (default 7, 0 is off) in `config.toml`; offline ephemeral registrations that crsp made, matched by crsp's own record and the `crsp-` name, older than the grace, are deregistered once an hour. Busy runners (a 422 on delete included) and runners with no crsp record are never touched. GitHub's 422 on a runner delete now reads as `ErrRunnerBusy`.
