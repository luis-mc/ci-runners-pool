# CRSP84 + CRSP89 report (branch CRSP84-warm-pool-size-labels)

Status: in progress.

## Plan
- CRSP89 (R5.67): `internal/repos/sizelabels.go`. Size variables `RUNS_ON_<OS>_<SIZE>` from the size class table (runners R5.71) or the owner's floors; only machines with room (pool size) are listed; unserved size not written; unknown size refused with a clear message; plain `RUNS_ON_<OS>` unchanged.
- CRSP84 (R5.66): `internal/scheduler/warm.go`. Pure planner plus a small gate hook: a warm runner weighs one slot, counts against budget, is released first for a real job, replaced after 15 min, released on hold (paused, quiet hours, battery, disk floor), never started unless load is measured and under budget.

## Done
- [x] CRSP89 code + tests (repos)
