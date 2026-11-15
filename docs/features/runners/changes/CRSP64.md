---
change: minor
task: CRSP64
---
The base image files are inside the binary and written to a build folder before a build (R5.27, R5.33). The pool size of a machine is the CPU and memory limit of each repository pool container (R5.27). A container runner with no job for 15 minutes is removed after the busy check and frees its slot (R5.26).
