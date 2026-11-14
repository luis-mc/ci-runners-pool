---
title: Handover from the dev-standards runner pool
type: explanation
---
# Handover from the dev-standards runner pool

This page records what crsp takes over from the runner pool in the dev-standards `luismc-delivery` plugin (see [ADR 0005](decisions/0005-product-boundary.md)), the contract between the two projects after the move, and the lessons from that pool. The dev-standards owner decided these points on 14 Nov 2026 (dev-standards decisions D299 to D305).

## 1. What changes and when

- dev-standards removes its pool, and deletes the runners on its owner's PC, only when the owner says so (D299). There is no automatic trigger.
- Until crsp has Linux containers (M2), Linux jobs of the projects on that PC run on GitHub-hosted runners.
- crsp then creates its pool from nothing. It reuses no state, folder, account or volume of the old pool.

## 2. The contract

dev-standards stops knowing about pools. These are the only shared items.

| Item | Written by | Read by | Shape |
|---|---|---|---|
| Repository variables `RUNS_ON_LINUX`, `RUNS_ON_WINDOWS`, `RUNS_ON_MACOS` | crsp (or the owner by hand) | delivery workflow templates, in `runs-on:` | JSON label list, for example `["self-hosted","linux","x64","pool-main"]`. Unset or empty means GitHub-hosted. |
| Runner environment value `CI_TOOLS_DIR` | crsp, on its runners, with a per-runner quota | delivery `ci_tool.py` (pinned downloads) and `rust_ci.py` (`CARGO_TARGET_DIR`) | An absolute folder the job may write. |
| Job class (light, normal, heavy) | crsp, from its own per-repo config | crsp hooks only | Delivery declares nothing; template job keys stay stable so crsp can match them. |

The delivery template line is:

```yaml
runs-on: ${{ fromJSON(vars.RUNS_ON_LINUX || '"ubuntu-latest"') }}
```

### How crsp fills the variables

1. The admin turns the pool on for a repository.
2. For each OS where that repository has at least one online runner, crsp writes `RUNS_ON_<OS>` with the labels that route to its runners: `self-hosted`, the OS, the architecture, the pool name, and only capability labels the agent has verified.
3. For an OS with no runner, crsp deletes that variable, so those jobs use GitHub-hosted runners.
4. When the admin turns the pool off for a repository, crsp deletes all three.
5. Every 10 minutes crsp restores a changed value; the hourly check reports workflows whose `runs-on` does not use the variables.

This replaces the `CRSP_RUNS_ON_*` names in the specs today.

### What moves into crsp (D302)

- `vm_check.py` and `vm-images.json`: boot test VMs on `kvm` runners.
- The Rust build-cache cap and the shared tool-cache mode: per-runner cache quotas and eviction belong to the pool.
- The pinned download and build logic of `ci_tool.py` and `rust_ci.py` stay in delivery, because projects also run them on GitHub-hosted runners (the dev-standards owner is asked to confirm this scope).

### What crsp does not take

- The Claude Code local heavy-work guard stays in delivery (D301).
- The cloud CI fallback's slot-wait trigger is removed (D301); crsp needs no `ci-wait` markers.

## 3. Lessons to build in from the start

Each item is a mistake the dev-standards pool made and then patched.

1. **Disk is a resource.** One persistent runner's Rust cache reached 320 GB, filled the system drive and stopped every runner (14 Nov). Per-runner cache quotas with eviction, and a disk guard in the gate, belong in the first release that has persistent runners.
2. **One registry for every OS**: os, kind, repo, route, account, labels, size class. Windows services were added late and in steps.
3. **Route separate from the runner name.** Tying routing to the agent slug broke a second runner for the same repository.
4. **Leases and heartbeats, never process ids**, for slots and queue tickets. A cancelled Windows job blocked the queue for 120 minutes because a pid check only works on one host. Keep a fixed lock order when a job takes two slot kinds.
5. **Declared job classes with weights.** Matching job names by pattern was fragile, and a job-level env value never reaches the job-started hook.
6. **Hooks without runtime dependencies**, tested as the service account on the real OS. PowerShell execution policy broke every Windows job twice; a per-user Python path broke the gate for service accounts.
7. **Hooks never fail silently.** If the gate cannot run, the job may go on, but the job log, the controller and the doctor all say so.
8. **Declared sizing, validated, never measured live.** Live sizing gave 12, 2.5 and 6.5 GiB within minutes on the same PC. Export the CPU limit to jobs and split it per runner; a container CPU limit alone left `nproc` at 20 and test runners were OOM-killed.
9. **Desired state with a plan and a diff.** Setup, apply and doctor share one code path. A refresh driven by the calling repository dropped other repositories' image layers.
10. **Zero-cut upgrades.** Build aside, drain through a versioned agent protocol, re-check, swap. One drain timeout value; after it, keep waiting and warn. A rebuild once cut a running job, and the first drain needed a force because the old supervisor had no drain mode.
11. **Images as declared capability layers** with a self-check and an image build in CI before release. Missing LLVM, Node, corepack, Playwright and Wine pieces were each found by a project's failing job.
12. **Identities in persistent storage with a reserved uid/gid range.** A package took two agent users' ids; users vanished when the container was recreated.
13. **KVM on WSL2**: after `wsl --shutdown`, `/dev/kvm` is gone until `kvm_intel` or `kvm_amd` is loaded in the WSL VM; `nestedVirtualization=true` must be in `.wslconfig`. Privilege stays in a one-shot helper; runners are never privileged.
14. **Mount folders, not single files**; compare labels without case.
15. **Truthful results.** Exit non-zero when an action was refused; say "unchanged" when nothing changed; attribute exit 137 to the memory cap that caused it.
16. **Observability in the first release**: status, and a structured event log of slot waits, drains and OOM kills.

## 4. Capabilities projects use today

These run on the old pool and have no crsp requirement yet: Linux containers with KVM; a Wine prefix per runner with `TMPDIR` unset; LLVM and clang-cl for cargo-xwin, plus the symlink right on Windows; Playwright browsers in the image; a Postgres per runner with its own roles; WSL memory sizing. Until crsp has them, those jobs use GitHub-hosted runners.
