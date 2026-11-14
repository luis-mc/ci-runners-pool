---
change: minor
task: CRSP20
---
Built M1: controller CA and TLS 1.3 agent link (8461), one-time join codes and per-machine keys, session stream with heartbeat, offline and reconnect, detection, load measurement (ported from dev-standards load.py), machine settings, drain and resume, remove, and the controller's own agent. Code in internal/tlsca, internal/load, internal/machines, internal/agent, internal/api/handlers_machines.go, cmd/crsp. Tests under those paths. Not built: R5.14, R5.27-R5.29, R5.49, R6.9, R6.10; machines are kept in memory until the SQLite adapter lands in internal/store; stop-jobs waits for the runners feature. Contract unchanged.
