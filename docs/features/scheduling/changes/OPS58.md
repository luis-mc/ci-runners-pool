---
change: minor
task: OPS58
---
R5.76 to R5.78: load is watched while jobs run; a start is held while over budget and running jobs are never stopped; a warning (doctor machine.load.budget) rises at once with jobs running and clears after 60 s steady under budget.
