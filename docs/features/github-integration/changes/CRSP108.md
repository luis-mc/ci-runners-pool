---
change: minor
task: CRSP108
---
Fork pull requests off by default is built (R5.26): the runner job-started hook (`crsp hook job-started`, `internal/hooks/forkpr.go`) reads the event payload and fails a forked pull request job on a public repository at once, before the gate and any step, with a message that names the policy, unless `CRSP_ALLOW_FORK_PRS=1`; the hook test covers the sh and PowerShell hooks. Offline runner cleanup yes path is built (R5.33): `DELETE /api/v1/runners/{runnerId}/registration` after a yes that names the runner, `crsp runner delete-offline`, and the console action. Writing the policy variable into a runner environment is still open.
