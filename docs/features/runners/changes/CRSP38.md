---
change: minor
task: CRSP38
---
The persistent backends supervise the runner listener, not its wrapper: after a stop they wait for Runner.Listener to end and never start a second one, on systemd, launchd and Windows services (R5.46).
