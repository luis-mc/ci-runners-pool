---
change: minor
task: CRSP85
---
Windows jobs can run in Hyper-V isolated containers (R5.65). The pool setting `isolation` is `process` (default) or `hyperv`; hyperv adds `--isolation=hyperv`. A read-only probe refuses it with a clear reason where the engine is not a Windows engine or Hyper-V is absent. Memory, CPU set and mounts are unchanged.
