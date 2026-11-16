---
change: minor
task: CRSP114
---
The agent reports how many macOS VMs run (R5.14): `MachineReport.macos_vms` carries the VMs on the Mac (also ones the agent did not start), the ones it started, the limit of two, and why macOS VMs cannot run here (Intel Mac, macOS older than 13). A count that cannot be read is reported as unknown, never zero. Built in part: the count reads the host with `pgrep`, which needs a real Mac to verify; the controller's refusal to start a third VM is not built.
