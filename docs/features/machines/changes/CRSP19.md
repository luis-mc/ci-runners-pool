---
change: minor
task: CRSP19
---
The agent link gains two messages for self-update: `UpdateAgent` (controller to agent: update to this version) and `UpdateReport` (agent to controller: waiting for jobs, installing, postponed, failed, unsupported). The agent drains itself with the same gate hold as for any drain and never cuts a job. See operations R5.39 to R5.41.
