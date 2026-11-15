# CRSP81 / CRSP82 / CRSP83 report (branch CRSP81-hardening-public-disk)

Status: code done. Pushed after every step.

## CRSP81 container hardening (runners R5.68, R5.69)
- Already there: `--cap-drop ALL` (none added: no job step needs one), `no-new-privileges`, `--pids-limit`, non-root, no host namespaces, no engine socket, KVM only by cgroup rule.
- Added: `--read-only` root with tmpfs `/home/runner`, `/tmp`, `/var/tmp`, and `/opt/hostedtoolcache` (only when no cache lane mounts it); `CheckRunArgs` now refuses a container without `--read-only` and any `seccomp=` option (default profile only).
- `docs/features/runners/spec.md` section 5.13: R5.68 (exact options) and R5.69 (table: what a job can reach: network, files, devices, privileges, other jobs). Test `TestJobReachListMatchesFlags` fails when a flag is not named in the spec.
- Not touched: `--cpus`/`--memory`/cpuset (HND17), mounts (HND9). R5.63 (network with no inter-container traffic) and R5.64 (SECURITY.md page) stay planned; the list lives in the runners spec as the task asked.
- Decision: no opt-out for the read-only root; a job writes to home or /tmp (tmpfs is memory-backed and bounded by the container memory limit, sizes 8g/2g/1g/4g).

## CRSP82 public repository stop (github-integration R5.47, R5.48)
- `repository` webhook, action `publicized` -> `repos.Service.Publicized` -> `StopServingPublic`: pool off, `RUNS_ON_*` set to hosted label, light runners and idle job runners removed (`runners.Service.RemoveRepositoryRunners`), audit `pool.off` with the reason. Every step is tried; errors joined; repeat is a no-op.
- Periodic check: the 10-minute installation reconcile stops a served repo that GitHub now reports public (only repos it just read; a failed listing changes nothing).
- App manifest subscribes to `repository`.
- Fork guard finished: a webhook job is `Partial` (event and fork flag unknown); demand gives it no runner until the poller read its run; a webhook never wipes what the poller read; demand never looks up a public repo.
- Not done (out of scope, many fixtures turn public repos on): refusing to turn the pool on for a public repository. A private repo's fork PRs can still be allowed by the owner's confirmed policy (R5.26); the task text says "never", I kept the owner opt-in. Owner decision needed.

## CRSP83 free-disk floor (runners R5.70)
- `runnercache.Floor` (bytes, 1 GiB resume margin). Gate pauses with `disk_low` before every job/VM start on any backend; running jobs continue.
- Setting: `disk_floor_gib` (config.toml, local agent) and `--disk-floor-gib` (agent run); default 10, negative off. Not in console/API.
- Volume read: the agent data folder.
- Doctor check `machine.floor.disk` (32 checks now) names what to clean.

## Checks
- `go test -race` on touched packages green; `GOOS=windows go vet ./...` and `go vet ./...` clean; gofmt clean.
- golangci-lint could not run here (binary built with Go 1.25, module targets 1.27.4). Docs scripts (`docs_check.py`, `docs_fold.py`) are not available in this sandbox; change notes were written by hand in the standard format.
- No e2e, no Docker, no mutation pass.
