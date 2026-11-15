---
change: minor
task: CRSP48
---
The job-started hook brings the Rust build cache under its caps before the disk check, so a full cache folder does not hold the job for disk space (caches R5.45; CRSP48).
