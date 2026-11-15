---
change: minor
task: HND5
---
An agent's follow update and the controller's automatic update wait for running jobs as long as the machine's drain timeout setting says, not a fixed 60 minutes (machines R5.33); after it the drain is cancelled and no job is cut.
