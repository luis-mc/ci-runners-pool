---
change: minor
task: CRSP21
---
Adds R5.39: a persistent runner has per-runner cache folders, quotas, eviction between jobs and the disk guard (caches R5.36 to R5.38). The runner service passes the declared quota to the backend; RunnerSpec gains CacheQuota.
