---
change: minor
task: CRSP77
---
R5.37: a quiet-demand watchdog restarts the REST demand loop once when queued jobs for the pool exist and the source has seen no demand for 10 minutes (config `demand_quiet_minutes`), and keeps the state the doctor check `demand.quiet` reads (CRSP77).
