---
change: minor
task: RES2
---
New check `backend.baseimage`: each backend's runner base image exists on its machine. A missing one is a failure with the fix, and the machine takes no jobs until it is back (runners R5.69). The source of the probes is not wired in the controller yet.
