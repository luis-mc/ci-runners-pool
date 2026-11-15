---
change: minor
task: CRSP58
---
Container runners start when a job is queued: the Linux registry holds the container backend (off until a machine's allow list names `docker`), the local agent routes a JIT config to it, and an ephemeral runner can be planned only on such a machine. Open questions 32 to 36 record the conservative choices.
