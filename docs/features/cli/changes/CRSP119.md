---
change: patch
task: CRSP119
---
`agent install` refuses to start without admin rights (one plain line, nothing changed), and `agent install`, `agent run` and `agent join` default `--data-dir` to the machine-wide folder of the OS.
