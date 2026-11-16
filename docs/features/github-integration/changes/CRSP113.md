---
change: minor
task: CRSP113
---
Pool per organization (R5.21) is built: an owner of a GitHub organization turns it on over the API (`PUT /api/v1/github/installations/{id}/org-pool`) and the CLI. The controller keeps one runner group named for the pool, limited to the repositories whose pool is on, and registers their runners at organization level. A personal account stays at repository level.
