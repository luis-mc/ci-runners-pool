---
change: minor
task: CRSP23
---
Built the M1 core: engine, Check interface and registry, 17 checks, runDoctor, getDoctorRun, listDoctorFindings, and crsp doctor. CLI exit codes follow the owner's CRSP23 decision (fail exits 1, warn exits 0, could not run exits 3), replacing R5.22. The M1 checks share one package, internal/doctor/checks, instead of one per group. --local, the schedule, the event diff and the SQLite store adapter are not built.
