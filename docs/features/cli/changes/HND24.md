---
change: minor
task: HND24
---
New command `crsp machine maintain NAME -- COMMAND...`: it holds new jobs by draining the machine, waits for running jobs to finish (queued jobs stay queued), runs the command on the machine through the agent link, and always lifts the hold, also when the command fails or Ctrl-C is pressed. It never cancels a job (R5.29, handover lesson 30). Adds the owner-only controller route `POST /api/v1/machines/{machineId}/command` and the agent message `RunHostCommand`.
