# LOOK23: one pool, add runners without a repository (review, no decision)

Owner rule (2026-11-17): the user sets up ONE POOL across one or more machines, each machine with runners.
Repositories only turn the pool on or off. Today Runners > Add runners asks System, Machine, Number, Labels
and Repository. Constraint: on a personal GitHub account a self-hosted runner registers to ONE repository;
organizations can share through runner groups. That is crsp's internal problem, not the user's.

Screens: `index.html` (PNGs beside it; `prototype.patch` is the throwaway code that drew
A, B, C and the strip; app code on this branch is unchanged).

## 1. How runners register today

| Kind | Where in code | Registration | Scope |
| --- | --- | --- | --- |
| Persistent | `internal/runners/service.go` (`PlanAdd`, `addSpecs`, `addRunner`), `internal/backend/persistent/` | Registration token (`CreateRegistrationToken`), `config.sh` on the machine, service installed; stays registered between jobs | `Scope{Kind: repository\|organization, RepositoryID, Organization, Group}` set by the wizard (`POST /runner-plans`) |
| Light | `internal/runners/light.go` (`EnsureLight`, `LightHosts`), `internal/repos/light.go` | Persistent runner with label `crsp-light`, one per OS per repository, made when the pool is turned on; takes light slots only | Repository of the pool-on repo |
| Ephemeral / JIT | `internal/runners/jit.go` (`StartJobRunner`), `internal/runners/ephemeral.go`, `internal/demand/demand.go` | `GenerateJITConfig` per queued job, handed to the agent, container runner, one job, then removed | `repo.Scope` of the job's repository; `registrationScope` (`orgscope.go`) lifts it to the org runner group when the org has pool mode on |

Facts that matter:

- `runners.Record` carries `Scope`; `Route{Pool, Queue}` says ci or light. Routing never reads the name.
- Demand loop (`demand.Loop.try`): queued job -> `Env.Repo` (pool on?) -> `Match` labels -> a `Host` with a free slot
  (`Host.Slots` = machine job slots, `used[machine]`) -> `StartJobRunner(... Scope: repo.Scope)`. So JIT is already
  "a runner in a free slot of any machine, registered for the job's repo". The user never picks the repo there.
- Slots exist per machine (`internal/scheduler/slots`: job, light, heavy). Slots are scheduler capacity, not runners.
- Only persistent runners (and light) are tied to a repo by the wizard. That is the one place the user sees a repo.
- Org path exists: with pool mode on for an org, runners register at org level in a runner group and are shared.

## 2. How crsp could hide per-repo registration

Idea: the user owns **slots** (runner capacity) per machine + system. crsp owns registrations.

1. **JIT-first slots (fits today's code).** A "runner" in the UI is a slot: machine + system + labels. When a job
   is queued for any pool-on repo, the demand loop already picks a free host and registers a JIT runner for that
   repo. The Runners list shows slot state: idle, or busy with the repo of the current job.
   Gap: today JIT is container only (Linux, and Linux on Windows through Docker). Windows and macOS native runners
   are persistent, so they cannot be JIT slots yet.
2. **Persistent runners as automatic per-repo registrations.** For a slot that must keep state (Windows, macOS,
   warm caches), crsp registers one persistent runner per pool-on repo on that machine, all sharing the slot's
   folder budget, created when the pool is turned on for a repo and removed when it is turned off.
   Gaps: N repos x M slots registrations on GitHub (noise, GitHub runner limits); one slot must not run two repos'
   jobs at once, so the slots layer must lock the slot, not just the runner; a persistent runner is registered to
   one repo, so a repo turned on later needs a new registration (reconcile loop in `internal/repos/reconcile.go`
   is the natural home); stale registrations when a repo is turned off while busy (drain rules in `drain.go`).
3. **Hybrid.** Slots are JIT where the backend supports it (container, microVM, VM); only native persistent
   needs per-repo registrations, and only for pool-on repos. Organizations: one org-level group registration
   serves every repo of the org, which is the clean case.

Data model change: add a `slot` concept (or reinterpret `Record` as a slot with `Scope` empty or "any pool repo"),
the plan API (`POST /runner-plans`) loses `scope` (or defaults it), and the list API gains a "serving" field
(current repo). Labels: `defaultLabels` today reads one repo's `RUNS_ON_*` variable; with no repo it needs a pool
level label set (the pool label such as `crsp-home` plus `self-hosted`).

### Gaps and effort (rough, one agent each, medium effort)

| Piece | Gap | Effort |
| --- | --- | --- |
| Console: Add runners without Repository, explainer, "slots" wording | UI only; API still needs a scope | S |
| API: plan without scope; pool-level default labels | `runner-plans` contract, `defaultLabels`, openapi regen | M |
| Runners list: repo of current job, slot names | `current_job` already exists; naming and grouping in UI | S |
| JIT slots for containers | Mostly present in `demand`; slot record that outlives one job | M |
| Persistent per-repo auto registration | Reconcile on pool on/off, slot lock, cleanup, GitHub limits | L |
| Native Windows/macOS JIT | Agent and backend work (not present today) | L |
| Personal account without org groups | Accept one registration per repo (hidden); document the cap | M |
| Docs, ux-rules, content words ("slot") | design-system `next-version` first | S |

Open points for the owner (no decision here): is "slot" the right word for the user ("runner" stays simpler);
how many persistent runners may a machine hold when 10 repos are on; whether macOS/Windows may stay "per repo
under the hood" first and JIT come later.

## 3. Options built (real app, mocked API, Phosphor dark, 1300 and 393 px)

- **Baseline**: today's Add runners with Repository; Runners list; Overview; Machine page.
- **A**: Add runners asks System, Machine, Number of slots, Labels, plus the line "Runners serve every repository
  with the pool on."; list shows slots per machine with the repo of the current job when busy. Smallest change;
  still a separate Add page.
- **B**: A plus the Runners page grouped by machine, pool capacity at top ("2 machines, 6 runners, 2 busy").
  Best picture of "one pool"; one more screen to maintain.
- **C**: no Add runners page; each machine page has per-system steppers; Runners page read-only. Most direct
  for "each machine has runners"; needs apply/progress handling on the machine page (wizard rules still apply).
- **How crsp works strip** on Overview: Pool, Machines, Runners; repositories turn the pool on or off.

Notes from the screens: the mock data is invented (2 machines, 6 runners, 2 busy); "Live updates paused" is the
mock having no live stream; words "slot" and "serving now" are not in `content` yet; prototype reuses only shared
parts (Page, Section, Table, Facts, NumberField, Message, Status).

## 4. Option D: the owner's product model and navigation (2026-11-17)

Model: ONE POOL across one or more machines, each with runners; the pool is the main thing to configure;
Repositories is the opt-in step ("Use pool" / "Stop using pool" in the action bar, PR #236).

Top navigation, as decided: **Overview, Shared Pool, Repositories, Jobs, Doctor, Settings.**
Machines, Runners and Images and caches stop being top-level areas.

Screens: `index.html` section "Option D" (first run, pool ready no repositories, running; 1300 and 393;
Phosphor dark). Code: `prototype-D.patch` (throwaway, needs the LOOK26 action bar), `shoot-D.js`. App code on
this branch is unchanged. The six items fit on a phone through the existing Menu button: the list opens as
two lines of three and the current area is named on the button.

### Shared Pool (`/pool`)

Tabs: **Summary**, **Machines**, **Runners**, **Images and caches**, **Size and backends**.

- Summary: first-run guide (1 Add a machine, 2 Set runners, 3 Choose repositories; a step stays disabled with its
  reason until the one before is done), then The pool (machines online, runners and busy, repositories using the
  pool, health, capacity bar) and Runners per system.
- Add runners lives under Shared Pool > Runners (`/pool/runners/add`): System, Machine, Number, Labels. No
  repository choice; a note points to Repositories. Same plan/apply wizard as today underneath.
- Repositories: while the pool has no runners the list is grey, "Use pool" is disabled with the reason, and a
  message points to Shared Pool. With runners, selecting rows shows "n selected" and enables the buttons.
- Jobs: tabs **All** (running, queued, done limited to 50 rows), **By repository**, **By machine**, **By runner
  type** (persistent, light, ephemeral), **By job type** (light, standard, heavy), **Trends** (wait time,
  duration and failures per day, drawn with the shared level bar; no new chart part). Each grouped tab shows
  running, queued, done, failed, average wait, average duration. Opening a row would filter All.

### Where every current page goes

| Today | Route today | In option D | New route |
| --- | --- | --- | --- |
| Overview | `/` | Overview, unchanged | `/` |
| Repositories list, detail | `/repositories`, `/repositories/:owner/:name` | Repositories, unchanged except the pool opt-in in the action bar | same |
| Turn on pool | `/repositories/turn-on` | Folded into "Use pool" on Repositories | `/repositories` |
| Machines list | `/machines` | Shared Pool > Machines | `/pool/machines` |
| Add machine | `/machines/add` | Shared Pool > Machines > Add a machine | `/pool/machines/add` |
| Machine page (policy, Docker disk, recovery) | `/machines/:id` | Shared Pool > Machines > machine | `/pool/machines/:id` |
| Pool size (`PoolSize`) | part of Machines | Shared Pool > Size and backends | `/pool/size` |
| Runners list | `/runners` | Shared Pool > Runners | `/pool/runners` |
| Add runners | `/runners/add` | Shared Pool > Runners > Add runners, no repository | `/pool/runners/add` |
| Images and caches | `/images`, `/images/:imageId`, `/caches` | Shared Pool > Images and caches | `/pool/images`, `/pool/images/:imageId` |
| Jobs list | `/jobs` | Jobs > All | `/jobs` |
| Job detail | `/jobs/:id` | Jobs, same detail page | `/jobs/:id` |
| (new) | | Jobs > By repository, machine, runner type, job type, Trends | `/jobs/repository`, `/jobs/machine`, `/jobs/runner-type`, `/jobs/job-type`, `/jobs/trends` |
| Doctor | `/doctor` | Doctor, unchanged | `/doctor` |
| Settings and its tabs, update review | `/settings/*` | Settings, unchanged | same |
| Setup (first run) | `/setup` | Unchanged; its steps match the Shared Pool guide | `/setup` |

Old addresses should redirect (`/machines*`, `/runners*`, `/images*`, `/caches`) so bookmarks and the setup banner keep working.
The command palette (`AREAS` in `shell/Shell.tsx`) and its commands "Add a machine", "Add runners" move to the new routes.

### How A, B and C fit

- **A** (Add runners without repository, slots) is the Add runners page inside Shared Pool > Runners. D shows it
  without the Repository question and keeps A's note, now a link to Repositories.
- **B** (runners grouped by machine, capacity on top) becomes the Shared Pool Summary plus the Runners tab:
  capacity and per-system counts on Summary, machine grouping in the list. Not drawn twice.
- **C** (steppers on the machine page, read-only Runners) fits as Shared Pool > Machines > machine; with C the
  Runners tab is read-only and the Add runners page is not needed. D was drawn with A's page because the owner
  asked for "Add runners inside Runners"; C remains a later simplification.
- The "How crsp works" strip is replaced by the first-run guide on the Shared Pool landing.

### Open points

- Mock data is invented (2 machines, 6 runners, up to 3 running jobs); "Live updates paused" is the mock having no stream.
- New words ("Shared Pool", "Use pool", "Stop using pool", "Serving now", "Trends", "runner type", "job type")
  are not in `content` yet; design-system `next-version` first.
- Jobs aggregates (averages, per-day trends) need an API: the list endpoint is not enough for 7-day trends.
- The Overview "pool" cards and the header status link should point to Shared Pool.
- Whether macOS appears as its own row in Runners per system when no machine has it (hidden here).
