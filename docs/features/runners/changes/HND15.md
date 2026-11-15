---
change: minor
task: HND15
---
New R5.69: the controller sends a runner bundle (versioned, SHA-256 checked) to an agent over the agent link, protocol version 2. The agent holds the runner, checks it is idle, swaps the files with a stage folder and renames, keeps the previous version, restarts the service and reports; it rolls back on a failure and never cuts a running job. An agent without `runner_swap` in its report is never sent the message. R5.38 now reads Built for the file replacement.
