---
change: minor
task: CRSP89
---
R5.67 is built: size variables `RUNS_ON_<OS>_<SIZE>` (small, medium, large, xl from the size class table of runners R5.71) list only the machines with room in their pool size; an unserved size is not written, an unknown size is refused with the known ones named, and the runs-on check says why a size variable is not set. Plain `RUNS_ON_<OS>` variables are unchanged.
