---
change: minor
task: OPS53
---
Every runner of one repository shares one Postgres owner role (R5.94): runner logins are members WITH INHERIT and SET, databases and the job's created roles belong to it through PGOPTIONS role, and removing the last runner drops it. Fixes SQLSTATE 42501 on a second runner of a repository.
