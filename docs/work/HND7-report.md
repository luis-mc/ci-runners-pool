# HND7 report: job class weights

Source: `docs/architecture/dev-standards-handover.md` lesson 5, rule D4. Branch `HND7-job-weights` from origin/main.

## Plan
- `internal/scheduler/slots/weights.go`: one table of job classes (lint, unit, build, e2e, vm), each with a CPU and memory weight; `Settings.Classes`, `WeightOf`, `Capacity`.
- `internal/scheduler/gate.go`: admit a ci job when held weight + its weight fits the machine budget (capacity = `job_slots` units per dimension); wait text names the weight.
- Unknown class: default weight 1 CPU, 1 memory (one slot), so behaviour without classes is unchanged.
- D53 stays: the load-not-measured hold is untouched and checked after the weight check as before.
- No schema or protobuf change: the class of a held slot is found again from its job key and shard.

## Status
- [x] Report
- [ ] Code
- [ ] Tests
- [x] Spec R5.69 and change note (written by hand: docs_fold.py is not in this sandbox, so docs_check was not run)
- [ ] Draft PR

## Notes
- `internal/agent/gate.go` (agent-side load-only fallback, R5.23) is not changed: it never admits by slots.
- Weight above the machine budget is clamped to it, so a heavy class can still run alone.
