---
change: minor
task: HND17
---
A container pool gets its own pinned CPUs from the machine's CPU budget, never shared with another pool, and a memory cap with no swap. A full budget refuses the start with the reason. The CPUs are freed when the pool is removed, and read back from the live containers after a crash. Requirement R5.54.
