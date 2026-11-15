# HND8 report: persistent runner uid/gid (D10)

Branch HND8-uid-range from origin/main.

Done:
- `internal/runnerid`: Range, Parse, Allocator (stable, lowest free, skips host ids, ErrExhausted), HostFiles.
- `internal/store/runnerid.go`: allocations in settings key `runner_id.<name>`.
- Container backend: `Config.IDs`, `PoolSpec.UID`, `--user uid:uid`, lane `chown -R`.
- Linux backend: `useradd --uid`.
- Wiring: `registry.Platform(d, ids...)`, `cmd/crsp/runnerid_wiring.go`, env `CRSP_RUNNER_ID_RANGE`.
- Spec R5.68, traceability row, change note HND8.

Checks: go test -race on runnerid, store, backend/..., runners: pass. GOOS=windows go vet: clean. gofmt clean.
Not run: golangci-lint (installed build is older than the module Go version), docs_check.py and docs_fold.py (luismc-docs scripts not on this machine; change note written by hand in the existing format).
Limit: the existing-account case keeps whatever uid it has; no usermod migration.
