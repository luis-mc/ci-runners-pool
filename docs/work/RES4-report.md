# RES4 and RES5 report (branch RES4-env-sets-registry)

Source: docs/architecture/landscape-2026-11.md (it names no RES4 or RES5 item; scope taken from the task brief).

## Plan
1. `internal/envsets`: named sets, merge machine < set order < runner, sensitive values encrypted (secrets store) and redacted. Status: started.
2. `internal/regcreds`: registry logins and CA bundle, injection per backend (container, VM, persistent) with fakes. Status: not started.
3. API (`GET /api/v1/runners/{id}/env`, env-set and registry routes) and `crsp runner env <name>`. Status: not started.
4. Spec R5.68+ and change note. Status: not started.

## Open questions
(none yet)
