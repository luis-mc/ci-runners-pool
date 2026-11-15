---
change: minor
task: CRSP86
---
Docker inside a job through a per-job clone of the VM base disk (R5.66): the `NeedsDocker` runner field, a clone made for each job and deleted after it, no host Docker socket in the job, and a clear refusal on a machine with no VM backend or a base disk without Docker.
