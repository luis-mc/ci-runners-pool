---
change: minor
task: CIX13
---
Job page faults: each job records its runner origin (crsp, other or hosted), group and labels; steps of poller-only jobs are read by REST (once at completion, at most every 60 s while the page is open); stale queued or running rows are reconciled with GitHub every 5 min and set done or lost.
