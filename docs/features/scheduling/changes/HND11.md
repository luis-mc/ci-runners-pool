---
change: minor
task: HND11
---
Adds R5.69: slots are held by leases (holder id and expiry, renewed by heartbeat, reclaimed when expired) instead of process ids; R5.32 is superseded and R5.35 now renews leases from the agent's holder report. Migration 00013 adds `holder_id` and `lease_expires_at` to `slots` and backfills held rows.
