---
change: minor
task: CRSP119
---
R5.45 changed: `agent install` stops before the plan when the process has no admin rights, with one plain line and no change. The data folder defaults to the machine-wide one of the OS (also for `agent run` and `agent join`), not the user's profile. PowerShell steps report one plain error line instead of CLIXML, and a failed step names what it left behind and how to remove it.
