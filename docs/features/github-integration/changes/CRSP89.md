---
change: minor
task: CRSP89
---
The repository variable writer also writes the size variables RUNS_ON_<OS>_<SIZE> (internal/repos/sizelabels.go), each listing only the machines with room in that pool size; plain RUNS_ON_<OS> variables are unchanged. The requirement is R5.67 in the scheduling spec.
