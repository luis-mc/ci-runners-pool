---
change: minor
task: HND15
---
The agent sends protocol version 2 in Hello and sets `runner_swap` in its machine report when it can replace runner files; the controller sends `UpdateRunnerFiles` only to a machine that reports it (runners R5.68).
