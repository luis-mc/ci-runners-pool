---
change: minor
task: HND24
---
A machine can run one host command for maintenance (cli R5.29, handover lesson 30). The controller sends it only to a machine held in drain with no running job, and the agent checks both again before it runs the command. The agent runs it as argv without a shell, stops it at its time limit (30 minutes by default), and returns the exit code and the last 64 KiB of output, redacted. Only an owner may call `POST /api/v1/machines/{machineId}/command`. The audit log records `machine.host_command` with the program name only. An older agent that does not report `host_command` gets nothing.
