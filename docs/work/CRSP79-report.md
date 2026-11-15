# CRSP79 + CRSP80 report (branch CRSP79-scaleset-sweep)

Status: CODE DONE 2026-11-15. Both tasks are on this one branch, as asked.

## CRSP79: scale-set demand, JIT over stdin
- `internal/backend/container`: the JIT config goes on stdin of one `docker exec -i` call; the start script reads one line and starts the runner with it in that one process's environment. No file, no argument, no container or exec `-e`. The `/run/crsp` tmpfs is removed. Tests: `jitstdin_test.go`.
- `internal/github/scaleset.go`: own client (registration, find or create scale set, session, long-poll message, ack, acquirejobs, generatejitconfig), written from the public protocol. No code copied; `actions/scaleset` is not a dependency.
- `internal/github/scaleset_demand.go`: `ScaleSetDemand` implements `github.Demand`; fails fast (closes the stream, `Err()`).
- `internal/demand/scaleset.go`: `Failover` (scale set first, polling on failure, back-off 30 s doubling to 10 min, one source at a time). `Loop.ScaleJIT` + `runners.JobRunner.JIT` make a scale-set job's runner take its JIT config from the scale set.
- Setting: `scaleset_demand` in `config.toml`, off by default. Wiring in `cmd/crsp/demand_wiring.go`.

## CRSP80: safe removal and sweep
- `github.ErrRunnerBusy` from a 422 on a runner delete (`internal/github/client.go`).
- `runners.removeSafely`: list (idle check), delete, then stop, clean up, drop record. Busy or 422 changes nothing; unknown at GitHub counts as gone.
- `runners.SweepOffline` (`sweep.go`), hourly from `cmd/crsp/sweep_wiring.go`; setting `runner_sweep_days` (default 7, 0 off).

## Decisions to check
1. The task said "matched by a crsp label and its own record". crsp's labels are generic by rule (runners R5.36), so no label is unique to crsp. Ownership is: crsp's own managed record + the `crsp-` name + matching GitHub id. A runner with no record is never touched. If you want a label test too, say which label.
2. The sweep covers ephemeral runners only. Persistent runners (a laptop off for a week) are left alone. The spec text said any registration crsp made; this is narrower on purpose.
3. A pull request from a scale set counts as a fork PR (the message has no fork flag). With the default fork policy those jobs wait for approval; polling shows the real flag.
4. Switching sources can offer the same job under a second id; the extra runner goes after the idle time (15 min).
5. The runner binary reads the JIT config only from `--jitconfig` or its own env, so "never in env" is met for the container and the exec call, not for the runner process itself.
6. The settings live in `config.toml` only (no API or console switch: `apps/web` is off limits here). Doctor line for "polling instead of scale set" is not built; it is in the log.
7. Scale-set protocol was written from memory of the public docs and is only tested against a fake. Needs one run against real GitHub before it is turned on.

## Checks run
- `go vet` of touched packages, `GOOS=windows go vet ./...` (clean), `go test -race` of `internal/runners demand github config backend cmd/crsp` (all ok).
- `golangci-lint` could not run: the installed binary is built with go1.25, the module targets 1.27. `gofmt -l` is clean.
- `docs_fold.py` and `docs_check.py` are not installed in this sandbox, so the change notes were written by hand in the CRSP78 format and the docs check was not run.
- No e2e, Docker or mutation pass.
