---
change: minor
task: CRSP53
---
R5.43 and R5.44 are built as library code: cache lanes per repository with a lock, quota and eviction as for a runner, the lane mounts of a container, the shared-cache rules (mode 1777, Windows access list, first writer wins, one warning and a private fallback), and the closed list of variables a job reads. Decision D308 stands: pinned downloads and `tools.json` stay in the delivery scripts. Open questions Q7 to Q10 added.
