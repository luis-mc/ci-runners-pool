---
change: minor
task: CRSP114
---
No command changes. `crsp agent` on a Mac passes a macOS VM counter to the agent (`cmd/crsp/macvm_wiring.go`), so the machine report carries the count (machines R5.14). Other OSes pass none.
