---
change: minor
task: OPS21
---
The CPU cap state follows the chosen value (R5.64). The agent report carries the percent it applied, and the console view shows `applying` (no old error) while that percent differs from the chosen one, until the agent reports the result for the chosen percent. The agent sets the cap before it reports and reports the percent the result is about. The machine page reads again every 2 seconds while the state is `applying` and shows "Setting the CPU cap." Tests are in the test table (R5.64).
