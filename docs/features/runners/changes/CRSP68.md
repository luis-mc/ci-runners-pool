---
change: minor
task: CRSP68
---
A pool container started for a job now gets what the earlier tasks built: the repository's cache lane and its three variables, the job environment (`CI_MAX_PARALLEL`, the cache quotas, the browsers path, `WINEPREFIX`), the Wine prefix for the `windows-packaging` layer, the `crsp` mount, `/dev/kvm` for the `kvm` layer, and a Postgres login with `db.env` for a repository that declares a database. A required step that fails stops the start and leaves no runner (R5.27, R5.41, R5.44, R5.48, R5.52, R5.53, R5.54).
