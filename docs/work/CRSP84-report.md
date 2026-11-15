# CRSP84 + CRSP89 report (branch CRSP84-warm-pool-size-labels)



## Plan
- CRSP89 (R5.67): `internal/repos/sizelabels.go`. Size variables `RUNS_ON_<OS>_<SIZE>` from the size class table (runners R5.71) or the owner's floors; only machines with room (pool size) are listed; unserved size not written; unknown size refused with a clear message; plain `RUNS_ON_<OS>` unchanged.
- CRSP84 (R5.66): `internal/scheduler/warm.go`. Pure planner plus a small gate hook: a warm runner weighs one slot, counts against budget, is released first for a real job, replaced after 15 min, released on hold (paused, quiet hours, battery, disk floor), never started unless load is measured and under budget.

## Done
- [x] CRSP89 code + tests (repos)
- [x] CRSP84 code + tests (scheduler): `warm.go`, `WithWarm` gate hook, `warm_runners` key in `slots.Settings`
- [x] Spec R5.66/R5.67 marked built (text), change notes CRSP84.md, CRSP89.md
- [x] cmd adapter `MachineSizes` + `Sizes:` wiring (small hook)

## Not built (open)
- Agent side: starting/draining warm runners, VM pre-boot variant, console state.
- `warm_runners` as a stored machine setting (needs SQL column, openapi, proto: outside scheduling).
- Owner's size-floor map in Settings (`Config.SizeFloors` hook exists, nothing feeds it).
- Size labels list labels of machines with room; a label shared with a smaller machine cannot split them.

## Checks
- go test -race scheduler (full, one bug found and fixed: warm room check), repos: pass. Warm tests rerun after fix: pass.
- GOOS=windows go vet (scheduler, repos, cmd) and GOOS=darwin go vet (scheduler, repos): clean. gofmt clean.
- Not run: golangci-lint (installed binary built with go1.25, repo needs 1.27.4); native `go build ./cmd/...` fails in fyne.io/systray on this Linux box (environment, not this change).
Status: code done.
