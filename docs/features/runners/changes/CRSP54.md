---
change: minor
task: CRSP54
---
Postgres 16 per pool through the container engine seam, a login and a database per runner with a random password kept only in the OS secret store, `CREATEDB` opt-in and declared `NOLOGIN` roles (R5.45, R5.54); `crsp db-env` replaces its stub: masks secrets and appends the settings to `GITHUB_ENV` (R5.54). Open questions 14 to 17 added.
