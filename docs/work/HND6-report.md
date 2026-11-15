# HND6 + HND12 report (route and size class in the runner registry)

Branch `HND6-route-size-class` from origin/main. Source: dev-standards-handover lesson 3 (D2 route apart from name) and lesson 2 (D1 one registry with route and size class).

## Plan
1. Migration 00013: `runners.route_pool`, `route_queue`, `size_class`; backfill route once from labels and the legacy name prefix; Down drops the columns.
2. `internal/runners`: `Route`, `SizeClass` table (one table: CPU and memory), `Select` that matches route and size.
3. Gate: light routing reads the runner record's route through a lookup, never the name.
4. Tests, spec R5.68/R5.69, change notes.

## Status
- [x] migration 00013 + sqlc regenerated (route_pool, route_queue, size_class; backfill once; Down drops columns)
- [x] `internal/runners/route.go`, `sizeclass.go`; Record.Route/SizeClass set on add, JIT, found runners
- [x] gate reads `Engine.SetLightLookup` (registry route), `slots.IsLightRunner` and `runners.IsLightName` removed; wired in `cmd/crsp/areas_wiring.go`
- [x] tests: routing ignores names, migration down/up with backfill, size class table and matching, gate by registry
- [x] docs: runners R5.68, R5.69 + traceability rows; change notes runners HND6/HND12, scheduling HND6

## Checks
- `go test -race` on internal/runners, internal/scheduler/..., internal/store: pass
- `GOOS=windows go vet ./...`: clean; gofmt clean
- golangci-lint not run: the installed binary is built with go1.25, repo targets 1.27.4 (CI runs it)
- `docs_check.py` not available in this sandbox

## Notes
- Size class is not yet a stored value in the SQLite runner store adapter (none exists: runners use `MemStore`); the column and sqlc insert are ready for it.
- `Select`/`Matches` are the matching API; CRSP89 will add size labels on top.
