---
change: minor
task: OPS24
---
New check `runner.logon` (R5.45): fails when the account of a Windows runner does not hold the right to log on as a service, or the service does not run; the finding names the account and the service, and the Doctor screen has a Start button that makes the agent give the right again and start the service.
