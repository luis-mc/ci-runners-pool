---
change: minor
task: OPS19
---
A runner is found by its id, or by its name when exactly one runner has it, so removing a light or persistent runner never answers "no such runner". Every change to a runner record is told to the live stream (runner.state), so the console list moves without a reload.
