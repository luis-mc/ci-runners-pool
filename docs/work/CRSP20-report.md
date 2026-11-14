# CRSP20 report: agent link, machines, join, TLS CA, load

Status: started. Updated after every step.

## Plan (order)
1. internal/tlsca: controller CA + server cert, fingerprint, TLS 1.3 configs, pin check.
2. internal/load: probe seam, parsers, median window, WSL VM, Docker read, cgroup v2, sizing. Ports load.py, test_load.py, test_dl177_pool_measure.py (dev-standards).
3. internal/machines: join codes, keys, settings, drain/changes, offline, remove, AgentService handler. Repository interface + in-memory impl.
4. internal/agent: detect facts/backends, link with backoff, pin at join, secret store, settings cache, gate, drain idle check.
5. internal/api/handlers_machines.go: machines, join-codes, install-command, ca.pem.
6. Wire, specs change notes, checks.

## Open questions
- SQLite adapter for machines.Repository: internal/store is not mine (CRSP18). Repository is an interface; in-memory impl ships here.
