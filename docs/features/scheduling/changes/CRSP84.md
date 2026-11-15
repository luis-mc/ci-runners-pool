---
change: minor
task: CRSP84
---
R5.66 is built in the scheduler: a warm runner counts as one slot against the machine budget, starts only when the load is measured and under budget, and is released oldest first when it is stale, when the count drops, on a hold, or when a real job needs its budget. New scheduling key `warm_runners` (default 0). The agent side, the VM variant and the stored field in the machine API are not built.
