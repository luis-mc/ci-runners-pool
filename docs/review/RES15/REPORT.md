# RES15: Jobs section, proposal

Review only. Nothing here merges. Facts about GitHub and other products are in [RESEARCH.md](RESEARCH.md). The screens are in the review build (`app/index.html`, fake data) and in `shots/`.

## 1. What the owner asked

For each job: project, branch or worktree, the elements of the job and its steps (parallel or in sequence), the runners, run time, waiting time, queue order. Crsp should also collect job sequencing and timing, learn to forecast job and step durations, and show the data.

Binding product model: top menu Overview, Shared Pool, Repositories, Jobs, Doctor, Settings. Jobs = queued, running and done, with a limited number of done jobs. Sub-sections: by repository, machine, runner, runner type, job type, and charts. The user never picks a repository for a runner.

## 2. Information model

The hierarchy is **run, then job, then step**, and every screen says which level it shows. A GitHub workflow run has several jobs, and each job has steps. So the lists show **one row for each workflow run**; a run opens (in place, or on its own page) to its jobs as a waterfall; a job opens to its steps. The breadcrumb of the Job page is `Jobs / repository / run #N, attempt A / job`.

```
Run (workflow run, GitHub run id)
 └─ Attempt (run_attempt 1..n; a re-run is a new attempt of the same run)
     └─ Job (GitHub job id; one row in job_history today)
         └─ Step (number, name, start, end, result)
Run ──needs──> edges between the jobs of one run (from the workflow file)
Job key = repository + workflow file + job name + matrix values   (the unit the forecast learns on)
```

| Level | Fields shown | Where crsp gets them |
|---|---|---|
| Run | repository, workflow, event, branch, commit, pull request, actor, attempt, created, result, total wall time, critical path | `workflow_run` webhook; `gh_jobs` (head_branch, event) |
| Job | job name, matrix values, labels, state, result, runner name and kind, machine, backend, isolation, queued at, slot at, started, completed, GitHub wait, slot wait, run time, clean-up time, queue position, wait reason and text, cache warm or cold | `workflow_job` webhook; scheduler (gate, slots, wait reason); agent hooks (job-started, job-completed) |
| Step | name, number, start, end, result, forecast | `workflow_job` webhook `steps[]` on `completed` (and `in_progress` updates); optional hook marks |
| Needs | which job waits for which | the workflow file at `head_sha` (one read per sha), else only "parallel in time" is drawn |
| Worktree / task | text the job reports, shown as "reported by the job" | env var or label through the hook; the delivery task id parsed from the branch name (`RES15-jobs-section`) |

Worktree is not visible to GitHub. Display (decision 6): the branch always; the task id, read from the branch when it starts with one (`RES15-jobs-section` gives task RES15); the worktree only when the job reports it, otherwise "not reported". Never guess a worktree path.

## 3. What each screen shows, and why

Queue, Running and Done list **runs**. A `Runs | Jobs` switch above each list keeps the flat job list for filtering by runner, machine and job kind (a group row that filters by those opens the Jobs view). A run row ends with an **Open run** button: it opens the run in place, as a waterfall of its jobs (queue wait light, run dark, forecast bracket for what is unfinished); a job opens to its steps. The run name links to the Run page.

| Screen | Row and columns | Why |
|---|---|---|
| Queue, Runs | one row for each run that has jobs waiting: place in line, repository, workflow and run number, branch (task), commit and event or pull request, jobs queued of all, start range ("in about 4 to 7 min"), why it waits | the first question is "when does my run start, and why not now" |
| Queue, Jobs | the waiting jobs in order: place, repository, workflow and job, branch, forecast, "starts in about 4 to 7 min, 3rd in line", why it waits | the same, one job at a time |
| Running, Runs | repository, workflow, branch, commit and event, jobs done of all (7 of 9), the job running now, time so far, end forecast (one number), result | "is it stuck or just slow" |
| Running, Jobs | job, runner and machine, the step now, progress against the forecast, run time, forecast | the step level |
| Done, Runs | finished, repository, workflow, branch, commit and event, jobs done of all, total time, slowest job, result | recent outcomes at a glance |
| Done, Jobs | finished, repository, workflow and job, branch, runner and machine, waited, ran, forecast, status | for filtering by runner, machine and kind |
| By repository / machine / runner / runner type / job type | one table per grouping: running, queued, done, failed, average wait, average run, trend sparkline; runner type adds the backend, job type adds a light or heavy badge | find where time goes without picking a repository for a runner |
| Charts | durations and waits over time (median and slow end), jobs per day, forecast vs actual, busiest hours; 14 days first, switch to 7 or 30; a button exports the daily summaries as CSV | learn the pool's rhythm, check the forecast earns trust |
| Run page | breadcrumb, facts (repository, branch, task, worktree, commit and event, started, end forecast with its basis), the job graph (and where its arrows come from), the jobs as a waterfall | parallel vs sequence at run level |
| Job page | breadcrumb `Jobs / repository / run #N, attempt A / job`, project and code, attempts, the run's job graph with this job marked, steps as a waterfall ("from GitHub"), runner, times, queue place and start range, forecast as a range with its basis, history of the job | one place to answer "what happened to this job" |

Tables show **one number** ("about 7 min"), times in compact words ("1 min 19 s"), and a long branch cut in the middle (`RES15-jobs…ection`) with the full name on hover and in the detail; no table scrolls the page sideways at 1300 px (the layout spec checks it at 360, 393 and 1300 px). The Job and Run pages show a **range with its basis** ("about 6 to 9 min, median of the last 20 runs on linux-box").

Design rules used: UX-29 wait reasons, UX-33 time axis, UX-41 charts with a text alternative, UX-49 no sideways scroll, UX-57 keyboard, UX-58 status as word, glyph and colour. Shared parts: Waterfall, Job graph, Trend chart, Sparkline, Heatmap, Forecast chart (components 49 to 54), and new in this round Short text (55), a table row that opens in place (component 15, `detail`) and a view switch without All (component 12). All are in `next-version`, with `CHANGES` C114 to C116 and words in `content.md`.

## 4. Forecast method (first version)

One explainable rule. No model training, no black box.

1. **Key.** Job key = repository + workflow + job name + matrix values. Step key = job key + step name.
2. **Sample.** The last 30 successful attempts of that key, no older than 90 days (cancelled, failed-early and `lost` attempts are left out; a timeout is stored apart and never lowers the forecast). Prefer the same machine class when it has at least 5 samples, else all.
3. **Point.** Median of the run time.
4. **Range.** p25 to p90 of the same sample, widened so it is never narrower than plus or minus 10 percent of the median. Said as "about 6 to 9 min".
5. **Fallback chain.** job key (5 or more samples), else workflow median for the same job name, else repository median, else "not enough history yet" (no number is invented).
6. **Run ETA.** Longest path (critical path) over the needs graph using each job's forecast; the range is the sum of p25 values (low) to the sum of p75 values (high) along the path, marked "about" (a heuristic; Monte Carlo over the history is a later step).
7. **Queue ETA.** Simulate the machine slots: each running job frees its slot at its forecast end; a queued job takes the first free slot in queue order and ends one median later. Reported as a range using the lows and highs of the jobs ahead. This is the Little's-law view, made concrete.
8. **Drift.** If the median of the last 10 differs from the median of the 20 before by a ratio above 1.25 or below 0.8 (and by more than 3 MAD of the older window), mark the forecast "changed lately" and use the last 10.

Later, only if the first version is not good enough: condition on machine, backend, runner kind and cache warm or cold; EWMA; quantile regression; Page-Hinkley drift test; critical-path ETA that learns step overlap. Each is a change to one function; the screens already show the basis ("median of the last 30 runs on this machine") so a better method does not change the layout.

Forecast vs actual (the Charts tab) is the honesty check: it shows how many finished jobs landed inside the range. Aim: about 80 percent.

## 5. Where the data is stored

Controller SQLite, same database as `job_history` (migration 00007) and `gh_jobs` (00006). Proposed new tables:

| Table | Key | Columns | Kept |
|---|---|---|---|
| `job_steps` | (job_history_id, number) | name, started_at, completed_at, result | as `job_history` (90 days default) |
| `job_needs` | (repository_id, run_id, job_name, needs_job_name) | none | as `job_history` |
| `job_history` (add columns) | existing | `job_key`, `head_branch`, `event`, `pull_request`, `runner_kind`, `cleanup_ms`, `cache_state`, `task_id`, `worktree_reported`, `attempt_of` | 90 days default, floor 7, ceiling 400 |
| `job_key_daily` | (job_key, day) | n, median_run_ms, p90_run_ms, median_wait_ms, failures | 400 days |
| `forecast_log` | (job_history_id) | forecast_lo_ms, forecast_mid_ms, forecast_hi_ms, basis, samples | as `job_history`; lets Charts compare forecast with actual |

`job_key_daily` keeps the long view small (one row per key per day) after raw rows leave. Steps are the largest table: about 12 steps per job; at 1,000,000 job rows that is 12,000,000 step rows. Proposal: keep step rows 30 days, job rows 90 days, daily aggregates 400 days (see open question 2).

## 6. API contract additions (proposal; not in `openapi.yaml`)

| Call | Change |
|---|---|
| `listJobs` | new query: `runner_id`, `runner_kind`, `job_key`, `branch`, `cursor`; new fields on `Job`: `head_branch`, `event`, `pull_request`, `job_key`, `matrix`, `runner_kind`, `queue_position`, `cleanup_seconds`, `task_id`, `forecast {lo, mid, hi, basis, samples}` |
| `getJob` | adds `steps[]` (name, number, started_at, completed_at, result, forecast), `attempts[]`, `needs[]` (job ids), `history[]` (last 30 run times of the job key), `critical_path` |
| `getRun` (new) | `GET /api/v1/runs/{id}`: attempt list, jobs, needs edges, total, critical path |
| `getJobStats` (new) | `GET /api/v1/jobs/stats`: per day waits and run times, per weekday and hour counts, forecast-vs-actual points, filtered like `listJobs` |
| `getForecast` (new) | `GET /api/v1/forecast?job_key=`: the forecast and its basis for one key (used by the workflow-file linter and the CLI) |

All read-only, viewer role (observability R6.4). The review build serves these from fixtures through a mock fetch.

## 7. Privacy

Stored: repository, workflow file name, job name, matrix values, step names, branch name, commit sha, pull request number, timings, runner and machine names. Never stored: logs, environment values, secrets, commit messages, actor email. Step names can contain text a workflow author wrote; they are shown as text and never as markup. Retention follows observability R6.8; everything stays on the owner's machines (R6.7).

## 8. Review build

Open `docs/review/RES15/index.html`. The app opens from `app/` with `python3 -m http.server`, no controller. All data is fake and generated from a fixed seed; the production console never loads it. Routes: `#/jobs` (Queue), `/jobs/running`, `/jobs/done` (add `?view=jobs` for the flat job list), `#/jobs/repository`, `/machine`, `/runner`, `/runner-type`, `/job-type`, `/charts`, `#/jobs/<id>`, `#/jobs/run/<id>`. One finished run (the third with 4 or more jobs) has an unreadable workflow file, to show the timing fallback. Other top-menu areas open with fake pool data so the frame is real.

## 9. Owner decisions (18 Nov 2026)

All binding. Each is built in the review build.

**A. Runs versus jobs.** A CI run has several jobs, so Queue, Running and Done list **one row for each workflow run**: repository, workflow, branch (and task id), commit, event or pull request, started, total time so far or total, jobs done of all (for example 7 of 9), slowest or current job, result. A row opens in place (and the run name opens the Run page) to its jobs as a waterfall, and each job opens to its steps. A `Runs | Jobs` switch keeps the flat job list for filtering by runner, machine and kind. Queue rows show the run's queued jobs, its place in line and its start range. The run, job, step hierarchy is named everywhere, with the breadcrumb `Jobs / repository / run #N, attempt A / job` on the Job page.

1. **Done list.** Keep 90 days; show 25; "Show 25 more" up to 100 a page; older runs by range (7, 30, 90 days) and filter.
2. **Retention.** Steps 30 days, jobs 90, daily summaries 400. Said in the Done, Charts and group footers.
3. **Job graph.** From the workflow file (`needs`), read once per commit and cached. A matrix or a reusable workflow is marked "expands at run time". When the file cannot be read, the graph falls back to the overlap of the jobs in time, with a note that it is a guess.
4. **Forecast wording.** A range with its basis on the Job and Run pages ("about 6 to 9 min, median of the last 20"); one number in tables ("about 7 min").
5. **Step times.** From the GitHub job events now ("Step times are from GitHub"); hook marks later.
6. **Branch, task, worktree.** Branch always; task id when the branch starts with one; worktree only when the job reports it, else "not reported".
7. **Under 5 runs.** "not enough history yet", plus the workflow's or the repository's typical time, labelled ("workflow typical about 4 min").
8. **Queue.** A start range from the free slots and the jobs ahead ("starts in about 4 to 7 min, 3rd in line"), plus why it waits.
9. **By runner** is each runner name. **By runner type** is persistent versus ephemeral, with the backend (docker, wsl2, hyperv) as a column.
10. **By job type** is the job name without matrix values, with a light or heavy badge.
11. **Charts.** 14 days first, a switch to 7 or 30.
12. **Export.** CSV of the filtered list (Done, runs or jobs) and of the daily summaries (Charts). In the review build the buttons download the fake data.
13. **Replacement.** The new section replaces today's Jobs screens when it is built (the old routes redirect). This is a build step after approval; nothing in the production console changes now (the review build is a flag of its own entry).

Table fixes in the same round: one number per forecast cell, a branch cut in the middle with the full name on hover and in the detail, compact times, and no sideways scroll at 1300 px.

## 10. RES17: one row pattern in every Jobs list (owner report 18 Nov 2026, 23:08)

The owner saw the same action under three names (Jobs, Open runs, Open jobs), a button that wrapped on two tabs, and run rows 89 to 130 px high. Measured at 1300 px before the fix: Queue, Running and Done said *Jobs* (44 px); By repository *Open runs*; By machine and By runner *Open jobs*; By runner type and By job type *Open jobs* at 46 px (wrapped); run rows were 89 to 130 px, the jobs lists up to 214 px.

**Design-system entries.** Rule **UX-72** (ux-rules.md): table rows are one line on desktop, long text is cut with its full text on hover and in the detail, a row action uses the same words for the same action in every list. Component **56** `RowAction` and the Table props `action` and `oneLine` (components.md 15, 56); tokens `--ds-row-action-width` (8rem) and `--ds-cell-max` (12ch); the table *Row action words* in content.md. CHANGES **C117** and **C118**. No app CSS: every list passes data to the shared Table.

**Words.** content.md had no rule on these words, only the entries *Open jobs* (group row) and *Open the run*, which this round replaces. So: a run row *Open run* (it opens the run in place; inside the opened run *Open run page* goes to the Run page), a group row *Open* (the group name is already in the row; a screen reader hears *Open: runner-1*), a job row *Open job*. The "Not placed yet" group opens the queue.

**What changed in the lists.**

- One action column of fixed width (`--ds-row-action-width`), label on one line, 44 px high, in every list (Queue, Running, Done in Runs and Jobs view; the five group tables). At 393 px it is the last, full-width line of each card, in the same place in every card.
- Every row of every list is 69 px high at 1300 px (one 44 px button line plus the cell padding). A cell is one line cut at 12 characters with an ellipsis; its full text is the hover text; the branch, the workflow, the job and the running job keep their full text in `title`.
- Times are compact (*1 min 19 s*); the Done *Finished* column reads *18 Nov 13:28* (full date in the detail, in the Job and Run pages).
- *Slowest job* reads *duration, job* so the cut never hides the time. *Commit and event* is one short cell, never stacked.
- The *Why* button sits inline at the right of its cell.

**RES17 consistency fixes** (the same class of defect on the other Jobs screens):

1. Queue, Running and Done run rows: *Jobs* became *Open run*.
2. By repository: *Open runs* became *Open*. By machine and By runner: *Open jobs* became *Open*. By runner type and By job type: *Open jobs* (wrapped, 46 px) became *Open* (44 px, one line). The column head *Jobs* of those tables went; the action column has no visible head.
3. Jobs view (Queue, Running, Done) had no row button, only a row that opened on Enter or double click and a link in the name: each row now ends with *Open job*.
4. Opened run: *Open the run* became *Open run page* (it no longer repeats the row's own word).
5. Jobs view, desktop width: the tables were 1340 to 1825 px wide and scrolled the page sideways. Four columns that the same facts also give elsewhere are no longer in the table: Queue jobs *Forecast* (the *Starts* column says it), Running jobs *Waited* and *Forecast* (the *Progress* label says the forecast; the Job page has both), Done jobs *Forecast* (Charts has forecast against actual). They stay on the Job page.
6. A run row opened in place no longer widens the page (the opened row wraps its text).
7. Group rows without a runner (*not placed yet*) had no button and a shorter card; they now open the queue, so the cards of one list are alike.
8. Dates in the Done tables use the short form; the Job and Run pages keep the full form.

**Guard.** `e2e/tests/review/review-layout.spec.ts` (UX-72), for every Jobs screen, the Job and Run pages and Charts, at 1300 px: (a) a row in a table body is taller than one line plus padding, or rows of one table differ in height; (b) a head or a button in a table is taller than the button token (wraps); (c) a button label is not a word of the *Row action words* table of content.md. At 393 px: the action of every card of a list sits at the same place and size. It failed on the previous build (first run: Queue, Running, Done, group and job tables, 130 px rows, labels *Jobs*, *Open runs*, *Open jobs*, wrapped *Open jobs*) and passes on this one.

## 11. RES18 column widths (owner report, measured at 1220 px after RES17)

**Problem.** After RES17 every column of the Done table was about 110 px wide, so short values were cut ("aedf79f, p…", "Release #8…") and nothing gained.

**Fix, in the shared table part (`packages/ui`, component 15), not per screen.**

1. Every column of a one-line table is `fit` or `grow` (`kind`; default: grow for long text, else fit). Fit: as wide as its widest value or head, one line, never cut (dates, times, counts, result, short ids, the row action). Grow: shares the width that is left, at least `--ds-cell-grow-min` (6rem, replaces `--ds-cell-max`), cut with an ellipsis, full text on hover. Repository, workflow, branch, job name, runner and machine, why it waits, running now, slowest job are grow.
2. Branch cut in the middle (`middle`: the start and the last six characters stay, "fix/co…-cache"). New part `Cut`: a name cut at its start with a fixed end, used for the workflow (`Docs … #8133`, the number never cut), the job in the Jobs view (`CI / lint, attempt 2`) and the slowest job (`docs-che…, 39 s`: name first, time never cut).
3. *Commit and event* split into *Commit* (fit, 7 characters) and *Event* (fit: push, PR #87, schedule). Both sort. The Run page keeps one line, Commit and event.
4. Measured at 1300 px (the page content is at most 1168 px wide, so 1220 px is the same layout), Done runs: Finished 109, Repository 136, Workflow 130, Branch 130, Commit 75, Event 83, Jobs done 92, Slowest job 147, Result 104, action 128. Queue runs: Place 52, Repository 152, Workflow 146, Branch 146, Commit 75, Event 83, Starts 176, Why it waits 177. Before: every column 90 to 147.

**Columns that went into the detail** (so that no fit value is cut and no table scrolls sideways at 1300 px):

| Table | Column moved | Where it is now |
|---|---|---|
| Done runs | Total time | opened run: "Total time: ..." |
| Running runs | Time so far | opened run: "Time so far: ..." |
| Queue runs | Jobs queued | opened run: "Jobs: x of y done, z queued" |
| Queue jobs | Waited | Job page (it has Waited) |

Least useful because each is also on the Run or Job page and none is needed to pick a row. Result, Commit, Event and Slowest job stay.

**Where it applies.** Every table that uses the shared Table with `oneLine`: Queue, Running, Done in Runs and Jobs view, By repository, machine, runner, runner type, job type. Charts, the Run page jobs and the Job page steps have no table; they draw the waterfall and the chart parts, which do not use column widths.

**Guard** (`review-layout.spec.ts`, UX-72), now at 1300 and 1220 px: fails when a fit cell is cut (an element that can cut, with scrollWidth over clientWidth), when a table ends past its pane or the page scrolls sideways, plus the RES17 checks (one line, one row height, head and button do not wrap, button words). Shown to fail at 800 px ("the table needs sideways scroll"). Unit tests for the kind logic, the middle cut and the kind attributes: `packages/ui/src/components/TableExpand.test.tsx`.

**Docs.** UX-72 reworded ("short values never cut; only long names are cut"), components.md 15 (column kinds, `Cut`), tokens.md, content.md (Commit, Event), CHANGES C119, all in `docs/design-system/next-version/`. The production console is unchanged. App and all 88 shots rebuilt (1300 and 393 px, Phosphor dark and light).

**Human check left.** Grow columns share the rest equally, so a long repository name ("ci-runners-sh…") is still cut at about 130 px; the full name is on hover and in the detail. Say if repository should get a wider share.
