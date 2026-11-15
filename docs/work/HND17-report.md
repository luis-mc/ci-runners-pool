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
