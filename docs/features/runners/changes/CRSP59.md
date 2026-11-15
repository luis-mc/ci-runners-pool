---
change: minor
task: CRSP59
---
Runner auto-update with drain (R5.38): `UpdateRunner` drains a persistent runner, replaces it through the agent and shows `updated`, `failed` with the reason, or `waiting for the job to end`; the automatic run follows the product's automatic-update setting. A runner download with a wrong SHA-256 is deleted and fetched once more before it is refused (R5.37).
