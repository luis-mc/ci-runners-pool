---
title: Parity plan with the old runner pool
type: explanation
---
# Parity plan with the old runner pool

Task CRSP39, 14 Nov 2026. This page says what the old dev-standards runner pool gives jobs today, where crsp stands on each, which releases close the gaps on the owner's Windows PC, and the one test that decides when crsp may tell dev-standards "crsp covers every private-repo job".

## 1. The rule

The owner's private repositories run only on the old pool. They never use GitHub-hosted runners. The old pool is deleted only when crsp can run every job those repositories run (crsp D37; dev-standards D311). Deleting it stays the owner's decision (dev-standards D299). This page only sets the condition and the road to it.

The machine is one Windows PC with WSL2, Docker Desktop and nested virtualization (KVM). The old pool and crsp run side by side on it until the end. crsp reuses nothing of the old pool (see the [handover](dev-standards-handover.md)).

Sources read: dev-standards `docs/features/runner-pool/spec.md` (R5.1 to R5.60), `claude/plugins/delivery/templates/runner-pool/**`, `scripts/delivery/ci_tool.py`, `rust_ci.py`, `vm_check.py`, `vm-images.json`, and the CI templates for TypeScript, Rust, Go and .NET (jobs, labels, variables).

## 2. Job kinds

The repository names are not in these docs. dev-standards does not name other projects, so the kinds come from its templates. `crsp doctor` (doctor R5.33) lists the kinds per repository.

| Kind | What the job does | Needs |
|---|---|---|
| J1 | TypeScript verify: lint, typecheck, unit (`pnpm` through corepack) | Linux, Node LTS, corepack, base tools, cache |
| J2 | Rust verify: clippy, check, unit, cargo-deny | Linux, rustup, `CARGO_TARGET_DIR`, Rust cache cap, `CI_TOOLS_DIR` |
| J3 | Go verify | Linux, base tools |
| J4 | .NET verify (`setup-dotnet`) | Linux, base tools, tool cache |
| J5 | Light jobs: decide, plan, prune, cleanup, publish, runners, smoke | Linux, `gh`, `python3`, `git`, light slots |
| J6 | Database integration (Postgres, per-worker databases, declared roles) | Linux, a Postgres per runner |
| J7 | Browser e2e with Playwright, also the nightly full run | Linux, browsers, a Postgres |
| J8 | Windows cross-build with `cargo xwin` (check, release) | Linux, LLVM, `clang-cl` |
| J9 | Windows installer (MSI) built on Linux | Linux, Wine, xvfb, dotnet, msitools |
| J10 | Linux packaging: deb, rpm, SELinux policy, repository metadata, shellcheck | Linux, packaging tools |
| J11 | VM check: boot a Fedora VM, SELinux Enforcing, no AVC denial | Linux, KVM, qemu, `vm_check` |
| J12 | Native Windows job: tests, installer, packaged smoke | Windows runner, symlink right, `RUSTUP_HOME`, `CARGO_HOME` |
| J13 | Queue behaviour: light and heavy classes, load limits, disk guard (a property, not a workflow) | Scheduler |

Jobs that only use GitHub (`actions/cache`, artifacts, `workflow_dispatch`, `schedule`) need nothing from the pool. They work on a stock runner.

## 3. Inventory: what the old pool gives, and where crsp stands

Status words: **Built** (code and tests exist), **Built in part** (what is built, then `Not yet:` what is not), **Specified** (a requirement exists, not built), **Missing** (there was no requirement; CRSP39 added the one named), **Not taken** (crsp does not do it, by decision). IDs are `<feature> R<n>`. Statuses were checked against the code and the tests on 15 Nov 2026 (CRSP66, main at RELEASE-8); a row says Built only when code and a named test exist.

| # | Capability | How the old pool provides it | Kinds | crsp status | IDs |
|---|---|---|---|---|---|
| 1 | One machine config, slots, one queue for every runner | `machine.json`, `runner_load_gate`, `runner_job_done` | all | Built (CRSP21) | scheduling R5.1 to R5.23, R5.31 to R5.39 |
| 2 | Ready PRs and default branch first | gate reads `GITHUB_EVENT_PATH` | all | Built | scheduling R5.7 to R5.11 |
| 3 | Light slots | `runner_gate.light_jobs` | J5 | Built | scheduling R5.24 |
| 4 | Heavy slot class | `heavy_jobs`, `heavy_slots` | J6, J7, J8 | Built | scheduling R5.25, R5.26 |
| 5 | Dead holder freed, stale slots, slot log, status | pids and ages | all | Built, with leases (handover lesson 4) | scheduling R5.31 to R5.39, R5.58 |
| 6 | Load limits 85% memory and 60% CPU, measured; WSL VM; Docker CLI first; cgroup | `load.py`, `host-load.json` | all | Built in the agent (CRSP21, CRSP50: the WSL VM and Docker read, median of 5 samples); not yet: the gate does not read the load of a container pool | machines R5.15 to R5.21; scheduling R5.40 to R5.46; scheduling R5.47 (M2) |
| 7 | Gate never blocks on a failure; a hook that cannot reach it is shown | fail open, DL351 | all | Built | scheduling R5.22, R5.23, R5.61; runners R5.40; doctor R5.29 |
| 8 | Disk guard | none until 14 Nov (320 GB cache) | J2, J8 | Built (CRSP21) | caches R5.38 |
| 9 | CPU count for jobs (`CI_MAX_PARALLEL`, cpuset) | `pool_supervisor.py` | J1 to J7 | Built in part (CRSP50): `CI_MAX_PARALLEL`; the cpuset waits for the container backend | machines R5.54; runners R5.53 (added) |
| 10 | Pool size set by the owner, checked against the budget, no accidental shrink | `pool-plan --pool-gib`, `--shrink` | all | Built in part (CRSP50): check, API, shrink confirm; the console form is open | machines R5.58 |
| 11 | Windows runner as a service with its own account, rights, symlink right, PowerShell hooks, execution policy, remove token, rerun, replace the old one | `win-*` steps | J12 | Built (CRSP22) | runners R5.5, R5.6, R5.13 to R5.20, R5.40 |
| 12 | `RUSTUP_HOME` and `CARGO_HOME` per Windows runner | runner `.env` | J2, J12 | Built (CRSP47): `RUSTUP_HOME` and `CARGO_HOME` in the `.env` of each persistent runner, on Windows and Linux | runners R5.56 |
| 13 | Linux job runners in a pool container, one per repository, non-root, no Docker socket, one cap | `pool_supervisor.py`, Docker | J1 to J11 | Built in part (CRSP52 backend and image; CRSP58: a queued job starts one ephemeral runner on a machine that allows the container backend; CRSP60 layers; CRSP63: the runner starts on a remote machine through the agent link and the agent reports its images; CRSP64: image files embedded in the binary, pool container limits, idle runners removed). Not yet: the pool start does not mount the cache lane or set the job environment (R5.53) | runners R5.27, R5.25, R5.26, R5.31; github R5.34, R5.37 |
| 14 | The container engine on this PC: Docker in WSL2 through the Windows CLI | Docker Desktop | J1 to J11 | Built in part (CRSP49 engine seam, Docker in WSL2 through the Windows CLI first; CRSP61: the agent names the engine, the doctor check `machine.engine`; CRSP63: the agent link carries the report and the doctor reads it) | runners R5.47; doctor R5.36 |
| 15 | `crsp` binary inside the job for `crsp vm`, `crsp db-env` | scripts in the image | J6, J11 | Built in part (CRSP49: `crsp` copied into the base image, `CrspMountArgs`, stubs; CRSP54: `crsp db-env`; CRSP61: `crsp vm list` and `crsp vm boot`). Not yet: the agent config sets no `CrspHostPath`, so the pool container is started without the mount; `crsp vm` has no `prepare`, `run`, `selinux`, `prune` | runners R5.48 |
| 16 | Routing: variables with the runner labels | `CI_RUNS_ON`, `CI_RUNS_ON_WINDOWS`, label `repo-<route>` | all | Built as `RUNS_ON_*` (CRSP22 and earlier); the old names `CI_RUNS_ON` and `CI_RUNS_ON_WINDOWS` Built (CRSP47, setting `legacy_vars`). CRSP58: a queued job whose `runs-on` labels (`self-hosted`, `linux`, architecture, `docker`, pool name) a container runner honours is matched to a machine and gets a runner | github R5.27 to R5.30, R5.37; github R5.39 |
| 17 | One registry of all runners, status, doctor compares with GitHub | `agents.json`, `pool_status.py` | all | Built | runners R5.2, R5.5; doctor R5.11, R5.12 |
| 18 | Runner version pinned with SHA-256 | `RUNNER_SHA256` | all | Built | runners R5.37 |
| 19 | Runner auto-update with drain | `pool-refresh` | all | Built in part (CRSP59): controller drain, update, truthful result, setting. Not yet: the agent message that swaps the runner files | runners R5.38 |
| 20 | Never cut a running job: drain, check right before the swap | drain handshake | all | Built (runners: drain and idle check right before the swap, CRSP22 and CRSP59; image swap: CRSP52, `TestRefreshNeverCutsARunningJob`) | runners R6.4; machines R5.30 to R5.33; runners R5.35 |
| 21 | Base image like a hosted runner: git, curl, jq, zip, build-essential, libatomic, psql client, `gh`, python3 | Dockerfile | J1 to J11 | Built in part (CRSP49: `images/linux-base/Dockerfile` with git, curl, jq, zip, unzip, build-essential, libatomic, psql client, `gh`, python3, built in CI with a tool self-check). Not yet: the Actions runner and its pinned download are not in the image (runners open question 10) | runners R5.49 |
| 22 | Node LTS with corepack, `pnpm` shim | Dockerfile (DL215, DL220, DL223) | J1, J7 | Built (CRSP49): Node LTS first on `PATH`, corepack from a pinned hash-checked tarball, `corepack enable` at build, the `pnpm` and `yarn` shims; checked in the image self-check | runners R5.49 |
| 23 | LLVM, `clang-cl`, `lld-link`, `llvm-lib` | Dockerfile base | J8 | Built (CRSP56, finished CRSP60): the `llvm` layer with LLVM 20.1.8, `clang-cl`, `lld-link`, `llvm-lib`, hash checked, self-check, built in CI. amd64 only (runners open question 28). The Windows symlink right is not built | runners R5.43 |
| 24 | Playwright browsers and system libraries | `POOL_BROWSERS` | J7 | Built (CRSP55): the `browsers` layer with a pinned Playwright, never lowered by a rebuild, `PLAYWRIGHT_BROWSERS_PATH` value in `runnercache` (CRSP55). Not yet: the pool start does not set the variable for a job | runners R5.44; caches R5.41 |
| 25 | `windows-packaging` layer: dotnet 8, wine, xvfb, xauth, msitools | `POOL_LAYERS` | J9 | Built (pinned by line; exact pins open, runners open question 38) | runners R5.42, R5.50 |
| 26 | Wine prefix per agent, made once, `TMPDIR` unset, `POOL_WINE_PREFIX` | supervisor | J9 | Built in part (CRSP56: prefix per runner and lane prefix, `PrepareWinePrefix`, `WINEPREFIX` and `POOL_WINE_PREFIX`, `TMPDIR` unset; CRSP66: the Wine-line stamp, rebuild only when the line changes, only with the `windows-packaging` layer, the lane prefix and the job environment). Not yet: the pool start does not call `EnsureWinePrefix` before the first job of a lane | runners R5.42, R5.52 |
| 27 | `linux-packaging` layer | `POOL_LAYERS` | J10 | Built (no AppImage tool, runners open question 39) | runners R5.50 |
| 28 | `kvm` layer, the device, the group, the `kvm` label | `POOL_KVM`, `compose.kvm.yaml` | J11 | Built in part (CRSP56: the `kvm` layer, the device without `--privileged`, the label only with a usable device, bounded wait, loader in `compose.kvm.yaml`; CRSP61: doctor checks `kvm.host`, `kvm.container`, `kvm.label`, `kvm.module`). Not yet: the agent config never sets `KVM`, so no container gets the device, and the doctor checks are not fed by the agent link | runners R5.41, R5.50 |
| 29 | Extra distribution packages per pool | `.delivery/pool.apt` | any | Built as the last layer and in the image key (CRSP56, CRSP60). Not yet: the pool setting that stores the list | runners R5.51 |
| 30 | Image layers merged across repositories, `--drop-layer`, Playwright never lowered | `pool-refresh` | n/a | Not needed: a crsp pool is per repository and an image is keyed by its layers | runners R5.33 |
| 31 | Build aside, drain, swap, truthful result, wrong runner hash fixed | `pool-refresh` | all | Built (CRSP52 build aside, drain, swap; CRSP59 one re-download on a wrong hash) | runners R5.33, R5.35, R5.37 |
| 32 | Agent user id clashes | `pool_supervisor.py` (DL284) | all | Not needed: the job user is fixed in the image | runners R5.49 |
| 33 | Image checks in the doctor: tools found, image current, tool cache writable | `pool.<name>.*` | all | Built (CRSP53, CRSP61: `container.*` checks, `machine.engine`); not registered in the live doctor, because no agent reports its pool yet | doctor R5.31 |
| 34 | Postgres 16 per pool, a login and a database per agent, random password | `pool_agents.py` | J6, J7 | Built in part (CRSP54: Postgres 16 through the engine seam, a login and a database per runner, random password in the OS secret store, no published port, removed with the runner). Not yet: nothing starts the server for a real pool | runners R5.45 |
| 35 | `db.env` and the `pool-db-env` step, `CREATEDB` opt-in, declared `NOLOGIN` roles | `pool-add-agent --db-role` | J6, J7 | Built in part (CRSP54: `crsp db-env` masks secrets and appends to `GITHUB_ENV`; `CREATEDB` opt-in; declared `NOLOGIN` roles; a rerun keeps the password). Not yet: nothing writes `db.env` into a runner folder or runs the step | runners R5.54 |
| 36 | Per-runner tool cache and Rust cache with quotas and eviction | `/ci-tools`, `cache-sweep` | J1, J2, J8 | Built for persistent runners (CRSP21, CRSP26); pool-wide budget and size alert Built (CRSP48); container form Built (CRSP53: lanes, mounts, quotas). Not yet: the agent does not take a lane when it starts a container | caches R5.36 to R5.39; caches R5.48, R5.49; caches R5.43 |
| 37 | Shared-cache mode for a folder many users write | `ci_tool.py` (DL194) | J2 | Built for the cache part (CRSP53); scope set by D308 | caches R5.18 to R5.20; caches R5.44 |
| 38 | Rust cache cap: key in use kept, newest other key, `incremental/` first | `rust_ci.py` (DL342) | J2, J8 | Built (CRSP48), with a cap per cache key | caches R5.37; caches R5.45 |
| 39 | `vm_check.py` and `vm-images.json` | `scripts/delivery` | J11 | Data and checks Built (CRSP26); `crsp vm list` and `crsp vm boot` Built (CRSP61: sha-checked download, QEMU+KVM, serial readiness line); `prepare` (image), `run` over ssh with a per-run key and cloud-init seed, `selinux` Built (CRSP65). `prune`, the prepared base disk with a run overlay on it, the shared VM cache (lock, size cap, leases) and the memory warning Built (CRSP71). Not yet: `doctor`, packages in the base disk, snapshots and `--resume`, the root owner and `kvm` group of the folder (caches open questions 19, 20) | caches R5.40; caches R5.46, R5.47; runners R5.55 |
| 40 | Pinned downloads and unpack (`ci_tool.py`, `tools.json`) | delivery scripts | J1 to J4 | Not taken: they stay in delivery (D308) | caches R5.44 |
| 41 | KVM on WSL2: load the module, check `nestedVirtualization` | `kvm-autoload` (DL343) | J11 | Built in part (CRSP56: `.wslconfig` parse, load plan, loader module by CPU, loader service in compose; CRSP61: `agent.ReadWSLKVM`, doctor checks `kvm.wslconfig` and `kvm.module`; CRSP63: fed by the agent's machine report over the link and registered in the live doctor). Not yet: checked on a real machine | machines R5.53; doctor R5.32 |
| 42 | WSL memory and CPU sizing from `.wslconfig` | `pool-plan` | all | Built in part (CRSP50): `.wslconfig` read into facts | machines R5.54 |
| 43 | `runs-on` and variable checks, hook checks | doctor | all | Built | doctor R5.14, R5.17 to R5.19, R5.29 |
| 44 | Cache over quota, low cache disk | `cache-cap`, `cache-disk` | J2 | Built (CRSP48) | doctor R5.34 |
| 45 | Which jobs of a repository the pool can run | none | all | Built in part (CRSP47: `repo.coverage`, a static capability table per release, `covered`, `missing: <capability>` or `not checked`). Not yet: it does not look at the runners that are online (doctor open question 0); the table is not extended for each release | doctor R5.33 |
| 46 | Local heavy-work guard, cloud CI session limit, `ci-wait` marker and fallback | delivery | n/a | Not taken (D301) | handover |
| 47 | Verify workflow `pool-check.yml` | a manual run | n/a | `pool-check.yml` replaced by `crsp doctor` (Built CRSP23, without `--local`). The parity workflow `parity.yml` is not built (v0.7.0) | doctor R5.21 |
| 48 | Actions cache server, git mirror, registry mirror | not in the old pool | n/a | Not needed for parity; jobs use GitHub's cache | caches R5.1 to R5.13 (M7) |

### What is left

Checked on 15 Nov 2026 (CRSP71). Only real gaps are listed; each names the rows.

1. **The pool start does not use what is built (rows 13, 15, 24, 26, 28, 34, 35, 36).** `container.Backend.Start` makes the pool container and the runner, but nothing yet mounts the cache lane, sets the job environment (runners R5.53), calls `EnsureWinePrefix`, sets `CrspHostPath` (the `crsp` mount) or `KVM` in the config, starts Postgres and writes `db.env`, or sets `PLAYWRIGHT_BROWSERS_PATH`. The library code and its tests exist for each; the one place that joins them does not.
2. **The agent link (rows 13, 14, 33, 41).** Built by CRSP63: runner commands and the machine report (engine, KVM, images) go over the link and feed the doctor. Not yet: draining one runner alone (runners open question 41) and a check on a real remote machine.
3. **The image is not complete (rows 21, 29).** The Actions runner is not in the base image (runners open question 10). The image files are embedded in the binary (CRSP64) and the extra packages layer is built (CRSP60), but the pool setting for extra packages does not exist yet.
4. **Runner update (row 19).** The agent message that swaps the runner files is not built.
5. **Machine sizing (rows 9, 10).** The cpuset waits for the container backend; the console form for the pool size is open.
6. **`crsp vm` (row 39).** `prepare`, `run` over ssh and `selinux` are built (CRSP65). `prune`, the base disk, the shared VM cache and the memory warning are built (CRSP71). Not yet: `doctor`, packages in the base disk, snapshots and `--resume` (caches R5.46, open question 19), and the owner and group of a machine-wide cache folder (open question 20).
7. **Pins and tools (rows 23, 25, 27).** LLVM is amd64 only, Wine and dotnet are pinned by line and not by version (runners open questions 28, 31, 38), there is no AppImage tool (open question 39), and the Windows symlink right is not built.
8. **Coverage and the parity gate (rows 45, 47).** The coverage table does not look at online runners and is not extended each release; `parity.yml`, the soak and the move runbook (v0.7.0) do not exist.

## 4. Releases on this PC

v0.1.0 is milestone 1 (persistent runners). Each release below ends with the real run of its job kinds on the PC (the milestone rule). The order follows how many repositories each step frees and how risky it is: Windows first (already built), plain Linux jobs next, then database and browsers, then packaging, then KVM last because only a few jobs need it.

**Estimate.** An agent-hour is one Sonnet agent at medium effort for one hour, with tests and the spec update. Size of a requirement: small 1.5, medium 3, large 6, extra large 10. Each release adds 20% for review and fixes and one real run on the PC. The estimates are work, not calendar time. The orchestrator sets clock times when it launches each release. The remaining milestone 1 work (store and agent adapters, redactor, auto-update) is not in these numbers except where named.

| Release | Name | Scope (IDs) | Unlocks | Agent-hours |
|---|---|---|---|---|
| v0.1.0 | Persistent runners (milestone 1) | runners R5.13 to R5.20; scheduling R5.1 to R5.39; caches R5.36 to R5.40 | Nothing moves yet: a Windows runner still lacks its tool homes (runners R5.56). | built |
| v0.2.0 | Windows jobs complete | runners R5.56, R5.11 (log redactor, private logs); caches R5.45; github R5.39; doctor R5.33 (first version) | **J12.** Windows jobs of any repository can move. Rust cache cap holds. | 17 |
| v0.3.0 | Linux containers in WSL2 | runners R5.27, R5.25, R5.26, R5.31 to R5.33, R5.35, R5.47 to R5.49, R5.53; github R5.34; caches R5.43, R5.44; machines R5.54, R5.58; scheduling R5.47, R5.50; doctor R5.31, R5.34 | **J1, J2, J3, J4, J5, J13.** Verify and housekeeping jobs of every repository without a database, browser, packaging or VM job. | 83 |
| v0.4.0 | Database and browsers | runners R5.45, R5.54, R5.44; caches R5.41; doctor R5.33 (extended) | **J6, J7.** Integration and e2e jobs, nightly full runs. | 28 |
| v0.5.0 | Windows builds and packaging | runners R5.43, R5.42, R5.50 (`windows-packaging`, `linux-packaging`, `llvm`), R5.51, R5.52; doctor R5.33 (extended) | **J8, J9, J10.** | 30 |
| v0.6.0 | KVM and VM checks | machines R5.53; runners R5.41, R5.50 (`kvm`), R5.55; caches R5.46, R5.47; doctor R5.32 | **J11.** | 38 |
| v0.7.0 | Parity gate | the parity workflow for every kind, the last gaps from the soak, the move runbook | Nothing new. Proves the others together. | 37 |
| | Total from v0.2.0 | | | 233 |

How each estimate adds up (before the 20%; the sum times 1.2, rounded):

- **v0.2.0 (14):** tool homes 1.5, legacy variable names 1.5, log redactor 3, Rust cap details 3, first coverage check 3, the real Windows run 2.
- **v0.3.0 (69.5):** container backend 10, JIT and clean-up 6 (runners R5.25, R5.26) and github R5.34 3, best-backend order 1, engine in WSL2 3, crsp in the job 1.5, base image and its CI build 6, layers machinery and image key 6 (R5.32, R5.33), rebuild with drain 3 (R5.35), job environment 1.5, cache lanes 6, caches scope 0, WSL VM load read 3, ephemeral slot 3, WSL sizing 3, pool size 3, container checks 3, cache checks 1.5, the real run and fixes 6.
- **v0.4.0 (23.5):** Postgres server and roles 12 (R5.45 and R5.54), Playwright layer and path 6, doctor 1.5, real runs of J6 and J7 4.
- **v0.5.0 (25):** LLVM 3, Wine 3, prefix 3, two packaging layers 6, extra packages 1.5, doctor 1.5, real runs of J8, J9, J10 7.
- **v0.6.0 (32):** KVM on WSL2 6, KVM label and device 3, `kvm` layer 1.5, `crsp vm` 10, VM cache 3, memory warning 1.5, doctor 3, the real run with a WSL restart 4.
- **v0.7.0 (30.5):** the harness 3, 13 fixtures at 1 each, final coverage report 3, soak fixes 10, runbook 1.5.

Reading the table: the first repositories can move after v0.2.0 (Windows jobs), about 17 agent-hours from the start of this plan. A repository with only verify jobs moves after v0.3.0. The last move needs v0.6.0 and then the 7-day soak.

Not in the plan, because parity does not need it: own container engine (rootless Podman in a crsp WSL2 distro, runners R5.47 keeps the seam), the cache server, the git mirror, the registry mirror (milestone 7), macOS, Hyper-V and microVMs.

## 5. Move order, repository by repository

A repository moves one operating system at a time, because it has one variable per OS (`CI_RUNS_ON` and `CI_RUNS_ON_WINDOWS` today). It moves when `crsp doctor` says `covered` for every job of that OS (doctor R5.33). The old pool keeps the repositories that are not covered yet.

| Wave | After | Repositories with only these kinds | Examples |
|---|---|---|---|
| 0 | v0.3.0 | This repository's own CI (the milestone 2 rule) | canary for J1 to J5 |
| 1 | v0.2.0 | Windows jobs of any repository (J12) | one repository first, then the rest |
| 2 | v0.3.0 | J1 to J5 only | libraries, tools, anything without a database or browser |
| 3 | v0.4.0 | J1 to J7 | web apps with integration and e2e jobs |
| 4 | v0.5.0 | adds J8, J9 or J10 | Rust and desktop repositories with installers |
| 5 | v0.6.0 | adds J11 | repositories with SELinux or distro VM checks |

The owner fills the repository names by running the coverage check on the PC. Inside a wave, move the repository with the fewest jobs first, and one repository at a time: wait for one full CI run of a pull request and one run on the default branch before the next.

The steps for one repository and one OS:

1. `crsp doctor` shows `covered`.
2. Turn the pool on for the repository in the console. crsp installs its runners and writes `RUNS_ON_<OS>`. With `legacy_vars` on it also writes `CI_RUNS_ON` or `CI_RUNS_ON_WINDOWS` (github R5.39), so the old templates follow.
3. Do not run the old pool's setup for this repository again. Leave its old runner registered and idle for 7 days. That is the way back: set the old labels in the variable again.
4. Run the repository's CI on a pull request and on the default branch. Compare the job times with the last runs on the old pool.
5. Lower `ci_slots` of the old pool by what moved, so the two pools do not double the slots on one PC. The load gate of both pools measures the whole PC, so memory and CPU stay safe in the meantime.
6. After 7 green days the repository is done. The old runner is removed with the old pool, by the owner.

## 6. The parity test

crsp tells dev-standards "crsp covers every private-repo job" only when all of these hold on the same crsp release **V** on the owner's PC. V is v0.7.0 or later.

| # | Condition | How it is proven |
|---|---|---|
| P1 | V runs on the PC (controller and agent) for 7 days in a row. | The release version in `crsp machines show`, and the uptime in the console. |
| P2 | Every kind J1 to J13 has a green fixture job in the workflow `parity.yml` of this repository, run on crsp runners of the PC at V, in one run. The run is green twice, on two days. | The two run URLs. |
| P3 | For every private repository and every kind it uses, the repository's own job of that kind ran green on crsp in the last 7 days. | The doctor's coverage list with one run URL per repository and kind. |
| P4 | No `missing` and no `not checked` row in the coverage list of any private repository. | `crsp doctor --check coverage --json`. |
| P5 | No private repository's job ran on an old-pool runner in the last 7 days. The variables of every private repository hold crsp labels. | The runner list of each repository on GitHub, and the variables. |
| P6 | In the same 7 days no job failed because of crsp: a gate timeout, an out-of-memory kill, a disk guard hold that timed out, a runner offline, a tool missing in an image. And `crsp doctor` has no `fail` and no `warn` older than one day. | The job list (`crsp job list`), the doctor history. |
| P7 | Recovery with no manual step: after `wsl --shutdown` and a Windows restart, in 15 minutes the runners are online, `/dev/kvm` is back and the J11 fixture is green. | One rehearsal, logged. |
| P8 | Never cut a job: an image swap and an agent update, each while a job runs, end with that job green. | One rehearsal of each, logged. |
| P9 | The 14 Nov failure cannot repeat: a Rust build forced over its quota ends under the quota and the disk keeps more than 10% free. | One rehearsal, logged. |
| P10 | Way back: for each wave the owner switched one repository back to the old labels by the variable alone, and it ran. | One rehearsal per wave. |

What each kind needs as proof. A kind is proven only with both columns.

| Kind | Fixture job in `parity.yml` (runs on crsp) | Real run (a private repository, on crsp) |
|---|---|---|
| J1 | Install with `pnpm` through corepack, lint, typecheck, unit on a small fixture project. | A pull request run of a TypeScript repository. |
| J2 | `cargo clippy`, `check`, `test`, `cargo-deny` on a fixture crate, twice, to show the cache is reused and the cap holds. | A pull request run of a Rust repository. |
| J3 | `go vet` and `go test` on a fixture module. | A Go repository's run, if one exists. |
| J4 | `setup-dotnet`, `dotnet build`, `dotnet test` on a fixture solution. | A .NET repository's run, if one exists. |
| J5 | `gh api`, `git`, `python3` steps as a light job; it takes a light slot while heavy jobs hold the others. | A `decide` or `plan` job of any repository. |
| J6 | Create the databases of 4 workers from a template, run SQL as the login, use a declared `NOLOGIN` role. | An integration job of a repository with a database. |
| J7 | `playwright test` with Chromium on a fixture page, 2 shards. | An e2e job, and one nightly full run. |
| J8 | `cargo xwin build --release --target x86_64-pc-windows-msvc` on a fixture crate with C code. | A package or `xwin` job of a Rust repository. |
| J9 | Build an MSI from a fixture `.wxs` with Wine, xvfb and msitools and check it. | The `msi` job of a repository that builds installers. |
| J10 | Build a deb, an rpm and an SELinux module from fixtures, make repository metadata, run shellcheck. | A packaging job of a repository that ships Linux packages. |
| J11 | `crsp vm selinux --distro fedora-45` with a fixture rpm and module, with `--resume`; Enforcing, 0 AVC. | The VM job of a repository that has one. |
| J12 | On the Windows runner: a Rust test, a symlink creation, an MSI build, the packaged smoke. | The Windows job of a repository. |
| J13 | 4 light and 3 heavy jobs started together: heavy jobs run one at a time, light jobs never wait behind them, and the gate holds a job when the load is over budget. | The slot log of a busy day (`crsp slots`). |

When P1 to P10 hold, the orchestrator sends this message to the dev-standards session, once, and records it in the change note of the release:

> crsp covers every private-repo job. Version V, commit SHA, date. Kinds J1 to J13 are proven (fixture run URLs and one real run URL per repository and kind). The old pool has had no job for 7 days. Deleting it is your owner's decision (D299). Rollback per repository is one variable.

If a kind is added later (a repository gets a new job type), the coverage list shows `missing` and the message is withdrawn until P3 and P4 hold again.

## 7. Transition rules while both pools run

- The two pools share one Docker VM and one budget. crsp names its containers with the prefix `crsp-` and never stops, restarts or removes anything else (handover; the old pool's own rule).
- crsp writes no variable for a repository that is not turned on in it. The old pool's setup must not run for a repository that has moved, or it writes the old labels back. The old doctor warns when a variable differs.
- Webhooks cannot reach a PC with no public address, so crsp uses the REST poll for demand (github R5.37). A container job then starts a few seconds later than on the old pool. The target of runners R6.5 (15 s) is measured in v0.3.0.
- `runners` R6.1 forbids privileged containers. The one-shot helper that loads the KVM module (machines R5.53) is not a runner. v0.6.0 makes that clear in the wording of R6.1.
- Software that the Windows host must have (MSVC build tools, WiX, rustup) is the owner's, as on the old pool. J12 is the check that it is there.

## 8. Open questions

1. Docker first, own Podman distro later (this plan), or the other way round? The plan keeps the seam either way.
2. May github R5.39 write the old variable names during the move? Without it the owner sets two variables by hand per repository.
3. Is a 7-day soak right (P1, P3, P5, P6)?
4. The old pool's slots (`ci_slots`) are lowered by hand as repositories move (step 5). Acceptable?
