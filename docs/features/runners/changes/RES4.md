---
change: minor
task: RES4
---
Named environment sets (R5.68) merged machine, then sets in order, then runner, with sensitive values kept in the secret store and masked everywhere (R5.69); `crsp runner env <name>` and `GET /api/v1/runners/{id}/env` show the merged result. Env set routes added. Store tables and the runner start wiring are open (question 56).
