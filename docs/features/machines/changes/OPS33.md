---
change: minor
task: OPS33
---
The agent can scan for runner leftovers and remove chosen ones (new agent messages ScanRunnerLeftovers and RemoveRunnerLeftovers, the machine report flag `runner_leftovers`); new route `POST /api/v1/machines/{machineId}/runner-leftovers/remove` (admin), audited per item (doctor R5.46).
