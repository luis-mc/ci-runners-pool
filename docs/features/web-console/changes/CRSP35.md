---
change: minor
task: CRSP35
---
Jobs and Doctor screens built (R5.24, R5.26). Jobs: the queue with each job's wait reason, the history on a time axis with filters by repository, machine, result and time range, the detail with a link to the run on GitHub, and Export of every row of the filter in the order shown (exportJobs is built: CSV or JSON, formula-looking text neutralised, named crsp-jobs-<stamp>). Doctor: findings grouped by area with a status word and fix, the last run time, and Run the doctor as the one primary, busy with progress while the run lasts. Two shared parts join the shared UI: time axis list (component 24) and table export (component 29). listJobs and getJob now return the runner's backend and isolation, and listJobs and exportJobs filter by backend. No contract change.
