---
change: minor
task: OPS9
---
Stopping a runner now ends its whole listener: the Linux unit uses `KillMode=mixed`, and a `Runner.Listener` that outlives the stop gets a terminate, then a kill of its process group (Windows: `taskkill /T /F`) after a bounded grace, then a check that none is left. A runner is never started while a listener of the same runner folder runs; the start fails and names the process ids (R5.59, R5.60).
