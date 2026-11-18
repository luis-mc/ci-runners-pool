---
change: minor
task: OPS24
---
A runner account keeps its right to log on as a service (R5.88): the agent gives `SeServiceLogonRight` and the two deny-logon rights again at agent start, with every machine report and right before it starts a runner service, retries a start once on Windows error 1069, and reports a service it could not start in `MachineReport.runner_services`. The likely cause of the 18 Nov outage (a policy refresh at boot, or an account made again with a new SID) is written down; it is not proven.
