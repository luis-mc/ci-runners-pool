---
change: minor
task: CRSP80
---
Builds R5.62: one safe removal order for an ephemeral runner (idle check, deregister at GitHub, then stop and clean up). A busy runner, or a 422 on the delete, leaves the runner running and keeps its record; a runner GitHub no longer knows counts as already deregistered. Also R5.25: the JIT config goes to the runner on standard input only (CRSP79).
