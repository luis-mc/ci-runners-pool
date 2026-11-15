---
change: minor
task: HND8
---
Each runner keeps one uid/gid from a reserved range (default 64000-64999, `CRSP_RUNNER_ID_RANGE`) recorded in the store; the container backend and persistent Linux runners use it and lane folders are owned by it (R5.72, handover lesson 12 rule D10).
