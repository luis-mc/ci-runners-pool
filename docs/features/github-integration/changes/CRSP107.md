---
change: minor
task: CRSP107
---
Builds R5.6, the missing part of R5.22 and R5.38. The controller checks `GET /app` with an App JWT at start and every hour; when the App or its key is gone, the poller, the 10-minute loops and the installation webhook reconcile stop, running jobs are untouched, and `GET /api/v1/github/app-health` says so with a reason. A repository the reconcile turned off because it left the installation carries `pool_off_reason: left_installation` until it is back. `github.Reconciled` checks the job view of the scale-set source against REST every 5 minutes, so a missed job is found.
