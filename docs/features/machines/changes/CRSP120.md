---
change: minor
task: CRSP120
---
The controller's own agent is finished (R5.1, R5.2): it joins over loopback with the one-time local credential, which the controller renews every 5 minutes, keeps its identity in the data directory so a restart makes no second machine, and is skipped when a separately installed agent on the same host has already joined. The setup state marks the first machine done once any machine is in the pool.
