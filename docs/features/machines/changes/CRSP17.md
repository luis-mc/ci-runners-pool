---
change: minor
task: CRSP17
---
Join codes, the install command and machine removal (R5.3 to R5.7, and join-code and remove in R5.51) move from M3 to M1, per the owner decision for milestone 1. The contract adds them: createJoinCode, getJoinCode, revokeJoinCode, getInstallCommand, getCaCertificate, removeMachine, decideMachineChange, redetectMachine, getMachineLoad; agent.proto Join takes a join code or a local credential (R5.1) and returns the machine key and certificate pin. The planned machine_sched table of the scheduling spec is merged into machine_settings, and drain waits are stored in machine_changes.
