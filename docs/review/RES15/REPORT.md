# RES15: Jobs section, proposal

Review only. Nothing here merges. Facts about GitHub and other products are in [RESEARCH.md](RESEARCH.md). The screens are in the review build (`app/index.html`, fake data) and in `shots/`.

## 1. What the owner asked

For each job: project, branch or worktree, the elements of the job and its steps (parallel or in sequence), the runners, run time, waiting time, queue order. Crsp should also collect job sequencing and timing, learn to forecast job and step durations, and show the data.

Binding product model: top menu Overview, Shared Pool, Repositories, Jobs, Doctor, Settings. Jobs = queued, running and done, with a limited number of done jobs. Sub-sections: by repository, machine, runner, runner type, job type, and charts. The user never picks a repository for a runner.

## 2. Information model

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

Worktree is not visible to GitHub. Honest display: show the branch always; show a task or worktree only when the job reported it or the branch matches `<TASK>-<slug>`; otherwise write "not reported". Never guess a worktree path.

## 3. What each screen shows, and why

| Screen | Shows | Why |
|---|---|---|
| Jobs home, Queue | queue order (1, 2, 3), repository, job, branch, why it waits (gate reason, UX-29), waited so far, forecast start range | the first question is "when does mine start, and why not now" |
| Jobs home, Running | job, repository, branch, runner and machine, current step and its progress against the forecast, run time so far, forecast end range | "is it stuck or just slow" |
| Jobs home, Done | last 25, "Show more" adds 25, up to the kept limit; result, waited, ran, forecast vs actual | recent outcomes at a glance, bounded list |
| By repository / machine / runner / runner type / job type | one table per grouping: running, queued, done, failed, median wait, median run, p90 run, trend sparkline | find where time goes without picking a repository for a runner |
| Charts | durations and waits over time (median and range), forecast vs actual, busiest hours (weekday x hour) | learn the pool's rhythm, check the forecast earns trust |
| Job page | project, branch and commit, pull request, worktree or task when known, run and attempt (switch attempts), job graph with this job and the critical path marked, steps as a waterfall with forecast per step, runner, machine, backend, runner kind, timings (queued at, waited and why, started, ran, clean-up), queue position and ETA range, history of this job key, GitHub links | one place to answer "what happened to this job" |
| Run page | all jobs of one run as a waterfall (queue wait lighter, run darker), the graph, run total and critical path | parallel vs sequence at run level |

Design rules used: UX-29 wait reasons, UX-33 time axis, UX-41 charts with a text alternative, UX-49 no sideways scroll, UX-57 keyboard, UX-58 status as word, glyph and colour. New shared parts: Waterfall, Job graph, Trend chart, Sparkline, Heatmap, Forecast chart (components 49 to 54 in `next-version`).

## 4. Forecast method (first version)

One explainable rule. No model training, no black box.

1. **Key.** Job key = repository + workflow + job name + matrix values. Step key = job key + step name.
2. **Sample.** The last 20 successful attempts of that key (cancelled, failed-early and `lost` attempts are left out; a timeout is counted apart and never lowers the forecast). Prefer the same branch kind (main vs other) when it has at least 5 samples, else all.
3. **Point.** Median of the run time.
4. **Range.** p25 to p90 of the same sample, widened so it is never narrower than plus or minus 10 percent of the median. Said as "about 6 to 9 min".
5. **Fallback chain.** job key (5 or more samples), else workflow median for the same job name, else repository median, else "not enough history yet" (no number is invented).
6. **Run ETA.** Longest path (critical path) over the needs graph using each job's forecast; the range is the sum of the path's lows and highs, then trimmed (sum of p25s is too low, so use root-sum-square of half-widths around the sum of medians).
7. **Queue ETA.** Simulate the machine slots: each running job frees its slot at its forecast end; a queued job takes the first free slot in queue order and ends one median later. Reported as a range using the lows and highs of the jobs ahead. This is the Little's-law view, made concrete.
8. **Drift.** If the median of the last 10 differs from the median of the 20 before by more than 25 percent, mark the forecast "changed lately" and use the last 10.

Later, only if the first version is not good enough: condition on machine, backend, runner kind and cache warm or cold; EWMA; quantile regression; Page-Hinkley drift test; critical-path ETA that learns step overlap. Each is a change to one function; the screens already show the basis ("median of last 20 on main") so a better method does not change the layout.

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

Open `docs/review/RES15/index.html`. The app opens from `app/` with `python3 -m http.server`, no controller. All data is fake and generated from a fixed seed; the production console never loads it. Routes: `#/jobs` (Queue, Running, Done), `#/jobs/repository`, `/machine`, `/runner`, `/runner-type`, `/job-type`, `/charts`, `#/jobs/<id>`, `#/jobs/run/<id>`. Other top-menu areas open with fake pool data so the frame is real.

## 9. Open questions for the owner

Each has a recommendation; the first option is it.

1. **How many done jobs to keep and show?** (a) Keep 90 days of rows, show 25, "Show more" up to 100 per page, older ones by filter and range. (b) Keep and show the last 100 only (the current spec, D34). (c) Keep 400 days, show 25 at a time with no cap. Recommendation: (a).
2. **How long to keep step rows?** (a) 30 days of steps, 90 of jobs, 400 of daily aggregates. (b) Steps as long as jobs (90). (c) Keep no steps, show them live from GitHub only. Recommendation: (a).
3. **Fetch the workflow file to draw the graph?** (a) Yes, one read per head sha, cached; jobs with `needs` draw as a graph, dynamic matrix and reusable workflows are marked "expands at run time". (b) No; draw only what happened in time (jobs overlapping = parallel). (c) Ask per repository in Settings. Recommendation: (a), with (b) as the fallback when the read fails.
4. **Forecast: a range or one number?** (a) A range with the basis ("about 6 to 9 min, median of the last 20"). (b) One number. (c) A range on the job page, one number in tables. Recommendation: (c) is nearest to (a); the review build shows (a) everywhere so you can judge.
5. **Where do step times come from?** (a) The GitHub `workflow_job` webhook steps (free, no job change, second precision). (b) A hook mark per step (finer, needs workflow changes, only crsp runners). (c) Both, hook wins when present. Recommendation: (a) now, (c) later.
6. **How is the worktree shown?** (a) Branch always; task id when the branch name starts with a task id; worktree only when the job reports it; else "not reported". (b) Branch only. (c) Require every job to report a worktree label. Recommendation: (a).
7. **Cold start with no history?** (a) Say "not enough history yet" until 5 runs; use workflow or repository medians in between, labelled. (b) Always show a number from the repository median. (c) Show nothing until 20 runs. Recommendation: (a).
8. **Should the forecast be shown before a job starts (queue ETA)?** (a) Yes, a start range from slots and jobs ahead. (b) Only the wait reason, no time. Recommendation: (a), because the owner asked for queue order and waiting time.
9. **Runner and runner type grouping:** (a) By runner = one row per runner name; by runner type = persistent vs ephemeral, with backend as a second line. (b) Runner type = backend (docker, wsl2, hyperv). (c) Both as filters on one table. Recommendation: (a), backend is a column.
10. **Job type = what?** (a) Job name with matrix values removed (test, build, lint). (b) Light vs heavy (scheduler classes). (c) Label set. Recommendation: (a), with light and heavy as a badge.
11. **Charts range:** (a) 14 days, switch to 7 or 30. (b) 30 days fixed. Recommendation: (a).
12. **Should the data be exportable?** (a) CSV of the filtered list (already planned, R5.14) plus the daily aggregates. (b) The list only. Recommendation: (a).
13. **Where does the Jobs section replace the current one?** (a) Replace the current Jobs screens once approved, keep the old routes redirecting. (b) Run both for one release. Recommendation: (a).
