---
change: minor
task: HND9
---
A container job gets the folder of the crsp binary read-only at `/opt/crsp-bin` and runs it from there (`CRSP_BIN`), not a single-file mount that goes stale when the file is replaced (R5.68).
