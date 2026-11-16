---
id: web-console
title: Web console
apps: [web-console, controller]
topics: [ui, security, github]
status: building
version: 0.1.0
owner: owner
type: reference
code:
  - apps/web/src/**
  - packages/ui/src/**
design_system:
  - v1 ux-rules UX-1 UX-2 UX-3 UX-4 UX-5 UX-6 UX-7 UX-9 UX-10 UX-11 UX-12 UX-13 UX-14 UX-16 UX-17 UX-18 UX-19 UX-20 UX-21 UX-22 UX-25 UX-26 UX-27 UX-28 UX-29 UX-30 UX-31 UX-33 UX-34 UX-35 UX-36 UX-38 UX-39 UX-41 UX-42 UX-43 UX-49 UX-52 UX-53 UX-54 UX-56 UX-57 UX-58 UX-59 UX-60 UX-61 UX-62
  - v1 components 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 24 26 27 28 29 31 33 34 36 37
  - v1 content action vocabulary, wizard step names, wizard state words, message wording, empty failed and waiting states, dates times and numbers
  - v1 tokens themes, breakpoints, motion, focus
last_verified: 2026-11-14
artifact:
generator: luismc-docs 2.6.0
---
# Web console

The top half (sections 1 to 4) is for every reader: product, design, UX. The bottom half (5 to 12) is for engineers.

The M1 console is built (CRSP24): the shell, the auth states, first run, the overview, repositories, machines, runners and the settings sub-pages Users and roles, Appearance, Retention and Backups. Requirements marked (built, CRSP24) are built. The serving side is built (CRSP33, changed by CRSP42): plain HTTP on 127.0.0.1 and ::1, HTTPS on every other address, the headers, the session cookie, the CSRF and Origin checks and the role check on every operation (R5.1, R6.1 to R6.5). The axe, performance and offline checks are built (CRSP34: R6.6, R6.12, R6.13). The jobs, doctor, images and caches screens and the later settings sub-pages are built (CRSP35 to CRSP37). Everything else in this spec is **NOT YET IMPLEMENTED**, as listed in the last section.

## 1. In one paragraph

The web console is the browser app of CI Runners Shared Pool. The controller serves it on port 8460: plain HTTP on 127.0.0.1 and ::1, HTTPS on every other address. Every user signs in with GitHub. The console has a header, a top menu, a command palette and keyboard shortcuts. It has nine screens: sign-in and first-run, overview, repositories, machines, runners, jobs, images and caches, doctor, and settings. The owner uses it to set the pool up and to change it. Admins change it too. Viewers watch it.

## 2. Why

**Problem.** The pool runs on several machines and serves many repositories. Without one place to look, the user cannot see what runs where, why a job waits, or what to fix.

**Users.**

- The **owner**: the first person to sign in. Sets up the GitHub App, adds machines, allows other users.
- **Admins**: change repositories, machines, runners, images and settings.
- **Viewers**: read everything that holds no secret. Change nothing.

**Goals.**

- One place to set up the pool, from a fresh controller to a first green job.
- A live view of machines, the queue, runners and jobs.
- Every command in one place, reachable by mouse and by keyboard.
- The same look and behaviour on every screen, from design system v1.

**Non-goals.**

- Managing GitHub-hosted runners.
- Being reachable from the internet. The console is for the local network.
- Holding the behaviour of each feature. This spec covers the console: its shell, its auth states and what each screen shows and does. How a feature works is in that feature's spec: `github-integration`, `machines`, `runners`, `scheduling`, `caches`, `doctor`, `observability`, `notifications` and `operations` (folders under `docs/features/`).
- A CLI. The CLI has the same powers, through the same API (decision 0001).

## 3. How it works

```mermaid
flowchart TD
  open[Browser opens https://controller:8460] --> fresh{Controller has a GitHub App?}
  fresh -- no --> link{One-time setup link?}
  link -- no --> howto[Page: how to get the setup link]
  link -- yes --> app[Wizard: connect GitHub]
  app --> signin
  fresh -- yes --> session{Valid session?}
  session -- no --> signin[Sign in with GitHub]
  signin --> gh[GitHub App user OAuth] --> allowed{User allowed?}
  allowed -- no --> noaccess[No access page]
  allowed -- yes --> setupdone{First run done?}
  session -- yes --> setupdone
  setupdone -- no --> checklist[First-run: first machine, first repository]
  setupdone -- yes --> shell[Console shell: overview and the other screens]
  checklist --> shell
  shell -- 401 session ended --> expired[Session ended: sign in again, stay on the page]
  expired --> signin
```

The steps in words:

1. The user opens `http://127.0.0.1:8460` on the controller machine or `https://<controller>:8460` from another one. The controller serves the console and its API from one binary (decision 0001).
2. A fresh controller has no GitHub App yet, so nobody can sign in with GitHub. The setup page opens only through a one-time setup link. The tray's Open, `crsp open` and the controller's first start each give one.
3. The first wizard creates the controller's own GitHub App with GitHub's manifest flow (decision 0002).
4. The user signs in with GitHub through the App's user OAuth flow. The first person to sign in becomes the owner. Later users get in only when the owner has added their GitHub login.
5. The first-run checklist then leads through two more wizards: add the first machine, and turn the pool on for the first repository.
6. After that, the console opens on the overview. A live event stream keeps every screen current.
7. When the session ends, the console says so over the current page. The user signs in again and comes back to the same page.

## 4. Screens and states

Every screen is built from [design system v1](../../design-system/v1/README.md): its [UX rules](../../design-system/v1/ux-rules.md), [components](../../design-system/v1/components.md), [content](../../design-system/v1/content.md) and [tokens](../../design-system/v1/tokens.md). This section names the parts and cites rules and components by ID. It holds no UX rule of its own. Gaps in the design system are listed as owner questions in section 10.

Each screen lists its milestone: **M1** (milestone 1) or **later** (with the milestone when the product brief names it). The API operations named here do not exist yet. They are added to `packages/contract/openapi.yaml` with the screen that needs them. Section 7 lists them all.

The states named for every list follow the design system: loading (component 16, UX-29), empty and could-not-load (component 19, UX-6, UX-28), and live (UX-19, UX-53). Every action that changes something is busy until the server answers (UX-13) and gives its result in one line (UX-27). Every destructive action asks first in a question card that names each item that goes (UX-9, UX-62).

### 4.0 The shell

- **Purpose:** the frame around every signed-in screen.
- **Header:** the product name, the pool status as a word, glyph and colour (UX-58), the live-update state, a button that opens the command palette (it shows `Ctrl+K`, or `Cmd+K` on macOS), and the user menu (GitHub login, role, sign out).
- **Top menu (component 2):** Overview, Repositories, Machines, Runners, Jobs, Images and caches, Doctor, Settings. The current area is marked. Detail pages show breadcrumbs (component 2).
- **Page header (component 1):** one headline per screen (UX-3), with the screen's one primary action (UX-4).
- **Banner slot (component 18):** the one app-wide slot (UX-27). It carries "Live updates paused", "First run is not finished" and "A new version is ready".
- **Activity strip (component 27):** running work that the console started, such as a drain, an image rebuild or an update (UX-34).
- **Command palette:** opens with `Ctrl+K` or `Cmd+K` (UX-57). It lists the areas, the detail pages found by name (a machine, a repository, a runner), and the commands the user's role allows. A command opens the one place where it lives (UX-52). It uses the overlay of component 9 and the search bar of component 21. It is not a component of v1 yet (owner question Q1).
- **Shortcut list:** `?` opens the list of every shortcut (UX-57), in the overlay of component 9.
- **Shortcuts:** `/` moves to the page's search bar (UX-31). `j` and `k` move down and up a list. `Enter` opens the row. None fires while typing in a field (UX-57).
- **Theme:** the look is TUI panes. Six colour themes (Phosphor, Tokyo Night, Catppuccin, Gruvbox, Solarized, Nord), Tokyo Night by default, and a mode (system, dark or light, dark by default) are set in Settings, Appearance (UX-60, UX-55). The theme is kept in the browser and applied before the first paint; the mode is saved by the server.
- **States:** loading the session (an unknown-total bar, component 16); live; live updates paused (a Note message in the banner slot, UX-26, while the last data stays on screen with its age, UX-53); not found (component 19, with a link to the overview); page fault ("This page hit a fault.", UX-28).
- **Milestone:** M1.

### 4.1 Sign-in and first run

**Sign-in page** (`/sign-in`)

- **Purpose:** let a user in with their GitHub account.
- **Data:** `getSession`, `startSignIn`, `completeSignIn` (the GitHub callback).
- **States:**
  - signed out: one primary, "Sign in with GitHub" (UX-4);
  - signing in: the button is busy until GitHub answers (UX-13);
  - sign-in failed: a Problem message that says what failed and offers Try again (UX-26, UX-28);
  - no access: "Signed in as `<login>`. This GitHub account has no access. Ask the owner to add it." with Sign out;
  - session ended: over the current page, a dialog (component 9) says the session ended and offers "Sign in with GitHub". The page and its unsaved input stay under it. After sign-in the user is back on the same page (owner question Q3).
- **Components:** 1, 7, 9, 18, 19.
- **Milestone:** M1.

**Setup page** (`/setup`)

- **Purpose:** take a fresh controller to a working pool.
- **Without a setup link:** a page that says how to get one: the tray's Open, or `crsp open` on the controller's machine. No other action.
- **With a setup link:** the first-run checklist. It shows three wizards in order. A later one is greyed until the one before it is done (UX-5). Each is a wizard (component 4) whose behaviour comes from the shared wizard (UX-54). Each ends with Review, then its work, then Done (UX-30). The step and state words are those of content.md.
- **Back from GitHub with an error:** the Connect GitHub wizard reads `?error=` and `?app_url=` once, shows the message for the code (content.md, Connect GitHub words) as its failed state, and clears both from the address. For an App GitHub made but crsp could not save, the message says so, an external button opens the App on GitHub (only an https://github.com address), and the person deletes it there (App settings, Advanced, Delete GitHub App) and starts again. The App name field says that GitHub App names are unique across GitHub.

| Wizard | Steps | Work step | Done shows |
|---|---|---|---|
| Connect GitHub | Reading the controller; Account (personal account or organization, App name); Review | Creating the App: off to GitHub with the manifest, back with the App's keys | The App's name and account, the permissions it got, and one primary: "Sign in with GitHub" |
| Add the first machine | Machine (OS); Review (the install command, how long the join code lasts) | Joining: waits for the agent to connect, with the code's time left (UX-29) | The machine's name, OS, CPU, memory and the isolation backends found. When this PC (the controller's own machine, machines R5.1) is already in the pool, the step shows "This PC, {host name}, is in the pool." as done, with the optional action Add another machine for the command path |
| Turn on the first repository | Reading repositories; Repositories (a one-choice or multi-choice list, component 13, with Select all N and Clear, UX-12); Review (the repositories, the variables to write, the labels) | Turning on: n of N repositories, with the one in hand (UX-30) | Each repository turned on, its variables written, and what failed with its reason |

- **Harness states:** each of the three wizards has all ten states of the wizard harness (UX-30): loading, first-run, planning, ready-to-review, running, paused, stopped, failed, done, done-after-reload. Stop on "Joining" withdraws the join code. A failed or stopped run still ends at Done and says what is left. Done and Stopped offer Start again (content.md, wizard state words).
- **Review** says "Nothing has changed yet." and counts again after a change to an earlier step (UX-30).
- **Data:** `getSetupState`, `redeemSetupLink`, `startAppManifest`, `completeAppManifest`, `createJoinCode`, `getJoinCode`, `revokeJoinCode`, `listInstallations`, `listRepositories`, `planRepositoryChanges`, `applyRepositoryChanges`.
- **Detail:** the App manifest, permissions and callback are in `github-integration`. Join codes and the install command are in `machines`. Repository variables are in `github-integration`.
- **Components:** 4, 5, 13, 14, 16, 18, 19, 34.
- **Milestone:** M1.

### 4.2 Overview

- **Purpose:** see the pool at a glance and jump to what needs you.
- **Data:** `getOverview`, then `streamEvents`.
- **Shows:** a card per machine (component 8, UX-10) with its state word (UX-58) and three level bars for memory, CPU and slots against its budget (UX-41, owner question Q4); the queue count; the running jobs (component 15); the section "Why jobs wait" (component 15): every queued or held job with the first reason it waits, in words, from `waiting` of `getOverview` (scheduling R5.48, UX-34, UX-19); today's minutes saved as a lettered figure (component 31). Each item links to its screen.
- **Actions:** none. The overview only shows and links (UX-52).
- **States:** loading; empty (no machine yet: "No machines yet. Add a machine to start." links to Machines, content.md); could not load; live; live updates paused.
- **Components:** 1, 8, 15, 17, 19, 27, 31.
- **Milestone:** M1. Minutes saved: later (milestone 8).

### 4.3 Repositories

- **Purpose:** choose which repositories use the pool, and with which limits.
- **Data:** `listInstallations`, `listRepositories`, `getRepository`, `updateRepositoryPolicy`, `getRepositoryExtraPackages`, `setRepositoryExtraPackages`, `planRepositoryChanges`, `applyRepositoryChanges`, `getAppInstallUrl`.
- **List:** a table (component 15) of name, owner, pool on or off, labels, maximum parallel jobs, priority, and repository variable status (`RUNS_ON_LINUX`, `RUNS_ON_WINDOWS`, `RUNS_ON_MACOS`) as a status word (UX-58). Search and filters (components 11, 12, 21, UX-31): on or off (the segmented Pool filter), owner, variable status. The toolbar is the shared list toolbar (R5.67). A line near the title shows the active types and links to the setting (R5.69); the Visibility column and the greyed public rows are in R5.70. Long lists page (component 10, UX-11).
- **Detail:** the policy form (component 14): on or off, runner groups and labels, maximum parallel jobs, priority, jobs from public forks, and the switch "Keep a light runner for short jobs" (scheduling R5.64). A form ends with Cancel and Save (UX-24). Turning fork jobs on shows a Needs-you message with the risk, and asks first (UX-9).
- **Actions and confirmations:**
  - turn the pool on for chosen repositories: the "Turn on the pool" wizard, the same as in first run (component 4, UX-30); the selection bar names the count (component 20, UX-7);
  - turn it off: a question card that names each repository and the variables that go (UX-62);
  - add a repository that is not listed: opens GitHub's App install page (`getAppInstallUrl`);
  - fix a variable that is wrong: shown in the row, applied through the same wizard.
- **States:** loading; empty (the App is installed on no repository: "No repositories yet. Install the App on a repository to start."); could not load (GitHub not answering: the last list stays with its age, UX-53, and a Problem message); live.
- **Role:** turning the pool on also needs admin rights on that repository in GitHub; a row without them shows the action disabled with that reason (UX-38).
- **Detail:** policies are in `github-integration` and `scheduling`.
- **Components:** 1, 4, 10, 11, 13, 14, 15, 17, 19, 20, 21, 22, 34.
- **Milestone:** M1.

### 4.4 Machines

- **Purpose:** add machines and set what each one gives the pool.
- **Data:** `listMachines`, `getMachine`, `updateMachine`, `checkMachinePoolSize`, `drainMachine`, `resumeMachine`, `removeMachine`, `createJoinCode`, `getJoinCode`, `revokeJoinCode`, `getInstallCommand`.
- **List:** a card per machine (component 8) or a table (component 15): name, OS, CPU and architecture, state (online, offline, drained, draining; UX-58), backends, load bars, slots used of total, last seen (UX-53).
- **Detail:** the facts list (component 8); backends found and allowed (component 22); the load budget (memory and CPU percent, with the number keypad, component 37, UX-56); job slots; cache size cap; maintenance windows (time picker, component 36); the drain timeout; the agent's log (component 26).
- **When it works (CRSP75):** a section of the machine page, Mode (Automatic, Always, Paused: one-choice rows, component 13), the switch Pause on battery (UX-22, saved at once) and the CPU for runners (25, 50, 75 or 100%: one-choice rows), with the power source and the reason when the machine takes no new job (UX-58). A pause from the tray shows with its end and a Resume button. On macOS the CPU values are off and say "Not supported on macOS yet." (UX-38). The list has a Takes jobs column (Taking jobs, Paused, On battery, Quiet hours, Busy). The words are in `docs/design-system/next-version/content.md` (Machine policy words). A change in the tray and a change here show each other: both write the machine's settings and the screen reloads on the machines live event.
- **Pool size:** the "Pool size" wizard (component 4; UX-5, UX-30, UX-54) shows the size now and the room, takes the memory (number keypad with one decimal) and the CPUs, and Reviews: the check, the sizing figures, the nearest sizes (UX-6) and, for a lower size, a tick "Yes, lower the pool size" (UX-62). Its words are in the design system content (pool size words).
- **Add a machine:** the page's one primary opens the "Add a machine" wizard, the same as in first run. The install command sits in a monospace block with a Copy button (owner question Q2). The join code shows once, with its time left (UX-29).
- **Actions and confirmations:**
  - drain: a question card that names the running jobs it waits for (UX-62); the drain then shows in the activity strip (component 27);
  - resume: no question;
  - change the budget, slots or allowed backends: Save; if runners restart, the question card names the jobs they wait for (UX-62);
  - remove: a question card that names the machine, its runners and its running jobs (UX-62).
- **States:** loading; empty ("No machines yet. Add a machine to start."); could not load; live; an offline machine stays listed with its last-seen time.
- **Detail:** joining, the budget, drain and backends are in `machines`; the load measures are in `scheduling`.
- **Components:** 1, 4, 6, 7, 8, 9, 14, 15, 17, 19, 22, 26, 27, 36, 37.
- **Milestone:** M1 for the list, detail, add, budget, slots, drain and remove (owner question Q13). Maintenance windows, quiet hours and the cache cap: later (milestones 3 and 7).

### 4.5 Runners

- **Purpose:** see every runner and create runners per OS on machines that support it.
- **Data:** `listRunners`, `getRunner`, `planRunners`, `createRunners`, `deleteRunner`, `streamRunnerLog`.
- **List:** a live table (component 15): name, machine, OS, backend, isolation (UX-61), labels, state (UX-58), current job, age (UX-53). Search and filters by machine, OS, isolation and state (components 11, 21).
- **Add runners:** a wizard (component 4): OS; machine (only machines whose backends support the OS; others are greyed with the reason, UX-38; a Windows machine whose container engine runs Linux containers also supports Linux, as an ephemeral container runner with a note, CRSP127); count and labels; Review; Registering (n of N); Done.
- **Actions and confirmations:** delete a runner, or the selected runners: a question card that names each runner and the job it runs, and waits for the drain (UX-62).
- **States:** loading; empty ("No runners yet. Add runners to start.", or "Add a machine first." when there is none); could not load; live.
- **Detail:** runner life, JIT config and labels are in `runners`.
- **Components:** 1, 4, 9, 11, 15, 17, 19, 20, 21, 26.
- **Milestone:** M1 basic: persistent runners, list, add, delete. Later: ephemeral runners and the live setup log (milestone 2).

### 4.6 Jobs

- **Purpose:** see the queue and the job history, and why a job waits.
- **Data:** `listJobs` (queued, running, done; filters by repository, machine, result, time range), `getJob`, `exportJobs`.
- **Queue:** a table (component 15) of queued jobs with repository, labels, wait time and the reason it waits ("waits for a free slot on any Linux machine"; UX-29).
- **History:** a time axis list (component 24, UX-33): repository, workflow and job name, result (UX-58), machine, backend, wait time, run time. Each row opens the detail, with a link to the run on GitHub.
- **Actions:** export the history (component 29, UX-39). No command changes a job.
- **States:** loading; empty ("No jobs yet. Jobs show here when a workflow runs on the pool."); could not load; live; an empty period offers to widen the range (component 24).
- **Detail:** placement and waits are in `scheduling`; history and minutes saved are in `observability`.
- **Components:** 1, 11, 12, 15, 17, 19, 21, 24, 29.
- **Milestone:** later (milestone 2). M1 shows the queue and running jobs on the overview.

### 4.7 Images and caches

- **Purpose:** see what each machine keeps, and rebuild or wipe it.
- **Data:** `listImages`, `getImage`, `updateImageLayers`, `rebuildImage`, `listCaches`, `wipeCache`.
- **Tabs (component 3):** Images, Caches.
- **Images:** per machine and OS, the base image, its tool layers (check box rows, component 22, saved with Save), size, built at, and the newest kept.
- **Caches:** the Actions cache, git mirrors, the tool cache and the registry mirror, each with its size against its cap (component 31 for sizes over time).
- **Actions and confirmations:**
  - rebuild an image: a question card that names the machine and the runners and jobs it waits for; the rebuild drains first (UX-62) and shows in the activity strip (component 27);
  - wipe a cache: a question card that names the cache and its size (UX-62).
- **States:** loading; empty ("No images yet. Images are built when a runner first needs one."); could not load; live; rebuilding (component 16).
- **Detail:** images are in `runners`; caches are in `caches`.
- **Components:** 1, 3, 7, 9, 15, 16, 19, 22, 27, 31.
- **Milestone:** later (images: milestone 2; caches: milestone 7).

### 4.8 Doctor

- **Purpose:** list every problem the pool has, with its fix.
- **Data:** `listDoctorFindings`, `runDoctor`, `getDoctorRun`.
- **Shows:** findings grouped by area (machines, backends, runners, GitHub registration, repository variables, workflow labels), each with a status word (UX-58), what is wrong, and its fix. A fix that is a command links to the one place that command lives (UX-52). The time of the last run (UX-53).
- **Actions:** "Run the doctor" is the page's one primary (UX-4). It is busy while the run lasts and shows its progress (UX-13, UX-29).
- **States:** loading; no findings (a Done message: "No problems found." with the time of the run); could not load; running; live.
- **Detail:** the checks and fixes are in `doctor`.
- **Components:** 1, 6, 7, 16, 17, 18, 19.
- **Milestone:** later (milestone 2).

### 4.9 Settings

Settings hold configuration only (UX-52). Sub-pages sit under one Settings area, each a form that ends with Cancel and Save (UX-24), or switches saved at once (UX-22).

| Sub-page | Purpose | Data | Actions and confirmations | Milestone |
|---|---|---|---|---|
| Users and roles | Who may sign in, as owner, admin or viewer | `listUsers`, `addUser`, `updateUserRole`, `removeUser` | Add a GitHub login with a role; change a role; remove a user (question card naming the login, UX-62) | M1 |
| GitHub App | The owner replaces the App private key | `replaceAppPrivateKey` | Replace key (owner): a file field and one action; the key is sent once and never shown; GitHub's refusal keeps the old key and says so (github-integration R5.7) | M8 (built, CRSP115) |
| Appearance | The user's theme (six named themes, kept in this browser) and mode (system, dark or light, saved by the server) (UX-60) | `getPreferences`, `updatePreferences` (the mode) | Two one-choice lists saved at once (component 13); the theme list shows a swatch row per theme | M1 |
| Budgets | The pool's default load budget, slots and drain timeout for new machines, and the order of the queue | `getPoolSettings`, `updatePoolSettings`, `getQueueSettings`, `updateQueueSettings` | Save (admin); a change that restarts runners names the jobs it waits for (UX-62). A pool default only reaches machines that join later, so the page says no runner restarts and no job is waited for | M1 (built, CRSP37) |
| Notifications | Channels (email, webhook, desktop) and the events each one gets | `listNotificationChannels`, `createNotificationChannel`, `updateNotificationChannel`, `deleteNotificationChannel`, `testNotificationChannel` | Add, edit, delete (question card), Send test | M1 for channels and Send test (built, CRSP37); event delivery later (milestone 8) |
| Access for CI | Access credentials for automation and the action that sets up parity for a repository (R5.90, R5.91) | `listAccessCredentials`, `createAccessCredential`, `revokeAccessCredential`, `setupRepositoryParity` | Make (admin); Revoke asks first (UX-62); the value is shown once; Set up parity for this repository is busy and disabled with its reason while it runs (UX-13, UX-38); a missing App permission shows the guided grant (R5.92, UX-26) | built, CRSP134 |
| Updates | The runner version and the agent version, and when they update | `getUpdateStatus`, `checkForUpdate`, `applyUpdate`, `updateSettings` (auto_update) | Update now: a question card that names the machines and the jobs the drain waits for (UX-62) | later (milestone 3) |
| Repositories | The one switch "Enable for public repositories" (off by default) | `getPublicRepositories`, `setPublicRepositories` | Turning it on or off asks first in a question card (R5.68); the owner changes it | built (CRSP131) |
| Audit log | Who changed what, and when | `listAuditEvents`, `exportAuditEvents` | Export (component 29, UX-39) | built (CRSP37) |
| Config export | The configuration as a file, without secrets | `exportConfig` | Export, named for what it holds then the file stamp (UX-39) | built (CRSP37) |

- **Users and roles:** a table (component 15) of GitHub login, role, added by, added at, last sign-in. There is one owner. The owner's own row has no Remove. The roles are in section 5.
- **States:** each sub-page has loading, could not load and, for lists, empty ("No other users yet. Add a GitHub login to let someone in.").
- **Notifications (built, CRSP37):** a table (component 15) of the channels with name, kind, where it sends, events, lowest severity, on or off and the last test; one form (Add and Edit) that ends with Cancel and Save (UX-24); **Send test** per row, busy and disabled while it runs, one result line under the table (UX-13, UX-27, UX-38); **Delete** with a question card that names the channel and the events it stops carrying (UX-62, R5.30). A secret is never shown again. A viewer sees only their own channels and cannot pick a webhook, with the reason beside it. Empty: "No channels yet. Add a channel to be told when a machine, job or disk needs you."
- **Detail:** budgets are in `machines` and `scheduling`; notifications in `notifications`; updates, backup and config export in `operations`; the audit log in `observability`.
- **Components:** 1, 3, 7, 8, 9, 13, 14, 15, 17, 19, 22, 24, 29, 37.

## 5. Functional requirements

Requirements marked (built, CRSP24) or (built, CRSP33) are built. The others are **NOT YET IMPLEMENTED**.

### Serving and the shell

**R5.1** (built, CRSP33, changed by CRSP42, D38) — The controller serves the console and its API on one port, 8460 by default, set in config. On `127.0.0.1` and `::1` (and only there) the port speaks plain HTTP, so the default address works without a certificate warning. On every other address, a name, a LAN address or a wildcard, it speaks HTTPS only, with the certificate the controller's own CA made (`internal/tlsca`, the one the agent link uses), TLS 1.3 only, and a plain-HTTP request gets TLS's refusal, never a page. The R6.3 headers, the CSRF and Origin checks and the role check hold on both. An OAuth callback over HTTP on a non-loopback host is refused (github-integration R5.4, R6.4).

**R5.2** — Any path that is not under `/api/` returns the console, so a deep link opens its screen after sign-in. An unknown console path shows the not-found state with a link to the overview.

**R5.3** (built, CRSP24) — Every signed-in screen sits in the shell of section 4.0: header, top menu with the eight areas, page header, banner slot and activity strip.

**R5.4** (built, CRSP24) — `Ctrl+K` (`Cmd+K` on macOS) opens the command palette from any screen. It finds areas, items by name and commands. It lists only the commands the user's role allows. Choosing an item goes to its page; choosing a command goes to the one place where that command lives.

**R5.5** (built, CRSP24) — The shortcuts `/`, `j`, `k`, `Enter` and `?` work as section 4.0 says, and none fires while focus is in a text field.

**R5.6** (built, CRSP24) — The console opens one live event stream (`streamEvents`) per tab. One store holds what it brings, and every screen reads that store for live state.

**R5.7** (built, CRSP24) — When the live stream drops, the console keeps the last data on screen with its age, shows "Live updates paused" in the banner slot, and reconnects with backoff. On reconnect it loads the shown data again before it trusts new events.

### Signing in and sessions

**R5.8** (built, CRSP24) — With no valid session, every console path except `/sign-in` and `/setup` goes to `/sign-in` and keeps the path it came from.

**R5.9** (built, CRSP24) — After sign-in the console returns to the kept path. It accepts only a path on the same origin; anything else goes to the overview.

**R5.10** (built, CRSP24) — A GitHub user who is not on the user list gets the no-access state, with their login and Sign out. No API data is sent to them.

**R5.11** (built, CRSP24) — When an API call answers that the session ended, the console shows the session-ended dialog over the current page. It keeps the page and unsaved input. After sign-in it returns to that page with the input still there. It does not resend the call that failed.

**R5.12** (built, CRSP24) — Sign out ends the session on the server and goes to `/sign-in`.

**R5.13** (built, CRSP24) — The console shows each user what their role allows:

| Role | Can |
|---|---|
| viewer | read every screen; no command; no join code or install command |
| admin | everything a viewer can, and every command on repositories, machines, runners, images, caches, doctor and the settings Budgets, Notifications and Updates; read the audit log |
| owner | everything an admin can, and Users and roles, config export, and the GitHub App |

A command the role does not allow is shown disabled with its reason. The API refuses it too (R6.5).

### First run

**R5.14** (built, CRSP24) — While the controller has no GitHub App, `/setup` opens only with a valid one-time setup link (`redeemSetupLink`). Without one, it shows how to get one. A link works once and expires.

**R5.15** (built, CRSP24) — The setup page shows the three first-run wizards of section 4.1 in order. A wizard opens only when the one before it is done. The first-run checklist stays reachable from the banner slot until all three are done. The banner reads `getSetupState` again when a machine or repository changes and goes away when all three steps are done. The pool status in the header reads the same machines list as the Machines screen (UX-19). The header, the Overview and the Machines screen read that one list; it reloads on a machine event, on a timer and when the tab is shown, so none says "no machines" while one is up. The banner names the next open step and its action (Open the setup page). Every wizard page of the first run uses the wide frame, and its step bar is one row from 601 px up (UX-15). A Note or Problem on these screens names its next action (UX-6): when no repository is free, Turn on the pool offers Install the App, which opens GitHub's install page in a new tab and reads the list again on return; GitHub's return with `setup_action` lands on Repositories, says so and cleans the address. A lone repository is chosen. Add runners offers an organization only when the App is installed on one and fills the labels from the repository's `RUNS_ON_*` variable (CRSP124).

**R5.16** (built, CRSP24) — The Connect GitHub wizard creates the App through GitHub's manifest flow and stores what GitHub returns through `completeAppManifest`. Its Done step offers Sign in with GitHub. The first user who then signs in becomes the owner.

**R5.17** (built, CRSP24; join states and SSH, RES3) — The Add a machine wizard has one Copy button with a one-line join command that holds a one-time join code (15 minutes), then shows three live steps from `getJoinCode`: waiting for the agent, agent connected, machine ready (from its first heartbeat; machines R5.4a). For every system the choice *I have SSH* asks for the host, the user, a port and the SSH key file content; the key is used once for that join and never stored, there is no password option, and the owner confirms the host key fingerprint in a question card before crsp signs in (machines R5.3a). On Windows a note says the machine needs the OpenSSH server and the user must be an administrator; the refusal for a user who is not one is shown as the reason of the failed join (CRSP123); a third choice, *Download an installer*, works for every system (R5.66). The wizard waits until the machine is ready, the code expires, or the user stops. Stop withdraws the code (`revokeJoinCode`). Done shows the machine as the agent reported it.

**R5.18** (built, CRSP24) — The Turn on the pool wizard plans the change with `planRepositoryChanges`, shows that plan at Review, applies it with `applyRepositoryChanges`, and shows at Done what was really done and what failed.

**R5.19** (built, CRSP24) — Each wizard (Connect GitHub, Add a machine, Turn on the pool, Add runners) has all ten harness states, and done-after-reload shows the outcome stored on the server, not the plan.

### Screens

**R5.20** (built, CRSP24; why jobs wait, CRSP76) — The overview shows the machines with their load bars, the queue count, the running jobs and today's minutes saved, all live. It has no command; each item links to its screen. The section "Why jobs wait" lists every queued or held job with its first blocking reason in words (scheduling R5.48): no machine for the OS or labels, over the memory or CPU budget with the numbers, no free slot with how many are ahead, load not measured yet. It reads `waiting` of the overview, one source for the console and the gate; when a live event changes a job, the row falls back to the job's own wait reason until the next snapshot.

**R5.21** (built, CRSP24, extra packages CRSP70) — The repositories screen lists the repositories from GitHub with pool state, labels, limits and variable status. It turns the pool on and off, and edits a repository's policy. A repository's page has a form of its own for the extra packages of its pool image (runners R5.51): a text area, one name per line, saved with Save packages through `setRepositoryExtraPackages`; a bad name shows its line number above the box and in the list at the top before anything is sent. A repository where the user lacks GitHub admin rights shows the turn-on action disabled with that reason. The list has a *Last delivery* column and the repository page shows the last webhook delivery time and result; when deliveries failed and the repository is in polling mode the page says so and has *Switch back to webhooks* (github-integration R5.50, RES14).

**R5.22** (built, CRSP24, pool size CRSP70) — The machines screen lists the machines with state, backends, load and slots. It adds a machine, edits the budget, slots and allowed backends, drains, resumes and removes. A machine's page has the "Pool size" wizard (machines R5.58): Size, Review, Saving, Done. It shows the current size and the room, a Review step with the budget check, the figures behind it and the nearest sizes that fit, an explicit tick for a lower size, and Done with what was saved.

**R5.23** (built, CRSP24; idle and busy, RES7) — The runners screen lists runners live with their isolation word, labels, state, job and age. A line above the table counts the idle and busy runners; the state chip says `idle` or `busy`, and the current job column gives the running job's repository and name with how long it has run. It adds runners only on machines whose backends support the chosen OS, and deletes runners. The Machine column shows the machine's name as a link to the machine page (UX-1). The state word is the true one (UX-19; runners R5.79): `idle` only when GitHub says online and not busy and the service runs, else `not registered`, `stopped`, `offline` or `unknown`; a state that is not idle or busy shows its reason under the word. A failed runner has a Remove button on its row (UX-6). On a managed runner that is offline it also shows *Delete registration* (CRSP108, github-integration R5.33): a question card names the runner and what goes (words: content.md, *Offline runner cleanup words*), then the registration is deleted at GitHub. A failed runner's whole reason (`failed_reason`, runners R5.87, CRSP126) shows when the record has no other reason.

**R5.24** (built, CRSP35) — The jobs screen shows the queue with each job's wait reason, and the history with filters by repository, machine, result and time range. Each row opens the detail, with a link to the run on GitHub. Export holds every row of the filter, in the order shown.

**R5.25** (built in part, CRSP36: caches; images with milestone 2) — The images and caches screen shows images with layers and sizes, and caches with size and cap. It changes layers, rebuilds an image after a drain, and wipes a cache.

**R5.26** (built, CRSP35) — The doctor screen lists every finding with its status and fix, and runs the doctor on demand.

**R5.27** (built, CRSP24; Budgets built, CRSP37) — The settings area has the seven sub-pages of section 4.9. Budgets is one form with Cancel and Save: the memory and CPU budget, job slots, drain timeout and sizing of slots for new machines, and the four queue keys in order, fair share and the no-runner wait. A repeated key is refused on the page before anything is sent. A viewer sees the form, and Save is off with its reason.

**R5.28** (built, CRSP24) — Users and roles adds a GitHub login with a role, changes a role and removes a user. There is always exactly one owner, and the owner cannot remove themselves or lose the owner role.

**R5.29** (built, CRSP37) — Config export downloads the configuration without any secret, in a file named for what it holds and the file stamp.

**R5.30** (built, CRSP24) — Every destructive action (delete a runner, remove a machine, wipe a cache, turn the pool off, remove a user, a drain, a rebuild, an update) first shows a question card that names each item that goes and each running job it waits for. Nothing changes until the user says yes.

**R5.31** (built, CRSP24) — Every list and detail screen has the loading, empty and could-not-load states of section 4, and the empty state offers the action that fills it when the user's role allows it.

**R5.32** (built, CRSP24) — Every date, time, number, size and percent on screen comes from the one formatter (component 28).

**R5.33** (built, CRSP102; the API part is CRSP91, operations R5.44) — **Agent recovery.** A machine whose agent needs recovery shows *needs recovery* in the State column of the list and in the facts of its page. The page has a *Recovery* section: a message that says why (an agent too old for the controller, or one that did not update within an hour), the version the agent has, the version it needs and since when, and one action, *Recover* (admin only; a viewer sees it off with the reason, UX-38). While the call runs the button reads *Recovering* and is locked (UX-13). Then the section says that recovery is ready, and the button stays locked, also after a reload while the machine is armed. A refused call (409, or any error) shows *Could not start recovery* with the reason. The section uses the shared parts only and follows design-system UX-4. Words: content.md, *Agent recovery words*. The reinstall command with a copy button is not built.

**R5.34** (built, CRSP74) — The Repositories screen says where each repository's jobs go now (*crsp machines*, *GitHub-hosted runners* or *waiting for a machine*) in a column and, with the reason in words, on the repository page, which also has the *Hosted fallback* section: the choice *When no crsp machine can take these jobs*, the monthly cap and the hosted labels. Turning the fallback on asks first in the question card (UX-9) and says GitHub may bill the minutes; a public repository cannot take it. Rules: UX-9, UX-22, UX-38. Words: content.md, *Hosted fallback words*. Contract: github-integration R5.42, R5.44.

**R5.35** (built, CRSP74) — While any repository runs on GitHub-hosted runners the Overview shows one line in the banner slot, with a link to Repositories (design-system UX-14: it never pushes the machines and jobs down).

**R5.65** (built, CRSP75) — The machine page has a When it works section and the list a Takes jobs column (machines R5.61 to R5.64, section 4.4). The mode, the Pause on battery switch and the CPU cap save at once with `updateMachine` and show a busy state while they do (UX-13, UX-22). The page says why a machine takes no new job (Paused, On battery, Quiet hours, Busy), and names a pause from the tray with its end and a Resume. A viewer sees the values with the controls off and the reason beside them (UX-38). On macOS the CPU cap is off with its reason; a cap the agent could not set shows the agent's reason as a Problem message. No stylesheet or style attribute is added: the section uses the shared parts only.

**R5.66** (CRSP122, owner decision D70; machines R5.65) — **Download an installer in Add a machine.** The join choice has a third entry, *Download an installer*, for every system (Windows too). Pressing Join a machine on it (not earlier) calls `createJoinFile`, saves the file the controller names and waits on the code's progress exactly as for a copied command (R5.17). The Joining step names the saved file and says what to do with it on the machine, per system; the Review step says the file holds the join code, which works once and lasts 15 minutes. The Joining step and the Review step also say to delete the file after use (CRSP133). A controller without packages answers 501 and the wizard says why on the Review step, so the owner can copy the command instead. The option uses shared parts only (UX-54); its words are in `docs/design-system/next-version/content.md` (C32).

**R5.90** (built, CRSP134; components 15, UX-9, UX-22, UX-62) — Settings has a tab **Access for CI** (admin and owner; a viewer sees why it is closed, UX-38). It lists the access credentials in a table (name, what it can do, who made it, when, last used, live or revoked) with Revoke on a live row, which asks first and names what stops (UX-62). A form (name, scope) makes one; the value comes up once in a dialog with a Copy block and the words that it is shown only once, and is gone when the dialog closes (it is held in no store, not in the browser). The list never holds a value (R6.4). The action of R5.91 sends the value from the controller to GitHub only. Built only from `@crsp/ui` parts; the page passes data. Source: `apps/web/src/screens/settings/AccessForCi.tsx`.

**R5.91** (built, CRSP134; components 18, UX-13, UX-26, UX-38) — The same tab has the action **Set up parity for this repository**: choose a repository, press the button (busy and disabled with its reason while it runs or when no repository is chosen, UX-13, UX-38). Above the repository list the tab **shows the address that will be written** as `CRSP_URL` (the controller's join address, never the address of the browser) and the result of the controller calling it from the server side: it answers, or it does not and the page says why (CRSP141). When the controller has no address a runner can reach, the page shows a Needs you note that says nothing will be made and names the setting to fix (`CRSP_PUBLIC_HOST` or `CRSP_LISTEN_ADDR`), and the button is disabled with that reason; the same note shows when the action answers `needs_address`. It writes through the GitHub App (github-integration R5.84); the owner copies nothing. Done says the workflow can run. When the App lacks a permission, the page makes nothing and shows the guided grant of R5.93, and runs the action by itself once everything is granted. A failure says nothing was left behind. Source: `apps/web/src/screens/settings/AccessForCi.tsx`.

**R5.92** (built, CRSP136) — **The Docker disk section on the Machine page.** For a machine whose agent found a Docker Desktop disk file, or whose compact choice is On or Off, the Machine page shows a Docker disk section after "When it works": the state (the reason of the last look), the disk file, what Docker uses, what can be reclaimed and the last compact; the choice Automatic, On or Off; the threshold and the idle time (shared number fields); the quiet-hours start and end (shared lists). Each control saves at once (UX-22). When the policy is on and the agent has no administrator rights, a problem message says so and the action Turn off saves Off. The part is built from shared `@crsp/ui` parts only; the words are in the Docker disk words of content.md (design-system next-version C39).

**R5.93** (built, CRSP139; component 44, UX-15, UX-26, UX-38) — **The GitHub grant.** Every place that needs an App permission or repository access it lacks shows one shared part, `GithubGrant` of `@crsp/ui` (component 44), fed by `getGithubGrant` (github-integration R5.86): Set up parity for this repository (Settings > Access for CI), the Turn on the pool wizard (choose step), the Repositories screen, and the pool per organization. The part shows **one step list with the live state of each step** (the step text sits next to its label, UX-15): *Install the App on the account*, *Ask for {permissions} on the App page*, *Accept the new permissions on the installation: {permissions}*, each with the word done or missing, and names the exact missing permissions (Secrets (write), Variables (write)). It has **one primary action**, an external link that opens the GitHub page of the next missing step in a new tab (Install the App on GitHub, Ask for it on GitHub, Accept it on GitHub); a later step is plain text (Do this after the step above) until it is next. Only an address on `https://github.com/` is offered. The part **checks again by itself**: when the tab regains focus, when the page becomes visible, and every 15 seconds while it waits (the installation webhook of github-integration R5.87 has by then refreshed the token). When everything is granted it shows **Ready** and calls the page once: Set up parity runs the setup by itself; the other places read their list again. No second button, no Check again button; a failed check says why and the next check tries again. Only an admin sees the guide on Repositories and Turn on the pool. Source: `packages/ui/src/components/Grant.tsx`, `apps/web/src/screens/GrantGuide.tsx`.

**R5.94** (built, CRSP140; components 3, 8, 15, 41; UX-15, UX-17) — **TUI panes on every screen.** Every titled part of a screen is a pane of `@crsp/ui` (`Pane`; `Section` and `Card` are panes): a box border with the title cut into the top border, optional actions in the border line, and a focus ring on the border while focus is inside. Notes stay notes inside the pane. The row under the cursor (`j` and `k`) is the selected row of a list and is drawn in reverse video. Tabs are one row at every width and scroll sideways inside their frame (Settings at 1232 px). On Settings, Access for CI the list is read again when Set up parity makes an access, and the form Make an access is shown only after the action Make an access (Cancel closes it). The first-run banner counts the first repository when any repository has the pool on. Source: `packages/ui/src/components/Pane.tsx`, `apps/web/src/screens/settings/AccessForCi.tsx`, `apps/web/src/shell/Shell.tsx`.

**R5.67** (built, CRSP132, owner decision D82) — **One-row list toolbar.** Every list screen (Repositories, Machines, Runners, Jobs, Images and caches, Users and roles, Audit log) uses the shared `ListToolbar` of `@crsp/ui` (component 11): search, filters, the selection words and buttons (Select all N, Clear, N selected), the count and the list's own actions sit on one line on a wide screen and wrap only when the screen is narrow (360, 393 and 1300 px; UX-7, UX-11, UX-16). A filter with two states (Pool on, Pool off) is the shared `Segmented` part with an All choice. No screen lays the toolbar out itself.

**R5.68** (built, CRSP131, owner decision D79; github-integration R5.54, R5.55) — **Enable for public repositories.** Settings has a Repositories page with the switch *Enable for public repositories* (the shared switch part), off by default, with the product settings. Only the owner changes it; a user who is not the owner sees it locked with the reason. Turning it on opens the shared question card titled *Are you sure?* with the impact in plain words: anyone can open a pull request on a public repository; a self-hosted runner runs that code on your machines; jobs from forks stay refused (github-integration R5.26); secrets, caches and files on the machine could be reached; keeping repositories private is safer. Turning it off opens the same card and names how many repositories (`public_on_pool`) have their runners drained and removed and their pool switched off, with their settings kept. Nothing is sent until the user confirms; Cancel changes nothing. After turning off, a Done message names how many pools were switched off (`stopped`).

**R5.69** (built, CRSP131, owner decision D80) — **Active types line.** Repositories shows a line near the title, *Active types: Private (default)* or *Active types: Private & Public*, and its value is a link to the setting (R5.68).

**R5.70** (built, CRSP131, owner decisions D81 and D82; github-integration R5.55, R5.58) — **Visibility and public rows.** The Repositories table has a Visibility column (Private, Public, Internal). While the setting is off, a public row is greyed, and its Visibility cell says why and links to the setting. *Turn on the pool* is disabled with the reason for a public repository (the repository page, and the selection bar when the selection holds one); the Turn on the pool wizard does not list a public repository and says so with a link; Add runners shows a public repository as not choosable with the reason. A refusal the controller still sends (HTTP 409, `public_repositories_off`) is shown in the screen's own words. A repository whose API `problem` is `public_pool_on_while_off` shows a Problem on its page with the two actions the API names: *Turn on public repositories* (opens the question card of R5.68) and *Turn off the pool* (the question card of the pool off); the list links to it.

## 6. Non-functional requirements

Requirements marked (built, CRSP24) or (built, CRSP33) are built. The others are **NOT YET IMPLEMENTED**.

**R6.1** (built, CRSP33, changed by CRSP42, D38, D39) — The session lives in a cookie that is `HttpOnly`, `SameSite=Lax` and host-only, and `Secure` on every address except `127.0.0.1` and `::1` (on loopback the console is plain HTTP, where a `Secure` cookie would never come back). Its value is a random 256-bit id. The controller stores only its hash. The session never expires by time, idle or absolute (D39, 14 Nov); it ends at sign-out, when the user is removed, or when their role changes (github-integration R5.13). The cookie carries a long `Max-Age`, so a browser restart does not sign anyone out.

**R6.2** (built, CRSP33) — Every request that changes something carries a per-session CSRF token, and the controller refuses a request whose `Origin` is not the console's own. Section 7 says how.

**R6.3** (built, CRSP33) — The console loads nothing from outside the controller: no CDN, font host, analytics or avatar image. The controller sends a Content Security Policy with `default-src 'self'`, no inline script, and `frame-ancestors 'none'`. The browser half (no outside request while the console runs) is the Playwright check in section 9, not built.

**R6.4** (built, CRSP33) — No secret reaches the browser: not the App private key, the webhook secret, a GitHub token or an agent key. A join code shows only in its wizard, once, and never in a URL, log or audit entry. An access credential for CI (R5.90) shows the same way: once, in the dialog that makes it, never in a list, URL, log or audit entry; the action of R5.91 never sends it to the browser at all.

**R6.5** (built, CRSP33) — The API checks the role on every operation (its `x-auth`), whatever the console shows. A viewer's change request gets 403. An operation with no role rule is refused, not opened.

**R6.6** (built, CRSP34) — Every screen, in the dark and the light theme, has no serious or critical accessibility violation (axe), one `h1`, landmarks, and a visible focus (UX-17, UX-59).

**R6.7** (built, CRSP24) — Every screen works from 360 px wide to desktop with no sideways page scroll and 44 px touch targets (UX-16, UX-49).

**R6.8** (built, CRSP24) — App code uses only the shared components: no raw buttons or inputs, no app stylesheet, no native date, time or number input (UX-2, UX-56).

**R6.9** (built, CRSP24) — Every text-on-fill token pair meets WCAG 2.2 AA in both themes (UX-17).

**R6.10** (built, CRSP24) — No retired word of content.md is drawn as a label, button or message.

**R6.11** (built, CRSP24) — Under `prefers-reduced-motion` nothing in the console moves (UX-36, UX-59).

**R6.12** (built, CRSP34, decided D40, 14 Nov) — Budgets, confirmed by the owner (D40): the first screen is usable within 2 s on the local network; the console's first JavaScript is at most 300 KB gzipped; a live event shows on screen within 2 s of the controller sending it. The numbers live in one file, `apps/web/perf-budgets.json`; the checks read it, so the owner changes a budget there. Measured at CRSP34 (Linux CI-like run): first screen usable in about 0.25 s, first JavaScript about 113 KB gzipped, live event on screen in about 20 ms.

**R6.13** (built, CRSP34) — The console keeps working when the internet is down: local screens load, and screens that need GitHub say so (UX-28).

## 7. Design

```mermaid
flowchart LR
  subgraph Browser
    shell[Shell: header, top menu, palette, shortcuts]
    screens[Screens]
    store[(Live store)]
    client[Generated API client]
    shell --> screens --> store
    screens --> client
    store --> client
  end
  subgraph Controller[crsp controller]
    webui[internal/webui: embedded SPA]
    api[internal/api: /api/v1, sessions, roles]
    events[Event stream]
  end
  client -- "HTTPS 8460 (HTTP on loopback)" --> api
  client -- SSE --> events
  Browser -- GET / --> webui
  api --> gh[GitHub App]
```

**Parts.**

- `apps/web/src/shell/`: header, top menu, command palette, shortcut list, banner slot, activity strip host.
- `apps/web/src/auth/`: session state, sign-in page, session-ended dialog, the kept return path.
- `apps/web/src/live/`: the one event stream and the store (UX-19), and the shared clock (UX-53).
- `apps/web/src/screens/<area>/`: one folder per screen.
- `packages/ui/src/`: the shared components of design system v1. A screen extends a component there and never copies it (UX-2).
- `packages/contract/`: the OpenAPI contract and the generated client (decision 0001).
- `internal/webui/`: serves the built console with `go:embed`, with the SPA fallback of R5.2 (`webui.go`), the headers of R6.3 (`security.go`) and the listener of R5.1 (`serve.go`: plain HTTP on a loopback listener, TLS on any other).
- `internal/api/authz.go`: the one gate in front of every operation: who is signed in, the role of its `x-auth`, the Origin and the CSRF token (R6.2, R6.5).

**Routes.**

| Path | Screen |
|---|---|
| `/sign-in` | Sign-in |
| `/setup` | First run |
| `/` | Overview |
| `/repositories`, `/repositories/:owner/:name` | Repositories |
| `/machines`, `/machines/add`, `/machines/:id` | Machines |
| `/runners`, `/runners/add`, `/runners/:id` | Runners |
| `/jobs`, `/jobs/:id` | Jobs |
| `/images`, `/caches` | Images and caches |
| `/doctor` | Doctor |
| `/settings/users`, `/settings/app`, `/settings/appearance`, `/settings/budgets`, `/settings/notifications`, `/settings/access`, `/settings/updates`, `/settings/audit`, `/settings/export` | Settings |

**API operations to add** (all under `/api/v1`, each with `x-auth` and `x-rate-limit`). The owning spec fixes each one's shape.

| Area | Operations | Owning spec |
|---|---|---|
| Session | `getSession`, `startSignIn`, `completeSignIn`, `signOut`, `redeemSetupLink` | `github-integration` |
| First run | `getSetupState`, `startAppManifest`, `completeAppManifest` | `github-integration` |
| Live | `streamEvents` | `observability` |
| Overview | `getOverview` | `observability` |
| Repositories | `listInstallations`, `listRepositories`, `getRepository`, `updateRepositoryPolicy`, `planRepositoryChanges`, `applyRepositoryChanges`, `getAppInstallUrl` | `github-integration` |
| Machines | `listMachines`, `getMachine`, `updateMachine`, `drainMachine`, `resumeMachine`, `removeMachine`, `createJoinCode`, `getJoinCode`, `revokeJoinCode`, `getInstallCommand` | `machines` |
| Runners | `listRunners`, `getRunner`, `planRunners`, `createRunners`, `deleteRunner`, `streamRunnerLog` | `runners` |
| Jobs | `listJobs`, `getJob`, `exportJobs` | `scheduling`, `observability` |
| Images and caches | `listImages`, `getImage`, `updateImageLayers`, `rebuildImage`, `listCaches`, `wipeCache` | `runners`, `caches` |
| Doctor | `listDoctorFindings`, `runDoctor`, `getDoctorRun` | `doctor` |
| Users | `listUsers`, `addUser`, `updateUserRole`, `removeUser`, `getPreferences`, `updatePreferences` | `web-console` (this spec) |
| Settings | `getPoolSettings`, `updatePoolSettings` | `machines` |
| Notifications | `listNotificationChannels`, `createNotificationChannel`, `updateNotificationChannel`, `deleteNotificationChannel`, `testNotificationChannel` | `notifications` |
| Updates and export | `getUpdateStatus`, `checkForUpdate`, `applyUpdate`, `restartService`, `exportConfig` | `operations` |
| Audit | `listAuditEvents`, `exportAuditEvents` | `observability` |
| Stop a plan | `stopRepositoryPlan`, `stopRunnerPlan` | `github-integration`, `runners` |

**Serving and request checks (CRSP33).**

- **Transport (R5.1, D38).** `webui.Serve` looks at the address the listener is bound to (`webui.IsLoopback`: exactly `127.0.0.1` or `::1`). A loopback listener serves plain HTTP. Any other listener (a name, a LAN address, `0.0.0.0`, `::`) serves with `tlsca.Authority.ServerTLS()`: TLS 1.3 only, the certificate of the controller's own CA, and refuses to start without a certificate. A client that speaks plain HTTP to such a port gets TLS's refusal, never a page. The tray's console address and the update health probe use `http` on loopback and `https` elsewhere. The only plain-HTTP listeners left are not the console: the backup restore drill's throwaway listener on a loopback port (`internal/backup`) and the tests' `httptest` servers.
- **Headers (R6.3).** `webui.Secure` wraps the whole mux, so the console, the API and every error carry: `Content-Security-Policy` (`default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `img-src 'self' data:`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy: same-origin`, and a `Permissions-Policy` that turns the camera, microphone, location and payment off. There is no `form-action`: the App manifest form posts to GitHub.
- **Session cookie (R6.1).** `crsp_session`: `HttpOnly`, `Secure` unless the request came to `127.0.0.1` or `::1` (`auth.CookieSecure`: TLS, or a host that is not loopback), `SameSite=Lax`, `Path=/`, no `Domain`, `Max-Age` 400 days. The value is 32 random bytes, URL-safe; the database holds its SHA-256. The setup cookie has the same flags. There is no idle or absolute expiry in the code (D39); `last_seen_at` is informational.
- **CSRF token (R6.2).** The token of a session is `hex(HMAC-SHA256(key = session id, "crsp-csrf"))`. The controller keeps no copy: it computes the token from the cookie it receives. `getSession` (`GET /api/v1/me`) returns it as `csrf`; the console holds it in memory only (`apps/web/src/api/api.tsx`) and sends it in `X-CSRF-Token` on every request that is not GET or HEAD. A page on another site cannot read it, and another session's token fails. A CLI bearer token is not a browser session: it has no cookie to ride on, so it needs neither the token nor an Origin.
- **Origin (R6.2).** On a change made with a session, the `Origin` header must be there and equal the address the browser used (scheme, host and port). A change on a public operation (the setup form) is refused when it has an `Origin` that is not the console's own; a client with no `Origin` (curl, the CLI) is not a browser and passes. Reads are not checked.
- **Roles (R6.5).** `x-auth` of the contract is copied into two Go tables (`githubAreaAuth` in `handlers_auth.go`, `otherAreaAuth` in `authz.go`). `TestEveryOperationHasItsRole` fails when an operation has no entry or a different one, so the first work on a new operation is its row in a table. The gate runs before any handler: not signed in is 401; a role below `x-auth` is 403; an operation with no entry is 403. A role below the need gets 403 even where the area behind the operation is not built, so a refused request learns nothing about it.
- **No secret reaches the browser (R6.4).** The contract's response schemas hold no field named like a secret (private key, webhook or client secret, token, password, agent key), except `CliTokenCreated.token`, which goes once to the CLI that asked. The join code is `JoinCodeCreated.join_code`, shown in its wizard. Tests: section 9.

**Errors.** Every error uses the `ErrorEnvelope` of the contract. The console reads its `code`: `session_expired` opens the session-ended dialog (R5.11), `forbidden` refreshes the role, and anything else shows could-not-load with the message (UX-28).

**Data kept in the browser.** Only per-person view choices, such as the activity strip being open (component 27) and the last filter. No API data and no secret is stored in the browser.

## 8. Failure modes

| Dependency | When it fails | Fail open or closed | Why |
|---|---|---|---|
| Controller API | Could not load, with what, why and Try again (UX-28) | closed | Nothing to show without it |
| Live stream | Last data stays with its age; banner says paused; reconnect (R5.7) | open, read-only data | Old data with its age beats a blank screen |
| GitHub, at sign-in | Sign-in failed message; no session | closed | No identity without GitHub |
| GitHub, while signed in | Local screens work; repository lists show their last copy and age | open for reads | Machines and runners do not need GitHub to be seen |
| Session | Session-ended dialog; input kept (R5.11) | closed | No action without a valid session |
| Role changed mid-session | Next call gets 403; the console reloads the session and hides what the new role cannot do | closed | The server decides, not the page |
| A page fault | "This page hit a fault." with Details (UX-28) | closed | A code fault is not a lost connection |
| An agent offline | The machine shows offline with last-seen time | open | The rest of the pool keeps working |

## 9. How it is proven

A row with a path has that test. A row that says NOT YET IMPLEMENTED names the path where its test will live.

| Requirement | Kind | Test |
|---|---|---|
| R5.1 | Go test | `internal/webui/serve_tls_test.go` (a loopback listener serves plain HTTP with the R6.3 headers; a non-loopback one serves TLS 1.3 with the CA's certificate only, refuses an untrusting client, TLS 1.2 and plain HTTP, and does not start without a certificate; `IsLoopback`), `internal/cli/login_test.go` (login over http on loopback only) |
| R5.2 | Go test, Playwright e2e | NOT YET IMPLEMENTED: `internal/webui/webui_test.go` (SPA fallback), `e2e/tests/web-console/deep-link.spec.ts` |
| R5.3 | Vitest | `apps/web/src/shell/Shell.test.tsx` |
| R5.4 | Vitest, Playwright e2e | `apps/web/src/shell/Shell.test.tsx`, `e2e/tests/web-console/keyboard.spec.ts` |
| R5.5 | Vitest, Playwright e2e | `apps/web/src/shell/shortcuts.test.ts`, `e2e/tests/web-console/keyboard.spec.ts` |
| R5.6 | Vitest | `apps/web/src/live/store.test.ts` |
| R5.7 | Vitest | `apps/web/src/live/store.test.ts` (reconnect), `apps/web/src/shell/Shell.test.tsx` (paused banner) |
| R5.8 | Vitest, Playwright e2e | `apps/web/src/shell/Shell.test.tsx`, `e2e/tests/web-console/deep-link.spec.ts` |
| R5.9 | Vitest | `apps/web/src/shell/Shell.test.tsx` (return path) |
| R5.10 | Vitest, Playwright e2e | `apps/web/src/shell/Shell.test.tsx`, `e2e/tests/web-console/deep-link.spec.ts` |
| R5.11 | Vitest, Playwright e2e | `apps/web/src/shell/Shell.test.tsx`, `e2e/tests/web-console/flows.spec.ts` |
| R5.12 | Vitest | `apps/web/src/shell/Shell.test.tsx` |
| R5.13 | Vitest | `apps/web/src/screens/machines/Machines.test.tsx`, `apps/web/src/screens/repositories/Repositories.test.tsx`, `apps/web/src/screens/runners/Runners.test.tsx` (a viewer sees commands disabled with their reason) |
| R5.14 | Vitest | `apps/web/src/screens/setup/Setup.test.tsx` (the Go side stays NOT YET IMPLEMENTED: `internal/api/setup_link_test.go`) |
| R5.15 | Vitest | `apps/web/src/screens/setup/Setup.test.tsx` |
| R5.16 | Vitest, design kit guard | `apps/web/src/screens/setup/Setup.test.tsx`, `apps/web/src/screens/wizards.test.tsx` |
| R5.17 | Vitest, Playwright e2e | `apps/web/src/screens/wizards.test.tsx`, `apps/web/src/screens/machines/AddMachine.test.tsx`, `e2e/tests/web-console/flows.spec.ts` |
| R5.18 | Vitest, Playwright e2e | `apps/web/src/screens/wizards.test.tsx`, `e2e/tests/web-console/flows.spec.ts` |
| R5.19 | design kit guard | `scripts/design/wizard-behaviour.ts` driven by `apps/web/src/screens/wizards.test.tsx`, one driver per wizard; Stop on an applying plan: the `Stop on a repository plan` and `Stop on a runner plan` tests in the same file, `e2e/tests/web-console/exports-stop.spec.ts` |
| R5.20 | Vitest, Go test | `apps/web/src/screens/overview/Overview.test.tsx` (the waiting list in words); `internal/api/handlers_live_test.go` TestGetOverview (contract: `waiting`); `internal/overview/overview_test.go` TestWaitingListHasWords |
| R5.21 | Vitest | `apps/web/src/screens/repositories/Repositories.test.tsx` (extra packages: save, refuse with the line, controller refusal) |
| R5.22 | Vitest | `apps/web/src/screens/machines/Machines.test.tsx` (pool size: review and save, over the budget, lower size needs its yes, changed meanwhile, viewer), `apps/web/src/screens/wizards.test.tsx` (pool-size, the ten states) |
| R5.23 | Vitest | `apps/web/src/screens/runners/Runners.test.tsx` |
| R5.24 | Vitest, Go test, Playwright e2e | `apps/web/src/screens/jobs/Jobs.test.tsx`, `internal/api/handlers_jobs_export_test.go` (Export holds every row, newest first), `internal/store/jobs_backend_test.go`, `e2e/tests/web-console/jobs-doctor.spec.ts` |
| R5.25 | Vitest, Playwright e2e, Go test | `apps/web/src/screens/images/ImagesAndCaches.test.tsx`, `e2e/tests/web-console/flows.spec.ts`, `e2e/tests/design-layout.spec.ts`, `internal/api/handlers_caches_test.go` (the images side stays empty until milestone 2) |
| R5.26 | Vitest, Playwright e2e | `apps/web/src/screens/doctor/Doctor.test.tsx`, `e2e/tests/web-console/jobs-doctor.spec.ts` |
| R5.27 | Vitest, Playwright | `apps/web/src/screens/settings/Settings.test.tsx` (M1 sub-pages: Users and roles, Appearance, Retention, Backups); `apps/web/src/screens/settings/Budgets.test.tsx`; `apps/web/src/screens/settings/Notifications.test.tsx`; `e2e/tests/web-console/notifications.spec.ts`; `e2e/tests/web-console/flows.spec.ts` (Budgets flows); `e2e/tests/design-layout.spec.ts` (settings budgets, 360, 393, 1300 px) |
| R5.28 | Vitest | `apps/web/src/screens/settings/Settings.test.tsx` (the Go side stays NOT YET IMPLEMENTED: `internal/api/users_test.go`) |
| R5.29 | Vitest, Go test, Playwright e2e | `apps/web/src/screens/settings/ConfigExport.test.tsx`, `internal/configexport/configexport_test.go`, `internal/api/handlers_ops_test.go` (TestExportConfig), `e2e/tests/web-console/exports-stop.spec.ts` |
| R5.30 | Vitest, Playwright e2e | the question-card tests in each screen test file, `e2e/tests/web-console/flows.spec.ts`, `apps/web/src/screens/settings/Notifications.test.tsx`, `e2e/tests/web-console/notifications.spec.ts` (delete a channel) |
| R5.31 | Vitest | the loading, empty and could-not-load tests in each screen test file, `apps/web/src/screens/settings/Notifications.test.tsx` |
| R5.34 | Vitest | `apps/web/src/screens/repositories/Repositories.test.tsx` (where the jobs go, the question card, a public repository) |
| R5.35 | Vitest | `apps/web/src/shell/Shell.test.tsx` (the Overview line) |
| R5.32 | Vitest | `packages/ui/src/components/format.test.ts`, `apps/web/src/screens/settings/Notifications.test.tsx` (last test time) |
| R5.33 | Vitest, Playwright e2e | `apps/web/src/screens/machines/Recovery.test.tsx` (state in the list, the section, busy and locked action, armed, refused call, viewer); `e2e/tests/web-console/flows.spec.ts` (Agent recovery), `e2e/tests/design-layout.spec.ts`, `e2e/tests/web-console/a11y.spec.ts` (CRSP102) |
| R5.65 | Vitest | `apps/web/src/screens/machines/MachinePolicy.test.tsx` (shows the mode, battery switch and CPU cap; saves each at once; says why a machine takes no job; a pause from the tray and Resume; macOS cap off; failed cap; viewer; the Takes jobs column) |
| R5.66 | Vitest | `apps/web/src/screens/machines/AddMachine.test.tsx` (Download an installer: no file before the press, saved file name, Windows words, no-packages message) |
| R5.67 | Vitest, Playwright e2e | `apps/web/src/screens/toolbar.test.tsx` (one toolbar group with search, the Pool segmented filter, selection words, count and Add; Machines too); `e2e/tests/design-layout.spec.ts` (toolbar is one row at 1300 px; no overflow, gaps and edges at 360, 393 and 1300 px) |
| R5.68 | Vitest | `apps/web/src/screens/repositories/PublicRepositories.test.tsx` (off by default; turning on asks first with the five lines, nothing sent before the yes, Cancel; turning off names the count and shows the Done line; locked for a non-owner) |
| R5.69 | Vitest | `apps/web/src/screens/repositories/PublicRepositories.test.tsx` (Private (default) and Private & Public, linking to /settings/repositories) |
| R5.70 | Vitest, Playwright e2e | `apps/web/src/screens/repositories/PublicRepositories.test.tsx` (Visibility column, greyed public rows with reason and link, not greyed when on, disabled Turn on with reason, Problem with its two actions, Turn on the pool and Add runners); `e2e/tests/design-layout.spec.ts` and `e2e/tests/web-console/a11y.spec.ts` (repositories with public rows and the Repositories settings page at 360, 393 and 1300 px, axe in dark and light) |
| R6.1 | Go test | `internal/api/session_cookie_test.go` (flags: not Secure on loopback, Secure off loopback; 256-bit value, only the hash stored), `internal/auth/session_test.go` (cookie attributes, `CookieSecure` by address, no time expiry, no idle expiry, survives a restart). |
| R6.2 | Go test, Vitest | `internal/api/csrf_test.go` (every changing operation of the contract: no token, wrong token, no, foreign or null Origin, per-session token), `apps/web/src/api/csrf.test.tsx` and `apps/web/src/shell/Shell.test.tsx` (the console sends it) |
| R6.3 | Go test, Playwright e2e | `internal/webui/headers_test.go`; NOT YET IMPLEMENTED: `e2e/tests/web-console/no-external-requests.spec.ts` |
| R6.4 | Go test, Playwright e2e | `internal/api/no_secrets_test.go` (the contract's response schemas, and the answers of a signed-in console against the stored secrets); NOT YET IMPLEMENTED: `e2e/tests/web-console/no-secrets.spec.ts` |
| R6.5 | Go test | `internal/api/route_coverage_test.go` (x-auth on every route) and `internal/api/roles_test.go` (every operation of the contract against every role) |
| R6.6 | Playwright e2e | `e2e/tests/web-console/a11y.spec.ts` (axe, both themes, every screen of the route table in `apps/web/src/App.tsx`, read by `e2e/tests/web-console/routes.ts`) |
| R6.7 | design kit guard (Playwright) | `e2e/tests/design-layout.spec.ts` on `scripts/design/dom-layout.ts` at 360, 393 and 1300 px |
| R6.8 | design kit guard | `scripts/design/raw-controls.test.ts`, `scripts/design/no-app-css.test.ts`, `scripts/design/raw-inputs.test.ts` |
| R6.9 | design kit guard | `scripts/design/contrast.test.ts` |
| R6.10 | design kit guard | `scripts/design/design-system-follow.test.ts` |
| R6.11 | design kit guard | `packages/ui/src/components.css` (a `prefers-reduced-motion` rule); no automated check yet |
| R6.12 | Playwright e2e, Vitest | `e2e/tests/web-console/perf.spec.ts`, `apps/web/src/bundle-size.test.ts` (budgets in `apps/web/perf-budgets.json`) |
| R6.13 | Playwright e2e | `e2e/tests/web-console/offline-internet.spec.ts` (every screen of the route table, every non-controller request blocked) |
| R5.94 | Vitest, Playwright e2e | `packages/ui/src/components/Pane.test.tsx` (pane title, count, actions, heading level; Section is a pane; cursor row reverse video; tabs one row and arrow keys); `apps/web/src/screens/settings/AccessForCi.test.tsx` (form on demand, list after Set up parity); `apps/web/src/shell/Shell.test.tsx` (first repository counts); `e2e/tests/design-layout.spec.ts` (tabs one row at 1232, 1300, 393, 360 px; panes; layout at 360, 393, 1300 px); `e2e/tests/web-console/a11y.spec.ts` (every screen, dark and light) |
| R5.90 | Vitest | `apps/web/src/screens/settings/AccessForCi.test.tsx` (Access for CI list: each access with its state and never a value, the empty state, admins only; Make an access: the value shown once, a name is asked for; Revoke asks first) |
| R5.91 | Vitest | `apps/web/src/screens/settings/AccessForCi.test.tsx` (Set up parity for this repository: disabled until a repository is chosen, writes and says done, shows the guided grant when the permission is missing, drops an address that is not github.com, shows a failure); shows the address and that it answers, reports an address that does not answer, refuses with the setting named and the button waiting, shows the refusal of the action |
| R5.92 | Vitest | `apps/web/src/screens/machines/MachineDockerDisk.test.tsx` (the numbers and the state, each control saves at once, a quiet hour off the hour is kept, the administrator message and Turn off, nothing for a machine without a disk file) |
| R5.93 | Vitest | `packages/ui/src/components/Grant.test.tsx` (step states: none done, asked not accepted, all done; one action; opens only GitHub pages; re-check on focus and on a timer; ready once); `apps/web/src/screens/settings/AccessForCi.test.tsx` (one list and one action, the action moves to the installation, focus re-check then the setup runs by itself); `apps/web/src/screens/repositories/Repositories.test.tsx` (the guide for an installation that lacks a permission) |
| R5.93 | Playwright | `e2e/tests/web-console/a11y.spec.ts` (the GitHub grant part, dark and light: no serious axe violation, visible focus) |

## 10. Decisions

| ID | Question | Chosen | Date |
|---|---|---|---|
| WC-D1 | How does a fresh controller let the first user in, before a GitHub App exists? | A one-time setup link from the tray, `crsp open` or the controller's first start; `/setup` needs it (R5.14). Proposed; owner to confirm (Q11). | 2026-11-14 |
| WC-D2 | Is first run one wizard or several? | Three wizards in a checklist (Connect GitHub, Add a machine, Turn on the pool), each ending Review, work, Done (UX-30). Proposed; owner to confirm (Q10). | 2026-11-14 |
| WC-D3 | How do screens get live data? | One server-sent event stream per tab into one store (R5.6, UX-19). | 2026-11-14 |
| WC-D4 | Where are the app's routes? | Client routes with an SPA fallback in `internal/webui`; the API stays under `/api/v1`. | 2026-11-14 |

**Open owner questions.**

For the design system next version (`docs/design-system/next-version/`); this spec does not invent these rules:

- **Q1.** UX-57 names a command palette and a shortcut list, but no component describes them. Add components for the command palette and the shortcut list?
- **Q2.** No component shows a command to copy, such as the install command, with a Copy button, and content.md has no "Copy" word. Add a copyable command block and the word?
- **Q3.** No rule covers a session that ends while the user works: how the page is kept, and what the user sees. Add one?
- **Q4.** The progress bar (component 16) is for waits. Memory, CPU and slots against a budget need a level bar (a meter) with its limit marked. Add a meter component?
- **Q5.** content.md has no words for Sign in with GitHub, Sign out, Drain, Resume, Turn on, Turn off, Rebuild, Wipe, Export and Copy. Add them to the action vocabulary?
- **Q6.** No component or rule covers a one-time secret shown once with a time limit (the join code). Add one?
- **Q7.** Component 2 (top menu) does not say how eight areas fold at 360 px. Add the narrow form?
- **Q8.** UX-52 says Settings hold configuration only, but the product brief puts the audit log and config export under Settings. Allowed, or do they move?
- **Q9.** The Source paths of components 35 to 37 say `apps/web/src/ui/pickers/`, but the files are in `packages/ui/src/pickers/`. Fix in the next version?

For the product:

- **Q10.** Confirm WC-D2: first run as three wizards in a checklist.
- **Q11.** Confirm WC-D1: a one-time setup link guards first run, so nobody else on the network can claim the owner role.
- **Q12.** Answered (D39, 14 Nov): there is no idle or total lifetime. A session never expires by time; it ends at sign-out, when the user is removed, or when their role changes (R6.1).
- **Q13.** Milestone 3 in the brief lists join codes, but milestone 1 needs a first machine. Is the join code in milestone 1?
- **Q14.** Answered (D40, 14 Nov): the budgets of R6.12 are confirmed: 2 s to the first usable screen, 300 KB of first JavaScript gzipped, 2 s for a live event.
- **Q15.** The console is HTTPS on every address except loopback (D38), with a certificate the controller makes. Browsers warn on it. Accept the warning, offer a local CA to install, or let the user bring a certificate? (`operations`)
- **Q16.** Answered (D300): the variables are `RUNS_ON_LINUX`, `RUNS_ON_WINDOWS`, `RUNS_ON_MACOS`. Decision 0002 still shows an older example name.
- **Q17.** The GitHub App's callback URL is the controller address used at first run. When users open the console by another host name or IP, sign-in fails. Redirect every other host name to the first one?

## 11. Not built yet

Built by CRSP35: the jobs screen (queue with wait reasons, history on a time axis with filters, detail with the run on GitHub, Export of the filter, backed by `exportJobs`) and the doctor screen (findings by area, Run the doctor with progress) (R5.24, R5.26).

Built by CRSP37: the Budgets and Notifications sub-pages (channels, add and edit, Send test, delete with a question card), the Audit log and Config export sub-pages (with the Export button, component 29), and Stop on a repository or runner plan: the Turn on the pool and Add runners wizards offer Stop while Turning on and Registering (the shared wizard part owns the button), the step that runs finishes, no later step starts, the plan ends `stopped`, and Done says what was done and what is left (UX-30); Stop never cuts a running job.

Built by CRSP33 (transport and cookie changed by CRSP42, D38): the serving side (R5.1, R6.1 to R6.5): HTTPS with the CA's certificate off loopback and plain HTTP on it, the R6.3 headers, the session cookie (Secure off loopback), the CSRF token and Origin checks, and the role check of every operation.

Built by CRSP34: the axe check in both themes (R6.6), the performance budgets (R6.12) and the offline check (R6.13). The check found two headings on the five settings pages that are not built yet; they now show their title as a section.

Built by CRSP36: the Images and caches screen (R5.25) for caches. Built by CRSP24: the shell, the auth states, first run, the overview, repositories, machines, runners and the settings sub-pages Users and roles, Appearance, Retention and Backups (all against the M1 contract and a mocked API in tests).

**NOT YET IMPLEMENTED:**

- the Images tab has no data: milestone 1 builds no images, so `listImages` returns an empty list and `getImage`, `updateImageLayers` and `rebuildImage` answer 404 `not_found` ("Images arrive with milestone 2"); layer choice, rebuild and the image rows come with the containers of milestone 2. The Caches tab shows the per-runner tool and Rust caches only (caches R5.42); the Actions cache, git mirrors and registry mirror arrive with milestone 7, and no size history exists yet, so the size/cap meter (component 40) stands in for component 31;
- the later settings sub-pages: none (Updates is built by CRSP19; Budgets, Notifications, Audit log and Config export are built, CRSP37). The delivery of events to a notification channel is NOT YET IMPLEMENTED (notifications spec, section 11);
- Budgets: a pool change that restarts runners and names the jobs it waits for (UX-62). Today a pool default reaches only machines that join later, so nothing restarts and the page says so; the controller lists no job a pool change waits for because none does yet (machines R5.22a);
- the SPA fallback test of R5.2, the browser checks `no-external-requests.spec.ts` (R6.3) and `no-secrets.spec.ts` (R6.4);
- the controller binary does not mount the GitHub area yet (`cmd/crsp/main.go` passes no `Options.GitHub`), so nobody can sign in there: every operation that needs a role answers 401 and the sign-in operations answer 501, until the area is wired;

## 12. Code map

Source: apps/web/src/App.tsx
Source: apps/web/perf-budgets.json
Source: e2e/tests/web-console/routes.ts
Source: apps/web/src/main.tsx
Source: apps/web/src/api/api.tsx
Source: apps/web/src/api/hooks.ts
Source: apps/web/src/auth/session.tsx
Source: apps/web/src/auth/SignIn.tsx
Source: apps/web/src/live/store.ts
Source: apps/web/src/live/LiveProvider.tsx
Source: apps/web/src/shell/Shell.tsx
Source: apps/web/src/shell/shortcuts.ts
Source: apps/web/src/screens/overview/Overview.tsx
Source: apps/web/src/screens/repositories/Repositories.tsx
Source: apps/web/src/screens/repositories/TurnOnPool.tsx
Source: apps/web/src/screens/machines/Machines.tsx
Source: apps/web/src/screens/machines/AddMachine.tsx
Source: apps/web/src/screens/runners/Runners.tsx
Source: apps/web/src/screens/runners/AddRunners.tsx
Source: apps/web/src/screens/jobs/Jobs.tsx
Source: apps/web/src/screens/doctor/Doctor.tsx
Source: apps/web/src/screens/images/ImagesAndCaches.tsx
Source: apps/web/src/screens/settings/Settings.tsx
Source: apps/web/src/screens/settings/AuditLog.tsx
Source: apps/web/src/api/download.ts
Source: apps/web/src/screens/settings/Notifications.tsx
Source: apps/web/src/screens/setup/Setup.tsx
Source: packages/ui/src/index.ts
Source: packages/ui/src/components/Wizard.tsx
Source: packages/ui/src/components/TimeAxis.tsx
Source: packages/ui/src/components/Export.tsx
Source: packages/ui/src/components.css
Source: packages/contract/openapi.yaml
Source: internal/api/handlers_jobs_export.go
Source: internal/api/handlers_export.go
Source: internal/configexport/configexport.go
Source: internal/webui/webui.go
Source: internal/webui/security.go
Source: internal/webui/serve.go
Source: internal/api/authz.go
