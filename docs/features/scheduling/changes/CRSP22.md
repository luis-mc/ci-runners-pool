---
change: minor
task: CRSP22
---
A hook that cannot find or reach crsp keeps the job going and now says so: a ::warning annotation on the job from the .ps1, .sh and crsp hooks, a problem file in the hook folder, and the engine alert hook.job_started_missing when a job ends without ever taking a slot (R5.61).
