---
change: minor
task: OPS50
---
Windows upgrade: CloseTray runs through WixQuietExec (no console window) and also stops the crsp-agent service before InstallValidate, with the agent-was-running flag restored by StartServices2 and the rollback action (R5.86).
