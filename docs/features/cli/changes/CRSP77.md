---
change: minor
task: CRSP77
---
The controller wiring starts the quiet-demand watchdog and registers the checks `demand.quiet` and `github.webhook`; config has the new key `demand_quiet_minutes` (CRSP77). No CLI command changes.
