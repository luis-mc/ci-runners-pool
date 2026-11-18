---
change: minor
task: OPS28
---
Adds two checks (owner decisions D94 and D95, 18 Nov 2026): `runner.unclean` (R5.46) fails for a persistent runner whose cleanup failed, because such a runner takes no job and would otherwise look idle; `repo.ephemeral_capacity` (R5.47) fails for a public repository that is Ephemeral only when no machine has ephemeral capacity, because its jobs would wait. The fix of the second is a link to Add runners.
