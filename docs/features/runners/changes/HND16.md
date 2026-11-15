---
change: minor
task: HND16
---
Extra packages reach a remote machine (R5.68): the runner spec carries the list, the agent checks each name again, installs into the runner environment only (never the host OS), caches a done set by its hash, and reports a failed set in the machine report and the doctor check `runner.packages`.
