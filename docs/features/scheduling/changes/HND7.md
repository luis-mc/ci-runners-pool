---
change: minor
task: HND7
---
New requirement R5.69 (dev-standards lesson 5, rule D4): job classes (lint, unit, build, e2e, vm) carry a declared CPU and memory weight in one table; the gate admits a job by the sum of weights against the machine budget (`job_slots` units of each kind) instead of counting jobs. An unknown class weighs one slot. When the weight holds a job, the `free_slot` line names the class and its weight (R5.48). The load-not-measured hold stays (D53).
