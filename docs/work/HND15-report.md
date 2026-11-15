# HND15 report: replace runner files over the agent link

Branch `HND15-runner-file-swap`, base origin/main 40f779d. Spec: runners R5.38; parity-plan "What is left" item 4.

## Plan
1. Proto: `UpdateRunnerFiles` (SessionResponse 23), `PROTOCOL_VERSION_2`, `MachineReport.runner_swap` (capability), `RunnerResult.version` and `rolled_back`. Regenerate.
2. `internal/runnerswap`: checksum, unpack, stage dir, atomic rename swap, keep previous, rollback.
3. Agent: hold the runner on the gate (idle check and hold are one step), swap, restart, answer.
4. Controller: `agentlink.Agent.UpdateRunner`, gated by the agent's `runner_swap` report. An older agent never sets it, so the controller answers "cannot update runners yet" and sends nothing.
5. Spec R5.38 text + change note; parity-plan item 4.

## Status
- [ ] 1 proto  - [ ] 2 swap  - [ ] 3 agent  - [ ] 4 controller  - [ ] 5 docs
