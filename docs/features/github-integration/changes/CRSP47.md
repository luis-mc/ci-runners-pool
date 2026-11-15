---
change: minor
task: CRSP47
---
A repository setting `legacy_vars` (off by default, API field `legacy_vars`) also writes `CI_RUNS_ON` and `CI_RUNS_ON_WINDOWS` with the labels of `RUNS_ON_LINUX` and `RUNS_ON_WINDOWS`, keeps and deletes them under the same rules, and never deletes one the controller did not write (R5.39).
