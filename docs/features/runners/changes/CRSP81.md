---
change: minor
task: CRSP81
---
Job containers run with a read-only root file system and tmpfs work dirs (`/home/runner`, `/tmp`, `/var/tmp`, tool cache when no lane mounts it). `CheckRunArgs` now also refuses a container without `--read-only` and any custom seccomp profile. The runners spec lists exactly what a job can reach (R5.81, R5.82).
