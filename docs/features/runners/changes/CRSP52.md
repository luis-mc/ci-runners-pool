---
change: minor
task: CRSP52
---
Linux pool containers (R5.25 to R5.27, R5.31 to R5.33, R5.35): one pool container per repository with a non-root job user, no Docker socket, one capability set and KVM only as a device; one ephemeral runner per job from a JIT config that is written to a private tmpfs file and deleted at start; best-backend choice; image key, build-once and keep-newest; rebuild aside, drain, swap, with the old image restored when the swap fails. Six open questions (14 to 19) record the conservative choices.
