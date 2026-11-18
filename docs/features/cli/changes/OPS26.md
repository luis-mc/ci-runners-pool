---
change: minor
task: OPS26
---
No behaviour change in the command. `cmd/crsp/wiring_test.go` now stops the backup and retention jobs and waits for them before the temporary data directory is removed (`backup.Ops.Wait`, operations R5.21).
