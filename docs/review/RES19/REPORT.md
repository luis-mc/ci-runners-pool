# RES19: Images and caches, research and proposal

A study. No product change merges from this branch. The interactive build is in `app/` (serve with `python3 -m http.server` from `docs/review/RES19`, open `app/`). Screenshots are in `shots/`, listed in `index.html`.

Base: `CRSP184b-integration` (RELEASE-41), because `origin/main` did not yet show a RELEASE-41 commit when this ran (19 Nov 2026).

## 1. What the owner asked

1. Analyse every feature that **Shared Pool, Images and caches** needs to create and manage images and caches.
2. (a) crsp sets up and manages different base images for kinds of projects, jobs and runs. The best image is used and caches are made and reused correctly.
3. (b) crsp scans repositories to learn the whole stack: languages, package managers, toolchains, databases and other services. It sets up the right thing and shows what it found. The owner's example is the dev-standards pool: compose group `pool-main` with `pool-1` = `luismc-runner-pool:main`, `kvm-loader-1` = `alpine`, `db-1` = `postgres:16`. That is one runner plus service containers.
4. (c) Research best practice and the best features of similar products. Add any useful new feature.
5. (d) A report and an interactive page with the UX proposals.
6. Also: today the console shows no build status. The images API always says `not_built`. The machine builds `crsp-pool:<key>` silently on the first runner start. The owner wants to see when images build, with status and progress.
7. Also: prebuilt images from a registry, as an option, with trade-offs.

Product model kept: the **pool is configured first** (machines, runners). Repositories **opt in**. The user never picks a repository for a runner. The web app does everything; no terminal steps.

## 2. Today in crsp

| Topic | What exists | Where |
|---|---|---|
| One image per machine and OS | Id `img_<machine>_<os>`. Linux only. A machine that can run containers (Docker or Podman present and usable) gets one. | `internal/api/handlers_images.go` `imageID`, `canRunContainers` |
| Build status | **Always `not_built`.** The comment says "open question 20". The contract already has `ready`, `rebuilding`, `failed`, `not_built`, but nothing sets them. `RebuildImage` answers 409 "not built yet". | `handlers_images.go` `buildImage`, `RebuildImage`; `internal/api/gen` `ImageState*` |
| Where the build starts | The first ephemeral container runner on a machine. `LocalAgent.AddRunner` calls `PrepareImage` when the spec has no image. | `internal/runners/localagent.go` |
| How it builds | `PrepareImage` checks `docker image inspect crsp-pool:<key>`; if absent it runs **one** `docker build` through `step()`. Dockerfiles come from the binary (`images.FS`) and are staged to a temp folder. | `internal/backend/container/images.go`, `container.go` `step`, `images/embed.go` |
| What the user sees | **Nothing.** `step()` runs the command to the end and keeps stderr only for a failure. The only log lines are "building image K with layers [..]" and a failure. No progress, no step, no time left. | `container.go:253` |
| Time | CRSP184 raised the base image CI job limit to 35 min: "amd64 builds every layer in 15 to 18 min". So the first runner on a machine waits that long with no word. | commit `56edc0f` |
| Image key | `sha256(base, layers, pins, extras)[:12]`. Layers sorted, so order does not matter. A machine builds each key once. | `internal/runners/images.go` `ImageKey` |
| Layers | `browsers`, `llvm`, `windows-packaging`, `linux-packaging`, `kvm`, and the last layer `extra-packages`. Each has a title, a purpose, job labels that ask for it. | `internal/runners/layers.go`, `images/layers/*` |
| Base image | Ubuntu 24.04 pinned by digest, Node LTS, corepack, `gh`, the Actions runner, `postgresql-client`. Every download is pinned and SHA-256 checked. | `images/linux-base/Dockerfile`, `internal/runners/pins.json` |
| Which layers a machine uses | Chosen per machine and OS in settings. Repositories show "needed by" through their labels. A repository may add extra packages. | `internal/settings/layers.go`, `neededBy`, R5.32, R5.51 |
| Reuse and prune | Keep the newest 3 per OS (`DefaultKeepImages`); never delete an image a pool container uses. A rebuild builds aside, drains, then switches. | `images.go` `PruneImages`, `Backend.Refresh`, R5.33, R5.35 |
| Service containers | **None.** The base has a Postgres *client*. A machine may offer a Postgres *server* with a role per runner (R5.45). `crsp db-env` and `crsp vm` exist. No `services:` support, no compose group. | `internal/runners/postgres.go`, R5.45 |
| Docker socket | Never mounted into jobs (R6.1). So a workflow's `services:` or `container:` cannot work by the runner talking to Docker. crsp must start sidecars itself. | runners R5.48, R6.1 |
| Caches built | Per-runner tool cache and Rust build cache with quotas (20 and 40 GiB), oldest-first eviction between jobs, disk guard, list and wipe on the console. | `internal/runnercache/*`, caches R5.36 to R5.42 |
| Caches only specified | Actions cache server, git mirror, registry mirror, warmth, per-tool caches (npm, pnpm, Go, Gradle, pip). Caches spec section 11: "NOT YET IMPLEMENTED". Build-system caches (sccache) are a non-goal today. | `docs/features/caches/spec.md` |
| Console | Images tab: one row per machine, layers checklist on the image page, "Save and rebuild". Caches tab: one card per runner cache with Wipe. | `apps/web/src/screens/images/*` |
| Repository scan | **None.** The App already has `Contents: read`, and the controller already reads a workflow file once per head commit for the job graph (R5.98), keeping only job names and `needs`. | github-integration spec, runners R5.98 |

## 3. Research findings

Sources fetched from GitHub (`raw.githubusercontent.com`) on 19 Nov 2026 are marked **[read]**. The sandbox could not reach other sites (`docs.github.com`, GitLab, CircleCI, Depot and so on were blocked by the proxy). Those points are **[memory]**: from what I know, not re-checked today. Treat them as leads to verify.

### 3.1 Hosted runner images and the runner ecosystem

- **GitHub-hosted runner images** [read: [actions/runner-images, Ubuntu 24.04 readme](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)]. A fixed, weekly-versioned image (`20261111.370.1`) with a long list of tools, databases (PostgreSQL, MySQL) and a **tool cache with several versions of each language** (Go 1.24, 1.25, 1.26; Node 22 and 24; several Python). `setup-*` actions pick a version from that cache, so a job rarely downloads a runtime. The readme also carries **announcements** (Go 1.24 leaves the tool cache on 18 Nov 2026; `ubuntu-latest` moves to 26.04 in Nov 2026). Lessons: one big image plus a version-rich tool cache; tell the user when a version they use is leaving.
- **actions-runner-controller (ARC)** [read: [README](https://github.com/actions/actions-runner-controller)]. Kubernetes operator, runner scale sets, ephemeral container runners. The runner image is yours; ARC has no image build UI or status. Lesson: this is the gap crsp can fill for a home or office pool.
- **Buildkite agent stack for Kubernetes** [read: [README](https://github.com/buildkite/agent-stack-k8s)] and agent queues [memory]: the pipeline names the image per step; the stack runs it as a pod. Lesson: job type picks image; the platform does not guess.
- **GitLab Runner, docker executor** [memory]: `image:` and `services:` per job, pull policy (`always`, `if-not-present`, `never`), service aliases, a health wait before the job starts. Lesson: services are first-class, with a pull policy and a wait for health.
- **CircleCI convenience images** [memory]: `cimg/*` images tagged by language version, with a secondary-container list for databases. Lesson: images by stack and version, maintained for you.

### 3.2 Hosted and managed runner products

- **RunsOn** [read: [README](https://github.com/runs-on/runs-on)]. Per-job EC2 runner chosen by a label (`image=ubuntu24-full-x64`, `extras=s3-cache`, `volume=100gb`). AMIs built from GitHub's runner images **refreshed every 15 days**; bring your own AMI; S3 cache, Docker pull-through cache, EFS and EBS **sticky disks**; per-job cost shown. Lesson: image is a name; caches are options; refresh on a fixed rhythm.
- **Ubicloud** [read: [README](https://github.com/ubicloud/ubicloud)]: x64 and arm64 runners, switch by changing `runs-on`. Lesson: arm64 is a normal choice, not a special case.
- **Depot, Namespace, Blacksmith, BuildJet** [memory]: all sell speed through caching. Depot keeps a persistent BuildKit layer cache per project, close to the builder. Namespace has cache volumes and warm pools. Blacksmith has sticky disks and a cache that works with `actions/cache` unchanged, plus a hit-rate view. BuildJet replaced the cache action with a faster local one. Lessons: keep the cache on the machine that runs the job; show hit rate; keep `actions/cache` working with no workflow change (already crsp's goal, caches R5.1).

### 3.3 Toolchain and environment descriptions

- **Dev containers** [read: [spec](https://github.com/devcontainers/spec/blob/main/docs/specs/devcontainer-reference.md)]. `devcontainer.json` names an `image` or a `build`, a list of **features** (each a small installable layer, such as `ghcr.io/devcontainers/features/node:1`), `dockerComposeFile` with `service` and `runServices` for databases, and lifecycle commands. The metadata label on the image records what was merged. Lesson: features are the same idea as crsp layers; compose `runServices` is the same idea as service containers.
- **mise, asdf, Nix, devbox** [read: [mise](https://github.com/jdx/mise), [devbox](https://github.com/jetify-com/devbox), [asdf](https://github.com/asdf-vm/asdf)]. mise reads `.tool-versions`, `.nvmrc` and other idiomatic version files, and `mise.toml`; `mise lock` writes exact versions and checksums. devbox uses Nix packages in `devbox.json`. Lesson: read those files for versions; a lock file is a good cache key.
- **`actions/setup-node`** [read: [README](https://github.com/actions/setup-node)]. `node-version-file` accepts `package.json`, `mise.toml`, `.nvmrc`, `.node-version`, `.tool-versions`. It turns npm caching on by itself when `packageManager` says npm; pnpm and yarn need `cache:`. Lesson: workflows already say which versions they want; read the `setup-*` steps.
- **GitHub `services:` and `container:`** [memory]. Per job: `services.<id>.image`, `env`, `ports`, `options` (health checks). `container:` runs the steps inside an image. Both need Docker reachable from the runner. Lesson: map them to profile services; crsp has no Docker socket in jobs, so crsp must start them.

### 3.4 Caches

- **`actions/cache`** [read: [README](https://github.com/actions/cache)]. `key`, `restore-keys` (prefix match), `cache-hit` output. A repository may hold **10 GB**; older entries are evicted by last access, and entries **unused for 7 days** go. Lesson: crsp's cache server should show the same words: hit, restore-key hit, miss.
- **docker buildx cache** [memory]: `--cache-from` and `--cache-to` with `type=local`, `registry`, `gha`, `s3`; `mode=max` keeps all layers. Layer keys come from the instruction and its inputs. Lesson: a local BuildKit cache per machine is the cheap win; a registry cache helps across machines.
- **sccache and ccache** [read: [sccache](https://github.com/mozilla/sccache), [ccache](https://github.com/ccache/ccache)]. Compiler caches keyed by the hash of compiler, flags and input; sccache stores on local disk, S3 and others. Lesson: a pool-wide local sccache for Rust and C.
- **Package caches** [memory]: npm `~/.npm`; pnpm content-addressable store; pip and uv caches; Cargo registry plus `target`; Go `GOMODCACHE` and `GOCACHE`; Gradle `~/.gradle/caches`. All keyed by a lock file hash. Lesson: one cache per tool, a key rule, a quota, a hit rate.

### 3.5 Security and updates

- **Trivy** [read: [README](https://github.com/aquasecurity/trivy)] scans images and file systems for OS and language package vulnerabilities, IaC problems and secrets. **Syft** [read: [README](https://github.com/anchore/syft)] writes an SBOM (CycloneDX, SPDX). Lesson: scan each built image, keep an SBOM, show a short count per profile.
- **Renovate** [read: [configuration options](https://github.com/renovatebot/renovate/blob/main/docs/usage/configuration-options.md)] and Dependabot [memory]: propose pin bumps from files, including Dockerfile `ARG` versions. Lesson: crsp's pins (`pins.json`, Dockerfile `ARG`) already have SHA-256; the missing part is *showing* a pin is old and letting the owner approve the bump.

### 3.6 Stack detection

- **GitHub Linguist** [read: [README](https://github.com/github-linguist/linguist)]: language by file name, extension, shebang and heuristics; `--strategies` says which rule decided. Good for "what languages", weak for versions.
- **Cloud Native Buildpacks** [read: [buildpack spec](https://github.com/buildpacks/spec/blob/main/buildpack.md)]: each buildpack has a `detect` step that looks at the source, and a **build plan** of what it provides and requires; optional buildpacks may fail detection quietly. Lesson: detection is a list of small rules, each naming the file it read; the plan says what is needed.
- **Railpack** [read: [README](https://github.com/railwayapp/railpack)], successor of **Nixpacks** (now in maintenance mode) [read: [README](https://github.com/railwayapp/nixpacks)]: builds an image from source with little config. Lesson: manifest-first detection is enough for most stacks.
- **Dependabot and Snyk** [memory]: read manifests and lock files per ecosystem. Lesson: the same file list.

### 3.7 What we take, in one list

1. A tool cache with several versions, filled from what repositories ask for (GitHub images, setup actions).
2. Features as layers, services as sidecars (dev containers, GitLab, CircleCI).
3. Read version files, not only workflows (mise, setup-node).
4. A refresh rhythm and a notice when a version leaves (RunsOn, runner-images announcements).
5. Hit rate and time saved shown per cache (Blacksmith, Depot).
6. Local compiler and layer caches with a quota (sccache, buildx).
7. SBOM and a vulnerability count per image (Syft, Trivy).
8. A scan that shows the file behind each finding (buildpacks detect, Linguist strategies).
9. Pull policy and a prebuilt image from a registry (GitLab, ARC).

## 4. Feature list

Priority: **M** must, **S** should, **C** could. Today: **exists**, **partial**, **missing**. Effort: S (days), M (1 to 2 weeks), L (more).

### A. Detection and scan

| ID | Feature | Why | Pri | Today | Effort |
|---|---|---|---|---|---|
| A1 | Scan a repository when it opts in and after a push to the default branch. Reads files through the contents API. Reads only; never runs code. | The user never writes image config by hand. | M | missing; the contents read exists for the graph (R5.98, `internal/repos`) | M |
| A2 | Read workflows: `runs-on`, `container`, `services`, `setup-*` actions with versions, matrix values, `uses:` of known tool actions (sccache, Playwright, Docker buildx). | Workflows say what jobs really use. | M | missing | M |
| A3 | Read manifests and lock files: `package.json`, `pnpm-lock.yaml`, `package-lock.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `uv.lock`, `requirements*.txt`, `pom.xml`, `build.gradle(.kts)`, `*.csproj`, `Gemfile`. | Languages and package managers. | M | missing | M |
| A4 | Read version files: `.tool-versions`, `.nvmrc`, `.node-version`, `.python-version`, `rust-toolchain(.toml)`, `mise.toml`, `go.mod` `go` and `toolchain` lines. | Exact toolchain versions. | M | missing | S |
| A5 | Read `Dockerfile`, `compose*.yaml`, `devcontainer.json` (image, features, compose `services`). | Services and system packages. | S | missing | M |
| A6 | Findings carry the file and the rule that found them; a finding that conflicts with another says so. | Trust (CORE-3: say it plainly). | M | missing | S |
| A7 | Show findings per repository and summed for the pool. | The owner's request (b). | M | missing | M |
| A8 | The user confirms before anything is built or changed. Confirm runs as a wizard. | Product rule: crsp proposes, user approves. | M | missing | M |
| A9 | Rescan on schedule and when a lock file changes; keep a history of what changed. | Stacks drift. | S | missing | S |
| A10 | Private-repo privacy: keep findings, not file text. Count against the GitHub rate budget (R6.6). | Same rule as R5.98. | M | partial (rule exists) | S |
| A11 | Monorepo: scan sub-folders; one repository may have several stacks. | Real repositories. | S | missing | M |
| A12 | A hint file, `.crsp.yml`, to override a wrong guess (optional). | Escape hatch. | C | missing | S |

### B. Image profiles

| ID | Feature | Why | Pri | Today | Effort |
|---|---|---|---|---|---|
| B1 | A **profile** = base + layers + toolchain versions + service containers + the labels and job types that pick it. | Different projects need different images (request a). | M | missing; one image per machine and OS | L |
| B2 | Automatic profiles made from the scan; the user may edit one (it becomes custom). | Less setup. | M | missing | M |
| B3 | Routing: a job's `runs-on` labels and its repository's profile choose the image. The user never picks a repository for a runner. | Product model. | M | partial (layers are per machine) | L |
| B4 | Service containers per profile (postgres:16, redis:7), started per job and torn down; or a compose group that stays up with the runner (the dev-standards `pool-main`). | Request (b) example. | M | missing (Postgres roles only, R5.45) | L |
| B5 | Toolchain versions in a **tool cache layer**: several versions side by side, as on GitHub-hosted runners. | Fewer downloads; one image serves many versions. | S | partial (tool cache R5.14, no layer) | M |
| B6 | Merge: two repositories with the same stack share one profile; different versions of Node live in the tool cache, not in two images. | Fewer images, less disk. | S | missing | M |
| B7 | Per-arch: x64 and arm64 images of one profile, same key rule. | Pi lab. | M | partial (build uses TARGETARCH) | S |
| B8 | A profile preview before build: size, time, disk. | CORE-5. | S | missing | S |
| B9 | Windows and macOS: no container image. Show the toolchain a persistent runner needs (documented, checked by the doctor). | Complete picture. | C | missing | M |
| B10 | Extra packages per profile (today per pool). | Finer control. | S | partial (R5.51) | S |

### C. Build and status

| ID | Feature | Why | Pri | Today | Effort |
|---|---|---|---|---|---|
| C1 | Real image state: `not_built`, `queued`, `building`, `ready`, `failed`, `stale`. | The API says `not_built` always. | M | partial (enum exists; nothing sets it) | M |
| C2 | Live progress: step n of N, the layer, time so far, time left from earlier builds. | Owner request. | M | missing | M |
| C3 | Stream the build log; keep the last build's log; secrets removed. | See why it is slow or failed. | M | missing (output is thrown away) | M |
| C4 | A failure in plain words: which step, a class (network, checksum, disk, apt, timeout), what next. The raw log stays one click away. | CORE-3, UX-28. | M | missing | S |
| C5 | Build from the add-runners wizard shows "Building the job image" with progress. | Owner request. | M | missing | S |
| C6 | Builds start by themselves on: first runner, layers changed, pin updated, stack changed. The history says which. | Know why. | M | partial (first runner only) | S |
| C7 | One build at a time per machine; a limit on CPU so jobs keep their share; the build runs aside and never cuts a job. | Safety. | M | partial (aside + drain exist) | S |
| C8 | Retry, cancel, rebuild. A failed build keeps the old image. | Control. | M | partial (rebuild 409 when not built) | S |
| C9 | The strip at the top shows running builds (UX-34); a finished or failed build raises one notification. | Owner is away. | S | missing (strip exists for wipes and plans) | S |
| C10 | Build history per profile and machine with time taken; feeds the time-left estimate. | Estimate. | S | missing | S |
| C11 | Pre-flight: free disk, free memory, registry reachable. Say "waits for disk" instead of failing. | UX-29, caches R5.38. | S | missing | S |

### D. Reuse and invalidation

| ID | Feature | Why | Pri | Today | Effort |
|---|---|---|---|---|---|
| D1 | Key = base digest + layer set + pins + extras (+ toolchain set). Same key, same image, built once per machine. | Exists. | M | exists (`ImageKey`) | – |
| D2 | Show **why** a key changed ("Playwright pin 1.64.0 to 1.65.1"). | Trust. | S | missing | S |
| D3 | `stale` state: the profile moved on; the old image keeps serving; rebuild when idle. | R5.35 in the UI. | M | partial | S |
| D4 | Layer-level reuse through the BuildKit cache so a changed top layer does not rebuild the bottom ones. | Faster rebuilds. | S | partial (docker does it if the cache is kept) | S |
| D5 | Digest-pin the base and show the base's age; a base security update is a reason to rebuild. | Safety. | S | partial (digest pinned) | S |

### E. Prebuilt distribution (see section 8)

| ID | Feature | Why | Pri | Today | Effort |
|---|---|---|---|---|---|
| E1 | Publish the standard profile images to a registry on release (CI already builds them). | Skip the 15 to 18 min first build. | S | partial (CI builds, does not push) | M |
| E2 | A machine pulls by key when the registry has it, else builds. Setting: Auto, Always build, Always pull. | Choice. | S | missing | M |
| E3 | Verify what was pulled: digest and signature against the key. | Supply chain. | S (with E1) | missing | M |
| E4 | Private registry for custom profiles (the user's own GHCR). | Share across machines. | C | missing | M |

### F. Caches

| ID | Feature | Why | Pri | Today | Effort |
|---|---|---|---|---|---|
| F1 | One row per tool: npm, pnpm, pip/uv, Go, Cargo, Gradle/Maven, Docker layers, sccache/ccache, tool cache, Actions cache, git mirror. | Request (c). | M | partial (tool and Rust only) | L |
| F2 | Key rule shown per cache (lock file hash and tool version). | Understand reuse. | S | missing | S |
| F3 | Quota per cache and a pool budget per machine (`cache_cap_bytes` is stored, not read). | The 320 GB incident (D302). | M | partial (two fixed quotas) | M |
| F4 | Hit rate, misses, time saved; per cache and per week. | Know it works. | M | missing | M |
| F5 | Eviction rule shown: oldest first, 7 days unused, never during a job. | Trust. | S | partial (oldest first) | S |
| F6 | Wipe per cache, per machine or per repository; the question card names what goes and the jobs it waits for. | UX-62. | M | partial (per runner cache) | S |
| F7 | Actions cache server with `actions/cache` semantics (key, restore keys, 10 GB per repository as default). | Spec R5.1 | M | missing | L |
| F8 | Package-manager caches wired by the image env (`npm_config_cache`, `PNPM_STORE_DIR`, `GOMODCACHE`, `CARGO_HOME`, `GRADLE_USER_HOME`, `UV_CACHE_DIR`) to one folder per runner kind. | Caches work with no workflow change. | M | partial (tool and Rust) | M |
| F9 | Warm cache hint to the scheduler (warmth, R5.27). | Faster jobs. | C | missing | M |
| F10 | sccache or ccache as an opt-in local cache. | Rust and C speed. | C | missing | M |
| F11 | Registry mirror and git mirror rows. | Spec R5.24 | S | missing | L |

### G. Updates and pins

| ID | Feature | Why | Pri | Today | Effort |
|---|---|---|---|---|---|
| G1 | Show each pin with age and the newest known; the owner approves a bump. | Renovate idea. | S | partial (pins in the binary) | M |
| G2 | Notice when a version a repository uses leaves a standard (for example Go 1.24 leaves the GitHub tool cache). | runner-images announcements. | C | missing | S |
| G3 | Refresh rhythm: rebuild standard profiles when crsp updates its pins; custom profiles on request. | RunsOn: every 15 days. | S | partial | S |

### H. Security

| ID | Feature | Why | Pri | Today | Effort |
|---|---|---|---|---|---|
| H1 | SBOM per image (Syft). | Know what is in it. | S | missing | M |
| H2 | Vulnerability count per image (Trivy), shown per profile; no blocking. | Awareness. | C | missing | M |
| H3 | Pinned downloads with SHA-256. | Done. | M | exists | – |

### I. Disk and pruning

| ID | Feature | Why | Pri | Today | Effort |
|---|---|---|---|---|---|
| I1 | Disk per machine: images, caches, free, budget. | Overview. | M | missing | S |
| I2 | Prune old images (keep 3 per OS exists); show what waits for the next sweep. | Disk. | M | partial | S |
| I3 | A disk guard that also pauses **builds** below the free floor. | Safety. | S | partial (jobs only) | S |
| I4 | Docker disk (Docker Desktop file) already on the machine page; link it. | Windows. | C | exists | – |

### J. Machines and architectures

| ID | Feature | Why | Pri | Today | Effort |
|---|---|---|---|---|---|
| J1 | Per machine: which profiles it builds. Default: all the profiles of the repositories it serves. | Pool first. | M | partial | S |
| J2 | Per arch: x64 and arm64 builds listed apart; arm64 times are longer (the fixture assumes 2.1 times). | Pi lab. | M | partial | S |
| J3 | Windows hosts with Docker Desktop (Linux containers) count as container machines. | Existing (R5.47). | M | exists | – |

### K. What the user approves and what crsp does alone

| Step | crsp alone | The user approves |
|---|---|---|
| Scan a repository | yes (read only) | – |
| Create a profile from a scan | proposes | **yes** (wizard) |
| First build of an approved profile | yes | – |
| Rebuild for a pin bump in a crsp release | yes, when idle | the update itself (existing update flow) |
| Rebuild after a scan change that adds a layer or service | proposes | **yes** |
| Remove an old image, over-quota cache entries | yes, between jobs | – |
| Wipe a cache, delete a profile | – | **yes** (question card) |
| Change a quota | – | yes (edit bar) |
| Pull a prebuilt image | yes, when the setting is Auto | the setting |

## 5. Repository scan design

**When.** On "Turn on pool" for a repository, after a push to the default branch (the webhook exists), when a lock file or workflow changes, and on "Scan again". It goes through the rate budget (R6.6); a low budget delays the scan and says so.

**How.** One tree call for the default branch, then contents reads of only the files below (size cap, depth cap). Nothing is cloned and nothing runs.

**Files read and what they give.**

| Files | Gives | Becomes |
|---|---|---|
| `.github/workflows/*.yml` | `runs-on` labels, `container:`, `services:`, `setup-node/go/python/java/dotnet` with `*-version` and `*-version-file`, matrix values, `mozilla-actions/sccache-action`, `actions/cache` keys, `docker/build-push-action` | job types, services, toolchain versions, a Docker layer cache, cache keys |
| `package.json` (`engines`, `packageManager`), `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock` | Node, the package manager, Playwright version | Node in the tool cache; pnpm or npm cache; `browsers` layer |
| `go.mod`, `go.work` | Go version, toolchain | Go in the tool cache; Go module cache |
| `Cargo.toml`, `rust-toolchain(.toml)` | Rust channel and version, `cargo-xwin` | Rust in the tool cache; Cargo cache; `llvm` layer when a Windows target appears |
| `pyproject.toml`, `uv.lock`, `requirements*.txt`, `.python-version` | Python, uv or pip, native deps (`psycopg`) | `python` layer; uv cache; `libpq-dev` as extra package |
| `pom.xml`, `build.gradle(.kts)`, `gradle-wrapper.properties` | Java, Gradle or Maven, Android SDK | `java` layer; Gradle cache |
| `.tool-versions`, `.nvmrc`, `.node-version`, `mise.toml` | exact versions | tool cache versions |
| `Dockerfile`, `compose*.yaml`, `.devcontainer/devcontainer.json` | base images, services (`postgres:16`), features | service containers; Docker layer cache; a compose group (as dev-standards `pool-main`) |
| `.crsp.yml` (optional) | overrides | wins over a guess |

**Findings.** Each finding has: kind (language, package manager, toolchain, service, browser, build tool, container), name, version, **file**, **what crsp does with it**, and a state: `covered` (the profile has it), `new` (crsp would add it) or `conflict` (two files disagree). A conflict never picks silently. Example in the review build: `luis-mc/docs-site` has `.nvmrc` 22 and a preview workflow asking for Node 20. Node 20 is offered as a tool cache version, not as a second image.

**Mapping to profiles.** Findings give a set of layers, toolchains and services. Repositories with the same set share a profile. Versions that differ go to the tool cache, so one image serves several versions. A service set that differs (Postgres versus Redis) makes a separate profile because the image is the same but the sidecars differ; services are part of the profile, not of the image key.

**Shown.** *Per repository:* a page with the findings table, the file for each, the state, and the profile it maps to (screens `stack-*`). *Summed for the pool:* a table "What the pool needs" with kind, name, versions, how many repositories, what it becomes, and the state (screen `images-stacks`).

**What the user confirms.** The new findings of one repository, in the profile wizard: Choose (layers, services, machines), Review ("Nothing has changed yet."), Building, Done (UX-30). Covered findings need nothing. Nothing is built before the Review step.

**Limits.** Heuristics can be wrong. A repository that builds tools at run time (downloads a toolchain in a script) shows as not found; the owner can add a layer by hand. Scan never reads secrets files and never stores file text.

## 6. Image profiles and cache model

### 6.1 Data model (sketch)

```
profile        id, name, kind(automatic|custom), base, arches[], layers[], toolchains[], services[],
               labels[], repositories[], key, stale_because?
layer          id, name, adds, size, state(on|suggested)
toolchain      tool, version, found_in(file), layer
service        name, image, role, lifetime(per job | with the runner)
image          machine, profile, arch, key, state, origin(built here|pulled), size, built_at, previous_image?
build          id, image, reason, started, finished, steps[], failure?{step, kind, why, next}, log
repo_scan      repository, commit, scanned_at, files_read, profile, state, findings[]
finding        kind, name, version?, file, becomes, state(covered|new|conflict)
cache_tool     tool, scope(per machine|per runner|pool-wide), size, quota, entries, hits, misses,
               saved_seconds, last_used, key_rule, eviction
```

The review build's types are in `apps/web/src/screens/images-next/model.ts`. The proposed endpoints are: `GET /api/v1/image-overview`, `/image-profiles/{id}`, `/image-builds/{id}`, `/stack-scans`, `/stack-scans/{owner}/{name}`, `/cache-tools`, and `POST` for `confirm`, `retry`, `wipe`. They are **not** in `openapi.yaml`.

### 6.2 Keys and invalidation

- **Image key** (as today): base digest, sorted layers, pins, extras. New: the toolchain set that is baked in (the tool cache layer). Services are **not** in the key (they are separate containers).
- A change to any part gives a new key. The old image serves until the new one is ready and the machine is idle (R5.35). The old image is pruned after the newest 3 are kept.
- **Why** is recorded with every build (`reason`: first runner, layers changed, pin updated, base updated, asked by you, stack changed).
- **Cache keys.** Dependency caches: lock file hash + tool version + OS and arch. Compiler caches: hash of compiler, flags, input. Actions cache: the key in the workflow (as GitHub). A new key never evicts an old entry; the eviction rule does.
- **Eviction.** Oldest used first, never during a job, to a per-cache quota; a pool budget per machine on top (`cache_cap_bytes`).

## 7. Build status and progress design

**Agent side.** `PrepareImage` runs `docker build --progress=plain` (or BuildKit `rawjson`) and **streams** the output line by line through a new runner method instead of `step()`. A small parser turns BuildKit step lines (`#5 [3/6] RUN ...`) into: step index, step name, state. The agent sends **build events** over the agent link: `queued`, `step(n, of, name, state)`, `log(lines, batched)`, `done(size)`, `failed(step, class, why)`. Logs are redacted (existing `redact`), capped, and kept for the last 5 builds per machine.

**Controller.** A build record per (machine, profile, arch, key), in the store. `buildImage()` reads it instead of always saying `not_built`. State names follow the contract (`ready`, `rebuilding` renamed `building`, `failed`, `not_built`) plus `queued` and `stale`. Progress is **a number the server holds** (UX-19): the page and the strip read the same value. The time left is the typical time of earlier builds on this machine (history), minus time so far; if there is no history, the bar is the animated "unknown total" bar and says so (UX-29).

**API.** `GET /api/v1/image-overview`, `GET /api/v1/image-builds/{id}` (steps, log tail), `POST .../retry`, `POST .../cancel`, and live events on the existing stream (`image.build`). The existing `GET /api/v1/images` keeps working and gains the real `state`.

**UI** (screens in `shots/`):

- Overview: "Building now" cards (bar, step, time left), the images table with a state word on every row (`build-*`, `images-overview`).
- The strip at the top shows the running build on every page (UX-34).
- Add runners: the work step is "Adding runners" and its first line is "Building the job image on Pi lab, step 4 of 6, about 14 min left" (`add-runners-building-*`).
- A failed build says which step, why in plain words, what to do next, that the old image keeps serving, and the primary is "Try again" (`build-failed`).
- Notifications: one when a build fails or ends while nobody is looking (existing notification kinds).

**Cost.** Parser and streaming: M. Build records and API: M. UI: M (review build is the start). Needs a shared **live log** part: component 26 is specced but is not in `packages/ui` today, so the review build uses the shared `CodeBlock`.

## 8. Prebuilt distribution: registry pull or local build

| | Pull a prebuilt image | Build on the machine |
|---|---|---|
| First start | Fast (a 3 GB pull, about 4 min on a good link) | 15 to 18 min on amd64; longer on arm64 |
| Content | Same bytes on every machine; one thing to scan and sign | Each machine builds its own; small differences possible |
| Custom profiles | Needs a private registry and a push step | Works with nothing extra |
| Network | Needs a registry and bandwidth; works only when the registry is up | Needs the base, apt and tool download sources |
| Supply chain | Trust the registry; verify digest and signature against the key | Trust the pinned downloads and SHA-256 (already done) |
| Cost | Registry storage; GHCR is free for public images | CPU and time on the machine |
| Offline | Works from a local mirror (registry mirror R5.24) | Fails without the sources |
| arm64 | Needs a multi-arch build in CI (slow, but once) | Slow on the Pi each time |

**Recommendation.** Setting `Images`: **Auto** (default). A machine pulls the standard profile image when the registry has its key and its digest verifies; otherwise it builds. Custom profiles build locally unless the owner sets a private registry. Always show the origin (`built here` or `pulled`) in the images table. Start with standard profiles only (E1 to E3); everything else keeps working as today.

## 9. UX proposals

Checked: **CORE-1** to **CORE-7**. Design system: `v1` is the followed version (highest numbered folder); words and rules proposed in `next-version`. Rules used: UX-4, UX-5, UX-6, UX-9, UX-10, UX-13, UX-14, UX-16, UX-19, UX-21, UX-25, UX-26, UX-28, UX-29, UX-30, UX-34, UX-37, UX-38, UX-41, UX-42, UX-49, UX-52, UX-54, UX-58, UX-62, UX-71, UX-72.

Shared parts used: `Page`, `PageHeader`, `Tabs`, `Section`, `Card`, `CardGrid`, `Facts`, `Table` (`oneLine`, row action `Open`), `Status`, `Tag`, `Progress`, `LevelBar`, `Message`, `ActionBar`, `EditBar`, `Wizard`, `CheckRow`, `TextField`, `NumberField`, `Segmented`, `Breadcrumbs`, `QuestionCard` (through `Ask`), `CodeBlock`, `ActivityStrip`. No stylesheet, no `style=`, no new class.

**Section shape.** Tabs: **Overview, Profiles, Stacks, Caches**. One primary at the foot, chosen by what is next: "Open the failed build" if a build failed; else "Review N new stacks"; else "Add a profile" (UX-4, UX-52).

| Screen | Shots (`shots/<name>-<width>-phosphor-<dark|light>.png`) | What it shows |
|---|---|---|
| Overview | `images-overview` | Building now (bar, step, time left), images per machine with state words, disk per machine against the budget, ready-made images. |
| Profiles | `images-profiles` | One-line table: profile, kind, toolchains, services, repositories, images ready, Open. |
| Profile | `profile-go-web`, `profile-out-of-date`, `profile-compose-group` | Images per machine, layers with size, toolchains with version and the file it was read from, service containers (the compose group of dev-standards: `kvm-loader-1` alpine, `db-1` postgres:16), repositories, build history. |
| Build | `build-running`, `build-failed`, `build-ready`, `build-pulled`, `build-out-of-date`, `build-queued` | State, progress, steps, a failure in plain words, the log, Try again or Rebuild. |
| Stacks | `images-stacks` | "What the pool needs" summed, and a table per repository. |
| Repository stack | `stack-ml-notebooks`, `stack-docs-site-conflict`, `stack-mobile-client-new`, `stack-dev-standards-compose` | Findings with the file and what each becomes; "Confirm N findings". |
| Wizard | `profile-wizard-<phase>` for all ten states; `profile-wizard-edit` | Choose, Review, Building, Done. The state picker at the foot is review tooling only. |
| Add runners | `add-runners-building-first-run`, `-ready-to-review`, `-running`, `-failed`, `-done` | "Building the job image" with progress inside the work step. |
| Caches | `images-caches` | Hit rate, time saved, disk; one-line table per tool with quota and state. |
| Cache | `cache-cargo-over-quota`, `cache-gradle-empty` | Size against quota, per machine, key rule, eviction, quota field, Wipe with a question card. |

**Row words (UX-72).** Every list uses `Open`; the review layout spec checks that no other word is used. A card button says what it opens (`Open build on Pi lab`).

**New words** (to add to `content.md` if the owner accepts the proposal): states `ready`, `building`, `waits to build`, `build failed`, `out of date`, `not built yet`; `Building now`, `Images on your machines`, `Disk used by images and caches`, `Ready-made images`; failure classes `Checksum`, `Network`, `Disk`, `Timeout`; `Try again`, `Rebuild`, `Build now`, `Edit profile`, `Add a profile`, `Confirm N findings`, `Review N new stacks`, `Open the failed build`; finding states `covered`, `new`, `two answers`; step words `Choose`, `Review`, `Building`, `Done`; add-runners work step `Adding runners` and line `Building the job image on {machine}, step {n} of {N}, about {time} left`. Cache words reuse `Wipe` and `Wiping`.

**Gaps the build shows in the design system.**

1. **No live log part** in `packages/ui` (component 26 names `src/ui/live-log`, which does not exist). The review uses `CodeBlock`. A real part needs a `next-version` entry.
2. A **tool-tip free way to show the file a finding came from** is a `Code` cell. It works, but it is a long second column; at 393 px the table folds as designed.
3. The **activity strip** takes plain data, so image builds fit (the review feeds it through a review-only hook).

**Checks run.** `e2e/tests/review/review-layout.spec.ts`: 302 checks, all pass, over 35 screens: DOM layout judge at 1300 px in dark and light; no sideways scroll at 360, 393 and 1300 px; one-line rows and equal row height at 1300 and 1220 px; only Row action words; the action in the same place at 393 px; and for every wizard state: later steps not pressable, Stop only while running, busy primary while running, Done shows the result, Review says "Nothing has changed yet.". The no-app-CSS scan is unchanged because no style was added.

**Human checks that stay:** that the page looks like its siblings; that the words read as a person would say them; that the next action is the obvious one.

## 10. Open questions for the owner

1. **Profile model: one image per profile, or one big image plus a tool cache?**
   Options: (a) one image per profile; (b) one big image for all (like GitHub); (c) profiles for the shape, tool cache for versions.
   Recommend **(c)**. Fewer images, less disk, and a repository that asks for Node 20 and 22 needs no new image.
2. **Who confirms a scan?**
   Options: (a) always the owner; (b) auto for `covered` and low-risk, owner for new layers and services; (c) never, fully automatic.
   Recommend **(b)**, and (a) for services (they run databases on your machine).
3. **Service containers: how do jobs start them with no Docker socket?**
   Options: (a) crsp starts sidecars next to the runner and gives the job the address; (b) mount a restricted socket; (c) only a compose group per runner like `pool-main`.
   Recommend **(a)** for per-job services and **(c)** for the dev-standards style group. Never (b) (R6.1).
4. **Prebuilt images.** Auto (pull if present, else build), Always build, or Always pull?
   Recommend **Auto**, standard profiles only first. Where: public GHCR for standard images, or a private registry?
   Recommend **public GHCR for standard**, private only if asked.
5. **Scan scope.** Read only default-branch files, or also open pull request branches?
   Recommend **default branch only**; a PR that changes a lock file triggers a rescan after merge.
6. **Rate budget.** A scan reads about 10 to 40 files per repository. OK to spend this from the App's budget (R6.6)?
   Recommend **yes**, one scan per repository per push to the default branch, at most one per 10 min.
7. **Build limits.** One build at a time per machine and a CPU cap (for example half the cores) while jobs run?
   Recommend **yes**: one at a time, half the cores when jobs run, all cores when idle.
8. **Cache quotas.** Keep two fixed quotas (20 and 40 GiB) or one editable quota per cache plus a budget per machine?
   Recommend **editable per cache** with defaults, plus the machine budget (`cache_cap_bytes`).
9. **Security scan.** Add SBOM (Syft) and a vulnerability count (Trivy) per image? Tools run in the image build in CI or on the machine?
   Recommend **SBOM yes, count yes, in CI for standard images only**, no blocking.
10. **Add runners step name.** Rename the work step "Registering" to "Adding runners" (it now also builds the image)?
    Recommend **yes**.
11. **Retention of logs.** Keep the last 5 build logs per machine?
    Recommend **5**, redacted, 1 MB each.
12. **A `.crsp.yml` hint file in repositories.** Allow it?
    Recommend **later** (could): first see how wrong the scan is.

## 11. Proposed delivery split

| Task | What | Size | Needs |
|---|---|---|---|
| IMG-1 | **Build status truth.** Stream `docker build`, parse steps, agent build events, build records in the store, real `state` in `GET /images`, `building`, `failed`, `stale`. Logs kept, redacted. | M | – |
| IMG-2 | **Build UI.** Overview "Building now", build page, failed build words, the strip, the "Building the job image" line in Add runners, a notification. Promote the shared live log part into `packages/ui` and `next-version`. | M | IMG-1 |
| IMG-3 | **Repository scan, read side.** Contents reads, rules for workflows, manifests and version files, findings store, `GET /stack-scans`, rate budget. | M | – |
| IMG-4 | **Stacks UI and confirm wizard.** Pool summary, per repository, the four-step wizard. | M | IMG-3 |
| IMG-5 | **Profiles.** Profile model and store; routing by labels and repository; per-arch builds; key with toolchain set; tool cache layer. | L | IMG-1, IMG-3 |
| IMG-6 | **Service containers.** Sidecars per job and the compose group; health wait; teardown. | L | IMG-5 |
| IMG-7 | **Caches by tool.** Env wiring per runner kind, per-cache quotas and budget, hit and miss counters, Cache page. | L | – (parallel) |
| IMG-8 | **Actions cache server** with `actions/cache` semantics (caches R5.1). | L | IMG-7 |
| IMG-9 | **Prebuilt images.** CI push, pull by key, verify, setting, origin column. | M | IMG-1 |
| IMG-10 | **Pins and updates view; SBOM and scan.** | M | IMG-9 |

**Order.** IMG-1 and IMG-2 first: they answer the owner's loudest pain (no sight of builds) and need no new model. IMG-3 and IMG-7 can run beside them. IMG-5 and IMG-6 are the big change and wait for the answers to questions 1 to 3.

## 12. Review build notes

- Built with `pnpm --filter web build:review` into `docs/review/RES19/app/` (relative paths). Open `app/index.html` through `python3 -m http.server`; add `?freeze` to the address for a still clock. The running build advances with the clock otherwise.
- Real console, real shared parts, fake data. The mock answers only what the screens read; Confirm, Retry and Wipe change the fake state for the page view only. Nothing is saved.
- Review-only hooks: `banner`, `activity` and `imagesRoutes` props on `App` and `AppShell`. The production entry does not pass them. The wizard state picker is review tooling.
- Fake data: 3 machines (Studio PC on Windows with Docker Desktop, Build box, Pi lab on arm64), 6 repositories, 5 profiles, 13 builds (one running, one failed on a checksum, one out of date, one queued, one pulled), 10 caches (one over its quota, one empty), the scan of each repository.
- Research limit: only GitHub hosts were reachable. Points marked [memory] are not re-checked.
