---
change: minor
task: CRSP21-disk-guard
---
New R5.60: the job-started gate holds new jobs while the runner volume has under 10% free, with a 2 point resume margin, and fails them as re-runnable at the maximum wait (caches R5.38).
