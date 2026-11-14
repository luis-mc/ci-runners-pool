---
change: minor
task: CRSP21
---
Runner cache quotas move from milestone 7 to milestone 1 (R5.36 to R5.38): a declared quota per runner cache (config keys cache_tool_gib 20 GiB, cache_rust_gib 40 GiB), oldest-first eviction between jobs by the job-completed hook, and a disk guard in the job-started gate that holds new jobs under 10% free (resume at 12%, doctor check machine.guard.disk). Built in internal/runnercache, internal/hooks and internal/doctor/checks.
