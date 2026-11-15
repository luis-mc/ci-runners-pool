---
change: minor
task: CRSP83
---
A machine with less than 10 GiB free (`disk_floor_gib`, `--disk-floor-gib`) starts no job and no VM: it pauses with the reason `disk_low` and resumes 1 GiB above the floor. The doctor check `machine.floor.disk` names what to clean (R5.70).
