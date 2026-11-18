---
change: minor
task: OPS21
---
The machine page shows "Setting the CPU cap." while the agent has not yet reported the result for the chosen CPU cap, and drops the error of the last value. It reads the machine again every 2 seconds until the state settles (machines R5.64).
