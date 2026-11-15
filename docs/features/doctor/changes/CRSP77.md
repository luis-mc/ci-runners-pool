---
change: minor
task: CRSP77
---
Checks `demand.quiet` (a pool repository has queued jobs for the pool and the demand source has seen none for 10 minutes; warn) and `github.webhook` (failed or missing webhook deliveries; warn) are built (CRSP77, owner decisions D51 and D54). 28 core checks, 30 with the two KVM checks.
