---
change: minor
task: REG2
---
The agent gets the job image in a fixed order: the local engine, then EnsureImage, then a pull by digest, else a local build and a background push to staging (R5.13 to R5.20). A controller that does not answer is waited for; the job log says so with the time waited. Hello says protocol version 3 and the MachineReport says registry.
