---
change: minor
task: RES3
---
Joining a machine is copy-and-wait with one Copy button and a short-lived single-use join code, plus an optional SSH join for Linux and macOS (owner decision D59). `getJoinCode` carries `progress` (waiting, connected, ready from the first heartbeat). The SSH key file is used once for that join and never stored; there is no password option; the host key fingerprint is confirmed first (R5.3a, R5.4a).
