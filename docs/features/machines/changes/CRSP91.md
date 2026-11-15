---
change: minor
task: CRSP91
---
The controller refuses a Session from an agent that says an agent link protocol below the minimum (2) and marks the machine as needing recovery (operations R5.44); the machine view and API carry `recovery`, and the agent keeps only the frozen recovery call.
