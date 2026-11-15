# HND17 report: cpuset and memory cap for container jobs

Branch HND17-cpuset-memcap. Status: in progress.

## Plan
- `internal/backend/container/cpuset.go`: `CPUAllocator` (budget of CPU ids, non-overlapping sets, release, adopt), `ResourceArgs` (`--memory`, `--memory-swap` equal, `--cpuset-cpus`).
- `RunArgs` uses them; `Backend` allocates when it creates a pool container, releases when the container is removed or gone, adopts sets of live containers on recovery.
- Unit of allocation: the pool container (docker flags are set at `docker run`; runners of one repository share it).
- Spec: machines R5.54 (cpuset and memory cap built); next free ID is not needed, R5.54 is the owner. Change note HND17.
- Out of scope: exit 137 naming (HND10).

## Log
- Started from origin/main 40f779d (local main was stale; fetched).
- Built: cpuset.go (allocator, ResourceArgs, pin/unpin, RecoverCPUSets), RunArgs flags, wiring in ensurePool, swap, CleanUp. Spec R5.54 and change note HND17 written.
- Checks: go test -race ./internal/backend/... green; GOOS=windows go vet ./... run.
- Not run: golangci-lint (installed build is go1.25, repo needs 1.27.4), docs_check.py (luismc-docs plugin not on this machine).
- Open points for the owner:
  - Unit is the pool container (one per repository), not each runner: the docker flags are set at `docker run`.
  - Each pool container's CPU limit is the whole pool size today (`PoolCPUs`), so with CPUBudget = pool size a second repository's pool is refused. A per-pool share of the budget is needed before several repositories run at once.
  - `RecoverCPUSets` is not yet called at agent start (wiring in registry/agent is outside this task's files).
  - Default CPUBudget = 60% of NumCPU.
