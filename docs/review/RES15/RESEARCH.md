# RES15: Jobs section, job timeline and forecasts

Research for the console Jobs section of crsp (ci-runners-shared-pool). Date: 2026-11-18.

Goal: per job show the project, the branch or worktree, the steps (parallel and in sequence), the runners used, run time, waiting time and queue order. Also collect job history so crsp can forecast how long a job and each step will run.

How to read this file:

- "crsp spec" means a file in this repo. Each such claim names the file and section.
- A web claim has a link. A claim marked **not verified** was not confirmed on the page in this research run (the search tool gave a summary, not the full page).
- Where I write from background knowledge of the GitHub docs, I say so and give the doc link to check.

---

## 0. Summary

1. GitHub gives crsp most of what the Jobs page needs: job state, step list with times, runner name, labels, branch, commit. The webhooks cost no API quota. REST fills gaps and costs quota.
2. GitHub does not give the dependency graph (`needs`), the matrix source, or a worktree. The workflow file gives `needs` and `strategy.matrix`. Dynamic matrices and reusable workflows limit what the file can say. The reliable fallback for "parallel or sequence" is the real start and end times of the jobs.
3. Only crsp knows the slot wait, the wait reason, the machine, the backend, the runner kind and the clean-up. These are the unique value of the Jobs page.
4. Worktree: show the branch from GitHub. Show a worktree name only when the job reports it, and label it "reported by the job".
5. Forecast, first version: for each job key, take the last 30 successful runs on the same machine class, show the median, and show a range from the 25th to the 90th percentile. Fall back from job to workflow to repo to global. Show "not enough history" under 5 runs. Details in section 3.8.
6. The leading CI tools agree on a small set of views: a per-run waterfall, a per-job trend with p50 and p95, a critical-path highlight, and wait time shown apart from run time. Section 2.9 lists 12 patterns.

---

## 1. (a) Data that exists per job

### 1.1 What crsp already has

The Job schema (`packages/contract/openapi.yaml`, schema `Job`, around line 6170, "One job attempt (observability R5.7, R5.8)") already carries:

| Field group | Fields |
|---|---|
| Identity | `id`, `repository`, `repository_id`, `run_id`, `run_attempt`, `github_job_id`, `workflow`, `job_name`, `head_sha`, `trigger`, `labels` |
| State | `state` (queued, running, done), `wait_reason`, `wait_text`, `result` |
| Placement | `machine_id`, `runner_id`, `runner_name`, `backend`, `isolation` |
| Times | `created_at`, `queued_at`, `slot_at`, `started_at`, `completed_at` |
| Durations | `github_wait_seconds`, `slot_wait_seconds`, `run_seconds` |
| Link | `html_url` |

What the Job schema does not have, and the Jobs section needs:

- No branch name (`head_branch`). Only `head_sha` and `trigger`.
- No steps.
- No `needs` or matrix information.
- No queue position.
- No pull request number.

The spec for the Jobs screen (`docs/features/web-console/spec.md` section 4.6) lists: a queue table with repository, labels, wait time and reason; a history list with repository, workflow, job name, result, machine, backend, wait, run time; a tab row (All, By repository, By machine, By runner type, By job type, Wait and duration); a detail view with a link to the run on GitHub. It says "No command changes a job". It keeps the last 100 finished jobs on screen and the last 200 for the grouped tabs. It does not show steps, branch, a graph or a forecast. Section 4.6 names the milestone as "later (milestone 2)".

The observability spec (`docs/features/observability/spec.md`, section 5 "Job history") says:

- R5.7: one history row per job attempt, keyed by repository, run id, run attempt, job id.
- R5.8: wait time is `created_at` to `started_at`, split into GitHub wait and slot wait. Run time is `started_at` to `completed_at` minus the slot wait inside "Set up job", so the gate is counted once.
- R5.9: a duration is never negative. A missing or zero time gives "unknown", never 0. A re-run counts from its own attempt start.
- R5.10: result is success, failure, cancelled, timed out, lost. `startup_failure` and `timed_out` count as failure in totals.
- R5.12: a finished row never changes and is never fetched again.
- Retention: R5.32 and the limits in R6.8 (I did not open R6.8; **not verified** what the limits are).

These timing rules matter for forecasting: the run time already excludes the gate wait, so the forecast does not mix queueing with working.

### 1.2 GitHub webhooks: `workflow_job` and `workflow_run`

Official reference: [Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_job). The search tool returned older Enterprise Server copies and the octokit schema, not the current page, so the table below mixes confirmed and background facts.

Confirmed in this run:

- `workflow_job` is sent on state transitions. The action takes `queued`, `in_progress`, `completed`, and later GitHub added `waiting` for jobs held by an environment protection rule ([GitHub changelog, environment protection webhooks](https://github.blog/changelog/2022-11-21-webhook-enhancements-for-environment-protection-rules)).
- `labels` holds the labels from `runs-on` ([octokit workflow-job schema](https://github.com/octokit/webhooks/blob/b6bad6afd6482eb5700e8c41eaf5d96bbd1536a9/payload-schemas/api.github.com/common/workflow-job.schema.json)).
- `runner_id`, `runner_name`, `runner_group_id`, `runner_group_name` are null while the job is queued (same schema).
- A job with an `environment` also carries a `deployment` object (same changelog).

From background knowledge, to check against the current docs page (**not verified in this run**): the `workflow_job` object has `id`, `run_id`, `run_attempt`, `workflow_name`, `head_branch`, `head_sha`, `status`, `conclusion`, `created_at`, `started_at`, `completed_at`, `name`, `steps[]`, `check_run_url`, `html_url`, `labels`, and the runner fields. Each step has `name`, `number`, `status`, `conclusion`, `started_at`, `completed_at`. The `workflow_run` object has `event`, `head_branch`, `head_sha`, `pull_requests`, `run_attempt`, `run_started_at`, `created_at`, `updated_at`, `conclusion`.

Facts that crsp's own spec confirms about this payload:

- A job read from a `workflow_job` webhook "does not say which event started its run or whether the head repository is a fork", so crsp marks it partial and waits for the poller (`docs/features/github-integration/spec.md` section 5.8, R5.48). So the branch and event may need the `workflow_run` event or REST.
- crsp takes `workflow_job` events (queued, in_progress, completed), checks `X-Hub-Signature-256` and ignores a repeat delivery id (github-integration R5.36).
- Webhooks are optional. By default the App is made without a webhook and crsp learns jobs by polling, up to 15 s late (github-integration R5.51, owner decision D89).
- Webhook health per repository is tracked, with `ok`, `failed`, `missed` (github-integration R5.50, RES14).

Practical points about webhooks:

| Point | Effect on the Jobs page |
|---|---|
| Each state change is a delivery | queued, in_progress, completed give three timestamps without any REST call |
| Step list is in the `in_progress` and `completed` payloads (background; not verified per action) | step times can be stored from the `completed` delivery with no REST call |
| Deliveries can be lost or arrive out of order | crsp must key by GitHub job id, make writes idempotent, and reconcile (github-integration R5.38 reconciles every 5 min; scheduling R5.53 says the same job twice is one record) |
| Webhooks cost no API quota | prefer webhooks for history; use REST only to repair |

### 1.3 GitHub REST endpoints

Official reference: [REST API endpoints for workflow jobs](https://docs.github.com/en/rest/actions/workflow-jobs) and [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs).

| Endpoint (path under `/repos/{owner}/{repo}/actions`) | Gives | Confirmed |
|---|---|---|
| `GET /runs` | runs of a repo, filters by branch, event, status | background; not verified |
| `GET /runs/{run_id}` | one run with `run_attempt`, event, branch, PRs | background; not verified |
| `GET /runs/{run_id}/jobs` | jobs of the latest attempt, `filter=latest` or `all` | background; not verified |
| `GET /runs/{run_id}/attempts/{n}/jobs` | jobs of one attempt; page size max 100, default 30 | [confirmed by search summary](https://docs.github.com/en/rest/actions/workflow-jobs) |
| `GET /jobs/{job_id}` | one job with steps | background; not verified |
| `GET /runs/{run_id}/timing` | run duration and billable ms | background; **not verified**. It may be deprecated or limited for self-hosted runners; I could not confirm. crsp should not depend on it |

The job object in the REST answer has `started_at`, `completed_at`, `status`, `conclusion`, `runner_name`, `runner_id` (confirmed from the example in the docs summary).

crsp already uses REST in two places:

- Poller: lists queued and in-progress runs and their jobs with `If-None-Match`, default 30 s, and respects the rate budget of R6.6 (github-integration R5.37).
- Compare: reads finished workflow-run jobs of one repository for 14 days (max 90) and computes median and p95 of queue wait and run time per job name, split into hosted and crsp (observability R5.34, `GET /api/v1/compare`). This is already a small history engine over GitHub data, and the forecast can reuse its price-free parts.

### 1.4 Rate limits

Source: [Best practices for using the REST API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api) and the [rate limits page](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) (the second was not fetched in this run).

| Limit | Value | Notes |
|---|---|---|
| Primary, authenticated user | 5,000 requests per hour | confirmed by several secondary sources in search ([Endor Labs](https://www.endorlabs.com/learn/how-to-get-the-most-out-of-github-api-rate-limits), [Fast.io](https://fast.io/resources/github-api-rate-limiting-strategies/)); GitHub App installations have their own limit, **not verified** |
| Unauthenticated | 60 per hour | same sources |
| Conditional request answered 304 | does not count against the primary limit when sent authenticated | confirmed in the best-practices page summary |
| Secondary limits | not public in full. Secondhand: at most 100 concurrent requests, 900 points per minute for REST | **not verified**; sources are third-party |
| Webhook deliveries | cost no quota | background; consistent with how webhooks work |

Advice for crsp:

- Use webhooks as the main feed. Poll only when webhooks are off, and reconcile every 5 minutes as the spec says.
- Always send `If-None-Match`. crsp's poller already does (github-integration R5.37).
- Fetch each finished job's steps once, and never again (observability R5.12).
- Make calls serially per repository. The docs advise serial rather than concurrent calls ([best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)).
- Backfill history with a budget (a fixed share of the hourly quota, for example 20 percent), paged, resumable.

### 1.5 The workflow file

The YAML in the repo says things that events do not.

| Workflow feature | What it adds to the Jobs page | Limit |
|---|---|---|
| `needs:` | the DAG: which job waits for which. Shows "sequence" vs "parallel" before the run | the file must be read at `head_sha` (a contents API call, cached by sha). `if:` can skip a job, so an edge may not run |
| `strategy.matrix` | the matrix values per job; group the jobs `test (linux, 20)` as one family | a matrix from `fromJSON()` is computed at run time, so the file cannot list the values. Matrix size cap is 256 jobs ([cited by search result, not GitHub docs](https://www.r-bloggers.com/2020/12/dynamic-build-matrix-in-github-actions/); **not verified** at GitHub) |
| `concurrency:` groups | explains "this job waits because another run holds the group" | this wait is on GitHub's side, before crsp sees the job. crsp can only infer it |
| `if:` conditions | why a job is skipped | cannot be evaluated by crsp; use the `skipped` conclusion from GitHub |
| Reusable workflows (`uses:`) | a job in the caller expands into jobs of another file. The job name in events becomes `caller / called` (background; **not verified**) | crsp must read the called file too, possibly at another ref. Nesting depth limit of four was claimed by a blog and **not verified** |
| `timeout-minutes` | a hard upper bound; useful as a sanity cap on forecasts | none |
| `runs-on` with variables | the label list; crsp's own `RUNS_ON_*` variables (github-integration R5.6) decide it | none |

Honest rule: the YAML draws the plan; the events draw what happened. When they differ (a dynamic matrix, a reusable workflow, a skipped job), the page shows the events and says the plan could not be read, never a guessed edge.

Fallback for "parallel or sequence" without the file: two jobs of one run are parallel when their `[started_at, completed_at]` intervals overlap, and sequential when one starts after the other ends. This is a fact from timestamps, not from the file. Mark it "from the times".

### 1.6 What only crsp knows

All of these are crsp facts, grounded in the specs.

| Datum | Meaning | Spec |
|---|---|---|
| Wait reason | `free_slot`, `load_over_budget`, `no_runner_with_labels`, `repository_parallel_limit`, `machine_drained`, `quiet_hours`, `load_not_measured`, `paused`, `on_battery`, `unknown` | `packages/contract/openapi.yaml` schema `WaitReason`; scheduling section 5.8 (words via `scheduler.WaitWords`) |
| Wait text with numbers | "memory 91% > 85%", "2 ahead in the queue" | scheduling R5.21, section 5.8 |
| Queue order | order of service: repository priority, event class, fair share, queued time. Configurable (R5.10a) but the code still uses the fixed order | scheduling R5.8, R5.10a (NOT YET IMPLEMENTED for the setting) |
| Ticket and place in line | one ticket per waiting job, per machine | scheduling R5.6, R5.11 |
| Slot, slot kind | job slot, light slot `light-N`, heavy slot | scheduling R5.24 to R5.26 |
| Slot log | one row per slot taken, freed, ticket dropped: queued at, slot at, released at, slot number, outcome (`ran`, `stale-freed`, `no-ci-slot`, `error`, `ticket-dropped`, `completed-on-github`). Last 5000 rows per machine | scheduling R5.38, R5.39 |
| Load budget | memory and CPU percent at the time of the wait | scheduling R5.40 to R5.46 |
| Job-started hook | `ACTIONS_RUNNER_HOOK_JOB_STARTED` runs before the job; the gate holds the job there | scheduling R5.12 |
| Job-completed hook | `ACTIONS_RUNNER_HOOK_JOB_COMPLETED` frees the slot, logs outcome `ran`, empties `GITHUB_WORKSPACE` | scheduling R5.28, R5.29 |
| Clean-up time | time of the work-folder empty and, for ephemeral runners, `Stop` and `CleanUp` | scheduling R5.29; runners R5.26. A measured duration is **not stored today** (not verified in the code; the specs do not list it) |
| Machine, backend, isolation | where and how the job ran | `Job` schema; runners spec section 5 |
| Runner kind | persistent (hook-gated) or ephemeral (JIT, one job) | runners R5.6 section 5.6 (R5.25, R5.26) |
| Placement | for ephemeral runners the controller takes the slot when it places the job | scheduling R5.50 (built for one machine); machine choice R5.48, R5.49 is M3, NOT YET IMPLEMENTED |
| Caches | shared runner caches the user turned on | runners R5.26, R5.10 (section 5.10 "Runner caches (M1)"). Cache hit or miss per job is **not recorded today** (not verified) |
| Image build | base image built on first use | runners R5.27 (agent builds the base image on first use) and section 5.7. Build time per job is not recorded as far as the specs show |

Important gap for the ephemeral path: the gate and slot log are for persistent runners with the job-started hook. For ephemeral JIT runners the controller places the job and takes the slot (scheduling R5.50). The Jobs page must read both without the user seeing a difference.

Timeline of one job, with the source of each point:

| Point | Source | Field today |
|---|---|---|
| Job created | GitHub (`created_at`) | `created_at` |
| Seen by crsp | webhook or poll | `queued_at` |
| Slot taken | crsp gate | `slot_at` |
| Steps start | GitHub (`started_at`, runner picked the job) | `started_at` |
| "Set up job" ends | step 1 `completed_at` | not stored |
| Steps end | GitHub | `completed_at` |
| Slot freed, clean-up | crsp hook | slot log `released at` |

### 1.7 Worktree

GitHub does not see a git worktree. A runner checks out a ref in `GITHUB_WORKSPACE`. A "worktree" is a local concept of the delivery agents in this repo (`AGENTS.md` and `.claude/rules/agents-and-integration.md` say agent worktrees live under the work root and the branch is named `<task-id>-<slug>`, check DL-14, DL-53).

What crsp can show, from most to least solid:

| Item | How | Label to show |
|---|---|---|
| Branch | `head_branch` of the run (webhook or REST) | "Branch" |
| Commit | `head_sha` (already in `Job`) | "Commit" |
| Pull request | `pull_requests[]` of `workflow_run` (background; not verified) | "Pull request #n" |
| Task id | parsed from the branch name by the rule `<task-id>-<slug>` (for example `RES15-jobs-research`) | "Task (from the branch name)" |
| Worktree name | only if the job tells crsp: a runner label is not suitable (labels are fixed at registration). Use an env var such as `CRSP_WORKTREE`, set by the delivery agent in the workflow (`env:` or a step), and read it in the job-completed hook or a tiny step that posts it to the agent | "Worktree (reported by the job)" |
| Work folder | `GITHUB_WORKSPACE` seen by the hook (path inside `_work`) | show only the last folder name; paths can reveal user names |

Two ways the job can report:

1. A step `crsp report worktree=<name>` that calls the local agent. Cost: one extra step; the workflow must opt in.
2. The job-started hook reads an env var such as `CRSP_WORKTREE`. The hook gets the runner's environment, not the job's `env:`. Whether workflow `env:` reaches the hook is **not verified**. Do not design on it before a test.

Honesty rules:

- Never show a worktree that was not reported. When there is none, show nothing, not "unknown" in red.
- Show the source next to a value: "from GitHub", "from the branch name", "reported by the job".
- A branch name is not proof of the code that ran. The commit is. Show both, and show the commit as the main fact.
- A job on a merge ref (`refs/pull/N/merge`) builds a merge commit, not the branch tip. `head_sha` is the PR head. This difference is **not verified** for the `workflow_job` payload; check before the page says "built commit".

### 1.8 Table: datum, source, when known, cost, reliable?

| Datum | Source | When known | Cost | Reliable? |
|---|---|---|---|---|
| Repository, workflow name, job name | webhook `workflow_job` / REST | queued | none / 1 call | Yes |
| Branch (`head_branch`) | webhook `workflow_run`, or `workflow_job` (background) | queued | none | Yes. Not for a fork PR the same way (**not verified**) |
| Commit (`head_sha`) | webhook / REST | queued | none | Yes |
| Event, pull request | `workflow_run` webhook, REST run | when the run is created | none / 1 call | Yes; crsp spec says `workflow_job` alone lacks it (github-integration R5.48) |
| Job state: queued, in_progress, completed, waiting | webhook | at each change | none | Yes, but a delivery can be lost; reconcile |
| Created, started, completed times | webhook / REST | at each change | none / 1 call | Yes, to the second |
| Steps with times and conclusion | webhook `in_progress`/`completed` (background) or REST job | when the job runs and ends | none / 1 call | Yes; whole seconds only. Steps of a cancelled job can be partial |
| Runner id, name, group, labels | webhook (null while queued) / REST | at `in_progress` | none | Yes. Runner name can be reused after re-register |
| `needs` DAG | workflow file at `head_sha` | when the file is read | 1 contents call per sha, cached | Plan only. Skipped by `if:`; reusable and dynamic matrix limit it |
| Matrix values | job name in events; file for static matrix | queued | none | Name parsing is fragile; use the file when static |
| Concurrency-group wait | GitHub side; only inferred | n/a | none | No. Say "possibly waiting for a group" only with proof; otherwise omit |
| Slot wait, wait reason, wait text | crsp gate | live, while waiting | none | Yes for persistent runners; ephemeral path uses placement (scheduling R5.50) |
| Queue place and ahead count | crsp queue ticket | live | none | Yes, but only for persistent runners with a ticket |
| Machine, backend, isolation | crsp | at placement | none | Yes |
| Runner kind persistent or ephemeral | crsp runner record | at placement | none | Yes |
| Slot release, outcome | crsp slot log | at job end | none | Yes; log keeps 5000 rows per machine |
| Clean-up time | crsp hook | at job end | small code change | Not stored today |
| Cache hit or cold | crsp runner cache or the job | unknown today | new code | Not recorded today. Needs a definition |
| Image build time | crsp agent | at runner start | new code | Not recorded today |
| Worktree | the job (env var or `crsp report`) | when reported | opt-in | Only as "reported by the job" |
| Billable minutes / run timing | REST `timing` | after completion | 1 call | **Not verified**; do not rely on it for self-hosted jobs |

---

## 2. (b) How leading CI products present jobs and timing

For each product: what it shows, what to borrow, what to avoid. Where a claim comes only from a search summary I say so.

### 2.1 GitHub Actions

What it shows:

- Run page: a graph of jobs with `needs` edges and a job list; the job page lists steps with their durations (background; the UI was not fetched in this run).
- [Actions Usage Metrics and Performance Metrics](https://docs.github.com/en/actions/concepts/metrics) at repo and organization level. The job view has average run time, average queue time and job failures; the workflow view has average run time and failures; a comparison of self-hosted and GitHub-hosted runners is available ([metrics doc](https://docs.github.com/en/actions/concepts/metrics), [org metrics doc](https://docs.github.com/en/organizations/collaborating-with-groups-in-organizations/viewing-github-actions-metrics-for-your-organization), [changelog](https://github.blog/changelog/2025-03-14-actions-performance-metrics-are-generally-available-and-enterprise-level-metrics-are-in-public-preview)).
- Gap: averages and failure rates, no percentiles. A vendor article says GitHub lacks built-in p50 and p95 trends ([Blacksmith](https://info.blacksmith.sh/task/blog/measuring-p50-p95-build-duration-github-actions)); that is a vendor claim.

Borrow: the split "queue time" and "run time" per job; the comparison between self-hosted and hosted runners (crsp already has `compare`, observability R5.34).
Avoid: averages only. One slow outlier hides in a mean. Show median and a high percentile.

### 2.2 GitLab

What it shows:

- Pipeline graph with a "Job dependencies" view; a toggle draws lines between linked jobs ([GitLab needs docs](https://docs.gitlab.com/ee/ci/yaml/needs.html), [pipeline efficiency](https://sources.debian.org/src/gitlab/17.6.5-19/doc/ci/pipelines/pipeline_efficiency.md)).
- The docs say the dependency view helps to analyse the critical path. The view only draws explicit `needs`, not implicit stage order ([GitLab issue 336564](https://gitlab.com/gitlab-org/gitlab/-/issues/336564)).
- The older separate Needs tab was deprecated in 17.1 (per search summary; **not verified** on the page).
- I found no built-in critical-path chart or per-job duration chart in the sources; **not verified** whether GitLab has a pipeline duration chart. A forum thread asks how to compute the critical path from the API ([GitLab forum](https://forum.gitlab.com/t/how-to-get-information-about-the-dependency-graph-in-a-pipeline/93653)), so it is likely left to the user.

Borrow: lines between jobs shown only on demand (a toggle), so the default view stays calm.
Avoid: drawing a plan that is not what ran. Draw explicit edges only, and say when an edge is implicit.

### 2.3 Buildkite

What it shows:

- Build waterfall: a chart of each step's timeline, with wait time shown next to run time, the agent that took the job, and links to the job details ([Buildkite waterfall release note](https://buildkite.com/releases/2024-q1/investigate-jobs-from-the-waterfall-view), [waterfall improvements](https://buildkite.com/releases/2023-09/waterfall-improvements), [build waterfall view](https://buildkite.com/resources/changelog/191-build-waterfall-view)).
- Total job run time counts only time on an agent, not the wait for pickup. Wait is `started_at - created_at` ([Buildkite forum](https://forum.buildkite.community/t/build-run-times/4093)).
- Cluster insights (Enterprise): queue wait time, queued jobs, agent utilisation, job pass rate, with p50, p75, p90, p95 wait breakdown per queue ([cluster insights docs](https://buildkite.com/docs/pipelines/insights/clusters), [changelog](https://buildkite.com/resources/changelog/267-introducing-cluster-insights-real-time-visibility-into-your-ci-performance)).
- I did not confirm the exact content of Buildkite's Test Analytics or pipeline insights pages beyond the above; **not verified**.

Borrow: the waterfall with the wait drawn as a lighter bar before the run bar; wait percentiles per queue (for crsp: per machine and per label set).
Avoid: Enterprise-only gating of insights is a product choice; crsp has none, so no need to copy.

### 2.4 CircleCI

What it shows:

- Insights dashboard: status of up to 100 recent workflow runs, success rate, duration at p50 and p95, and credit use; data may lag up to 24 hours ([Using Insights](https://circleci.com/docs/insights/)).
- Jobs tab: total credits, p95 duration, total runs and success rate per job. CPU and RAM use average and max per job ([Insights glossary](https://circleci.com/docs/guides/insights/insights-glossary/)).
- CircleCI says not to use Insights for exact credit reporting ([Using Insights](https://circleci.com/docs/insights/)).
- A median and p95 field list for the Insights API came from a third-party mirror; **not verified**.

Borrow: per-job table with runs, success rate, median, p95 and a trend; the plain disclaimer about accuracy and lag; CPU and RAM per job (crsp has load figures).
Avoid: a lag the user cannot see. crsp should show "as of" time.

### 2.5 Jenkins

What it shows:

- Blue Ocean: stage view with parallel branches. The Jenkins docs say Blue Ocean will be deprecated in July 2026 with no further updates ([Jenkins Blue Ocean docs](https://jenkins.io/doc/book/blueocean/); date from search summary, **not verified** on the page).
- [Pipeline Graph View](https://plugins.jenkins.io/pipeline-graph-view/issues) is the maintained replacement that brings the best of Blue Ocean into the normal UI, with a graph and a run summary. A bug report says it loads slowly on large pipelines ([JENKINS-75811](https://issues.jenkins.io/browse/JENKINS-75811)).
- How parallel branches are drawn was **not verified** from sources.

Borrow: stages as columns, parallel items stacked in one column; graph and log on one screen.
Avoid: a heavy graph that loads all steps of a large run. Load steps on demand.

### 2.6 Datadog CI Visibility

What it shows:

- Each pipeline run is a trace. The Trace tab offers a flame graph or a span list; each job is a span with duration and error state ([Datadog CI pipelines docs](https://docs.datadoghq.com/continuous_integration/pipelines/), [Datadog CI/CD monitoring best practices](https://datadoghq.com/blog/best-practices-for-ci-cd-monitoring)).
- A "Critical path" checkbox highlights the longest path by execution time. It marks the spans to speed up to cut the total. The Explorer has an "On Critical Path" facet ([Datadog search docs](https://docs.datadoghq.com/continuous_integration/search/)).
- Pipeline details summary tables for stages and jobs sort by duration, percent of total, or failure rate (same source).
- Percentile support for job duration was not in the results; **not verified**.

Borrow: the critical-path highlight and the "percent of the run" column. These tell the user where the time goes.
Avoid: needing a trace backend. crsp can compute the same from its own rows.

### 2.7 OpenTelemetry CI/CD semantic conventions

What it defines:

- Pipeline run span with `cicd.pipeline.name`, `cicd.pipeline.run.id`, `cicd.pipeline.result` (success, failure, timeout, skip). Task run span (kind INTERNAL) with `cicd.pipeline.task.name`, `cicd.pipeline.task.run.id`, `cicd.pipeline.task.run.result`, `cicd.pipeline.task.run.url.full`, `cicd.pipeline.task.type` (build, test, deploy) ([OTel CI/CD spans](https://opentelemetry.io/docs/specs/semconv/cicd/cicd-spans/), [attribute registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/cicd/)).
- Status: release candidate, first seen in semantic conventions v1.27.0 (search summary of the same pages).
- The result value spelling differs between the registry (`skip`) and the span page (`skipped`) in the summary. Check the current spec ([OTel registry](https://opentelemetry.io/docs/specs/semconv/attributes-registry/cicd/)).
- Using the pipeline run resource on metrics is high cardinality and must be opt-in ([OTel CI/CD metrics](https://opentelemetry.io/docs/specs/semconv/cicd/cicd-metrics/)).
- CircleCI maps workflow to pipeline run and job to pipeline task in its OTel export ([CircleCI OTel integration](https://circleci.com/docs/guides/integration/open-telemetry-integration/index.md)).

Borrow: names. Use `pipeline` = run, `task` = job, so an export later is easy. Keep the `result` set small: success, failure, timeout, skip, plus crsp's cancelled and lost.
Avoid: high-cardinality labels (run id) on aggregate series; keep run ids in rows, not in metric labels.

### 2.8 Gantt, waterfall, flame views, critical path

- Gantt or waterfall: one row per job, time on the x axis, a bar from start to end, a faint bar for wait. Overlapping bars show parallelism by themselves. Buildkite and Datadog do this ([Buildkite](https://buildkite.com/releases/2023-09/waterfall-improvements), [Datadog](https://docs.datadoghq.com/continuous_integration/pipelines/)).
- Flame graph: nesting of spans (run > job > step). Fits the data (run, job, step is a tree of time).
- Critical path: the longest chain of dependent jobs. Shortening a job off the path does not shorten the run ([Datadog definition](https://docs.datadoghq.com/continuous_integration/search/)). The method behind it is the Critical Path Method (CPM) in project scheduling; see 3.5.

Borrow: waterfall as the main view of one run; step bars as the second level inside a job row.
Avoid: a flame graph for a list of runs. It does not scale; use it for one run.

### 2.9 Twelve UX patterns to borrow

1. **Wait bar then run bar.** In every row draw wait (light) before run (solid). Buildkite does this. In crsp the wait has two parts: GitHub wait and slot wait (observability R5.8). Draw them in two tones with a legend.
2. **One run as a waterfall.** All jobs of a run on one time axis. Overlap shows parallel. Gaps show waiting. Derived from times, so it is true even when the YAML cannot be read.
3. **Steps inside the job row.** Click a job to open its steps as small bars. Load steps on demand (Jenkins plugin had speed trouble when it loaded everything).
4. **Critical path toggle.** A checkbox "Show the longest chain" highlights the jobs on the path (Datadog). Only for finished runs, or live with a marked forecast.
5. **Edges on demand.** Draw `needs` lines only after a toggle (GitLab). Default is calm.
6. **Median plus p95 per job.** A table with runs, success rate, median, p95 and a small trend (CircleCI). Also "percent of run time" (Datadog).
7. **Queue view with the reason in words and the place.** "Waits for a free slot on box-1, 3rd in line." crsp has the words (`wait_text`); add the place (scheduling R5.11).
8. **Forecast as a range with its basis.** "About 6 to 9 min, from the last 30 runs on this machine." Never a bare number.
9. **Compare with the usual.** On a running job show "usual 6 to 9 min, now at 11 min" with a plain marker when above the p90. Do not turn the row red; slow is not failed.
10. **Source tags on facts.** Small text "from GitHub", "from crsp", "reported by the job". Fits the rule of not inventing (worktree).
11. **Group matrix jobs as a family.** One row `test` with a count and a range of times; open to see each variant. Name parsing of `test (linux, 20)` as the group key, with the workflow file as a better source when static.
12. **"As of" time and stale mark.** Show when the data was last refreshed, and a stale note when GitHub reads fail (observability R5.12 already says a failed GitHub read keeps stored rows and says the data is stale). CircleCI shows the lag in its docs; crsp should show it on the page.

Check against the repo's UX rules: all of this must use the shared parts and tokens in `docs/design-system/` (AGENTS.md checklist). I did not read the design system in this research. Any new chart (waterfall) needs a component in `next-version` first (AGENTS.md: "A change to a rule, token or component went into `next-version` first"). **Flag for the owner.**

---

## 3. (c) Forecasting

### 3.1 What to predict, and the key

Three predictions, in this order of need:

| Prediction | Question the user has | Inputs |
|---|---|---|
| Queue ETA | "When will my job start?" | slots free, jobs ahead, their remaining times |
| Job duration | "How long will this job run?" | history of this job key |
| Run ETA | "When is the whole run done?" | job durations and the `needs` DAG |

Job key: `repo + workflow file + job name + matrix values`. The matrix values come from the job name parse, or from the file when static. If the matrix is dynamic and the name changes every run, the key falls back to `repo + workflow + job name without the parenthesis`. State this: the key can be wrong for a dynamic matrix.

Step key: `job key + step number + step name`. The step number alone is fragile: adding a step shifts the numbers. Use the name when it is stable, number as tie-break. When a step list differs from the stored one (different count or names), start a new step history under a "steps version" hash of the ordered step names. Steps named by `uses:` actions often have generic names ("Run actions/checkout@v4"; background, **not verified**).

### 3.2 Which runs count

| Run | Counts for duration? | Why |
|---|---|---|
| success | Yes | the normal case |
| failure after a long run | Keep separate series "failed" | tests that fail late are real time, but a failure early (setup error) is not the job's normal time |
| failure early (for example under 20 percent of the median) | No | the job did not do its work |
| cancelled | No | stopped by a person or by concurrency |
| timed out | Keep apart | it shows the cap, not the work. Use it only to raise a "may time out" warning |
| lost (runner or machine went away) | No | observability R5.10 |
| re-run attempt | Yes, as its own run | observability R5.9: counted from its own attempt start |
| skipped | No | has no duration |

The 20 percent rule is my suggestion; it is not from a source. Tune on crsp's own data.

Do not mix queue time into run time. Observability R5.8 already separates them; the forecast must use `run_seconds` only (and the slot wait is not included).

### 3.3 Statistics

| Statistic | Use | Note |
|---|---|---|
| Median (p50) | the headline "usual" time | robust to outliers |
| p90 | "slow case" | needs enough runs; with under 10 runs a p90 is nearly the max |
| p25 | low end of the range | |
| EWMA | tracks a slow change | reacts to drift, but one outlier moves it; use on the median of a window or after trimming |
| Trimmed mean | smooth, stable | drop top and bottom 10 percent |
| MAD (median absolute deviation) | spread that outliers do not distort | `MAD = median(|x - median|)`; a robust band is `median ± 1.4826 × MAD × k` (the factor makes MAD comparable to a standard deviation for a normal curve, general statistics background) |

Percentile definition: use the nearest-rank method on the window, and say so. Be exact so the numbers are reproducible; the existing compare code computes median and p95 (observability R5.34), so use the same function. I did not read that code; **not verified** which method it uses.

Distribution shape: build times are right-skewed. The mean is pulled up by slow runs, so percentiles beat the mean. This is common knowledge; for CI the paper by Bisong et al. studies prediction models for build times ([arXiv 1712.06796](https://arxiv.org/abs/1712.06796)). I did not read its full text, only the abstract in search results.

### 3.4 Conditioning

Duration depends on where and how the job ran. Candidates, in order of value:

| Factor | Why | Source in crsp |
|---|---|---|
| Machine (or machine class: OS + CPU count) | speed differs | `machine_id` |
| Backend and isolation | a VM start adds time | `backend`, `isolation` |
| Runner kind (persistent vs ephemeral) | ephemeral pays image and clean-up | runners spec |
| Cache warm or cold | first run after cache loss is slower | **not recorded today**; infer later as "first run on this machine after N hours" or "run time above p75 and a restore step of long time" |
| Branch vs default branch | main may run more steps (`if:` on branch) | `head_branch` |
| Event | `pull_request` vs `push` vs schedule | `trigger` |

Method: condition by filtering the window to runs with the same machine class. If that leaves fewer than the minimum, drop the factor and use the wider set (see 3.7). Do not fit a model first. Simple filters are explainable ("from the last 30 runs on box-1").

Placement happens before the job knows its machine (queued job). So the forecast of a queued job is per machine option: if only one machine can take it (labels, OS), use that; if several, use the pool-wide set, widen the range.

Published work on duration prediction mostly uses learned models (random forest and similar) with features such as project size and history. Examples: [Bisong et al., "Built to Last or Built Too Fast?"](https://arxiv.org/abs/1712.06796) (evaluates prediction models for build times; I read only the abstract via search); [Seow et al., Random Forest model for build time on CI/CD, Pertanika 2025](https://www.bohrium.com/paper-details/random-forest-model-for-software-build-time-prediction-on-ci-cd-pipeline/1099963369848307757-81683) (compares linear regression, SVR, random forest, XGBoost; read only the listing); [SubmitQueue enhancements, arXiv 2501.03440](https://arxiv.org/pdf/2501.03440v2) (uses predicted build times to order a merge queue; the summary reports about 53 percent less CI resource use and 37 percent lower p95 wait, **not verified** against the paper). Conclusion for crsp: a model could come later, but history-based percentiles on a job key are the base that these papers also build on (their features are history). I make no claim about their error numbers.

### 3.5 Run ETA from the DAG (critical path method)

Inputs: the `needs` DAG (from the file) and a duration per job (median of its key, or the actual duration if finished).

Forward pass:

```
for job in topological order:
    start(job)  = max(end(dep) for dep in needs(job))   # 0 if none
    end(job)    = start(job) + duration(job)
run_end = max(end(job))
```

Critical path: walk back from the job with the largest `end`, choosing at each step the dependency with the largest `end`. These are the jobs where a delay delays the run. This is the Critical Path Method of project scheduling; Datadog's "critical path" is the longest path by execution time ([Datadog search docs](https://docs.datadoghq.com/continuous_integration/search/)). I did not fetch a CPM reference; **not verified** with a link; any project-management text covers it.

For a live run:

- A finished job uses its actual end.
- A running job: `end = max(now, started_at + median)`. If it is already past the median, use `now + small remainder`, and widen the range (see 3.6).
- A queued job: start = max(end of deps, forecast start from the queue ETA of 3.5a).
- A skipped job: duration 0, and its dependents keep their start from the other deps.

Ranges along a path: do not add percentiles of each job (sum of p90s is far above p90 of the sum). Simple honest rule: for the range of the run, add the p25 values for the low end, the p75 values for the high end along the critical path, and say "about". This is a heuristic, **not verified** against a source; label it so. A later step is Monte Carlo (draw each job from its history, take the run end, repeat 1000 times, take the 10th and 90th percentile).

Limits: with a dynamic matrix or a reusable workflow the DAG is incomplete. Then forecast only jobs known from events, and say "the rest of the run is not known".

### 3.5a Queue ETA from slots and jobs ahead

Facts from crsp specs: each machine has one queue (scheduling R5.6); the order of service is the order of R5.8; slots are counted per machine (job slots, light, heavy); a job also needs the machine to be under its load budget (R5.12, R5.13); a job that waits too long times out at 30 min (R5.20).

Simple simulation per machine:

```
slots = list of end-times of running jobs (now + max(0, median - elapsed) each; free slots = now)
for ticket in order of service (those ahead of this job, then this job):
    s = earliest slot end-time
    start(ticket) = s
    replace s with s + median(ticket's job key)
ETA start of the job = start(this job)
```

Notes:

- Use the actual order of service, with passed-over tickets (repository parallel limit, R5.10) skipped when their repository is at the limit. Their place stays, but they may be served later than the one behind.
- A new job with a better priority can jump in front; the ETA is a forecast, not a promise. Say so in the words.
- The load budget can hold a job even with a free slot (scheduling R5.13). The simulation cannot see future load. Add one extra note when the reason is `load_over_budget`: "waits for load; time not forecast". Do not invent a number.
- For `no_runner_with_labels`, `machine_drained`, `paused`, `on_battery`, `quiet_hours`: no ETA. State the reason only.
- Light and heavy slots are separate pools (R5.24 to R5.26); simulate each pool by its kind.
- Placement across machines is M3 and NOT YET IMPLEMENTED (scheduling R5.48, R5.49), so the first version is per machine.

Little's law as a sanity check, not as the method: for a stable system, average number in the system L = arrival rate λ × average time in the system W ([Little's law explainer](https://sookocheff.com/post/modeling/littles-law/); original proof, [Little 1961, Operations Research 9(3)](https://www.citedrive.com/en/discovery/a-proof-for-the-queuing-formula-ili-%CE%BBiwi)). It holds for any distribution but only in steady state ([cavac summary](https://cavac.at/cavacopedia/Little%27s%20Law)). Use: if the average queue length is 6 and jobs arrive 2 per minute, the average wait is about 3 minutes, so `W = L / λ`. This gives a quick "typical wait" for a machine from counts over a day, which is a good fallback for a queue ETA when there are no job histories. It does not hold during a burst (not steady). Say "typical wait today", not "your wait".

### 3.6 Confidence ranges and words

Rule: show a range, not a point. Use these templates:

| Situation | Words |
|---|---|
| 30 or more runs, spread small | "About 6 to 9 min" |
| 10 to 29 runs | "About 6 to 9 min, from the last 14 runs" |
| 5 to 9 runs | "Roughly 5 to 12 min, few runs so far" |
| under 5 runs | "Not enough history yet" and show the fallback only as "similar jobs take about X" when it is a different level (see 3.7) |
| spread very large (p90 over 3 times p25) | "Varies a lot: 2 to 15 min" |
| job already past p90 | "Taking longer than usual (usual 6 to 9 min)" |

Rounding: round the low end down and the high end up to the nearest whole minute above 2 min, and to 10 seconds below 2 min. This is a design choice, not from a source.

Range rule (first version): low = p25, high = p90 of the window, shown as "about low to high". These are not a statistical confidence interval; they are the range where most runs fall. Do not call them "95 percent confident". Call it "usual range". Honest wording matters more than a statistical claim.

### 3.7 Cold start and fallback chain

Order, from most to least specific. Use the first level with at least N runs (N = 5):

1. job key + same machine class
2. job key (any machine)
3. workflow + job name without matrix values
4. workflow total (for the whole run, not for a job)
5. repo + job name (same name in another workflow)
6. global: all jobs on this pool with the same labels

At levels 3 to 6 show the level in words: "from similar jobs in this repo". At level 6 say "rough guess". If even level 6 has under 5 runs, show "not enough history".

For a new step list, the step forecast uses the job-level forecast only, and no step bars are forecast until the steps version has N runs.

Optionally for jobs with a cache: a first run after a cache loss is slower. Treat "no history on this machine" as cold, and use level 2 with a note.

### 3.8 Recommended first method (state exactly)

Name: **Window median with usual range.**

| Part | Rule |
|---|---|
| Key | `repo + workflow file + job name (with matrix values) [+ machine class]`; step key adds `steps version + step name` |
| Which runs | `result = success`, `run_seconds` known and > 0, not a re-run of the same job within the same attempt chain's cancelled attempts, run time at least 20 percent of the current median (drops early failures once a median exists) |
| Window | the last 30 qualifying runs of the key, no older than 90 days |
| Machine class | first try the same `machine_id`. If under 5 runs, use all machines |
| Statistic | median for the headline; p25 and p90 for the range, by nearest rank |
| Minimum | 5 runs. Under 5: "Not enough history yet" |
| Fallback | chain of 3.7, first level with 5 or more runs, and the level named in words |
| Range shown | "about p25 to p90", rounded as in 3.6 |
| Running job | remaining = max(0, median - elapsed). After p90: "taking longer than usual" |
| Queue ETA | simulation of 3.5a with these medians; no number for the non-slot reasons |
| Run ETA | CPM of 3.5 with these medians; range from p25 sums to p75 sums along the critical path, marked "about" |
| Timeouts | stored apart, never in the window. A job with a timeout in the last 5 runs shows "timed out recently" |
| Step forecast | same rule on step durations, only for the same steps version |
| Stored | each forecast with its inputs (key, level, n runs, window times), so "why this number" is one click |

Why this method: it uses one statistic that outliers do not move, it is explainable in one sentence, it has no training step, it can be recomputed from stored rows, and a test can state exact input and output. It needs no new tables beyond the history rows (3.10).

Show a "why" line: "Median of the last 30 successful runs on box-1 (6 min 12 s). Usual range 5 to 9 min."

### 3.9 Outliers, retries, drift

Outliers:

- Window median and p25 to p90 are already robust. Do not drop a run for being slow; the p90 is meant to include slow runs.
- Drop only runs that did not do the work (early failure, cancelled, lost).
- A cap: ignore any run above `timeout-minutes` if it is known (a time out is kept apart).

Retries: a re-run attempt of a failed job re-runs only that job on GitHub. Its time is real and counts as its own run (observability R5.9). But a retry that follows a runner loss may be warm on cache; mark it only if there is a field to say so (none today).

Drift (the job got slower or faster for a lasting reason: new dependency, new machine, new test):

| Method | How | Notes |
|---|---|---|
| Window compare (first version) | median of last 10 vs median of the 20 before. Flag when the ratio is above 1.25 or below 0.8, and the difference is above 3 × MAD of the older window | simple, explainable. The 1.25, 0.8 and 3 are my suggested starting values, not from a source |
| CUSUM | accumulate deviations from a reference mean; alarm when the sum passes a threshold ([Page 1954, described in the menelaus docs](https://menelaus.readthedocs.io/en/dev/examples/change_detection/change_detection_examples.html)) | good for small steady shifts |
| Page-Hinkley | a CUSUM variant: accumulate differences from the running mean; alarm over a threshold ([datadriftR PageHinkley doc](https://rdrr.io/cran/datadriftR/man/PageHinkley.html)) | a threshold set too low gives many false alarms ([menelaus docs](https://menelaus.readthedocs.io/en/dev/examples/change_detection/change_detection_examples.html)); attribution is inconsistent between sources (Page 1954 or Hinkley 1971) |

On drift: after a flag, shrink the window to the runs since the change point, so the forecast follows the new level. Show a note "this job is now slower than before (usual 6 to 9 min, was 4 to 6 min)". Wait for a person to see this before any automatic action; crsp changes no job.

Also drift from the machine: a machine change (new hardware, a new backend) is a known cause. Compare per machine class (3.4), and the filter handles it without a detector.

### 3.10 How much history, and privacy

Storage:

| Layer | Content | Keep |
|---|---|---|
| Job rows | the `Job` fields (1.1), plus branch, event, PR number, matrix key | by the retention limits of observability R5.32 and R6.8 (I did not read R6.8; **not verified** what they are). Suggest at least the last 200 runs per job key |
| Step rows | job id, step number, name, conclusion, started, completed | the last 50 to 200 runs per job key (the window is 30; keep extra for the drift check and charts) |
| Sequencing | per run: job ids, `needs` edges at `head_sha`, start order | same as job rows |
| Daily aggregates | per job key per day: runs, successes, p50, p90, wait p50, p90, per machine class | 400 days (about 13 months), so a year-over-year view works |
| Forecast log (optional) | forecast made, and the actual result | short, to measure accuracy (30 days) |

Size estimate (back of the envelope, my numbers): a job row of about 400 bytes and 10 step rows of about 120 bytes each is under 2 KB per job. 1000 jobs a day for 200 days is about 400 MB at the worst, so the 200-run window per key is the real limit. Check against the SQLite size goals in the observability spec section 6 (I did not read it). The aggregates are small: one row per key per day.

Backfill from GitHub: use the compare route's approach (observability R5.34): read finished jobs for 14 days (max 90) within a rate budget.

Privacy: store only job names, step names, branch names, repository names, runner names, times, results, and crsp's own wait reason. Never store logs, env values, secrets, the contents of `with:` inputs, commit messages, or author names. Step names can contain text from `name:` fields written by the user, and a step name could carry an interpolated value (for example `Deploy to ${{ env.X }}`; the name shown by GitHub is the resolved text, background, **not verified**). Rule: store step names as given by GitHub, cut to 120 characters, and drop any step name that looks like it carries a secret (a long random token). Branch names can carry a ticket id and a person's name; they are already in the repo's own GitHub view, so the same people see them. Show history only to users who may see the repository (github-integration section 5.4 permissions; I did not read it, **not verified**).

The worktree label from 1.7 is user-reported; store it as text cut to 64 characters, and show the "reported by the job" tag.

---

## 4. Plan: what to build first (for the owner)

Order that gives value early and stays honest:

1. Add to history rows: branch (`head_branch`), event, PR number, step rows, matrix key. Source: webhook, then REST repair.
2. Jobs list: add branch and "ahead in the queue" for queued jobs (all known today except the branch).
3. Job detail: the wait bar split in GitHub wait and slot wait, the steps list with bars, runner, machine, backend, kind.
4. Per job key table: runs, success rate, median, p90, a trend line. Tab "Wait and duration" (web-console 4.6) is the home for it.
5. Forecast v1 (3.8) for a running and a queued job, with the "why" line.
6. Run waterfall from event times. Then the `needs` toggle from the file. Then CPM and critical path.
7. Drift flag, window compare only.
8. Later: Monte Carlo ranges, cache cold or warm, worktree reporting step, a learned model, export to OpenTelemetry names.

Each step changes a feature spec and needs a change note (AGENTS.md DOCSPEC): `web-console`, `observability`, `scheduling` (queue place and ETA), `github-integration` (step data and file reads). Any new chart component goes into the design system `next-version` first.

### Open questions for the owner

1. Is the branch only from GitHub, or should a delivery task also push the worktree name by env var (needs a test on whether the hook sees it)?
2. How long should job and step rows be kept (the limits R6.8)? Is 400 days of daily aggregates acceptable?
3. May crsp read workflow files at `head_sha` through the GitHub App (needs the Contents read permission; github-integration section 5.4 lists permissions, which I did not check)?
4. Should a forecast for a queued job show before the machine is chosen (M3 placement is not built)?
5. Is a number shown to the minute enough, or should short jobs (under 2 min) show seconds?

---

## 5. Limits of this research

- The search tool gave summaries, not full pages. Facts from official GitHub pages on webhook fields, the `timing` endpoint, secondary limits and reusable workflows are partly **not verified**.
- I did not read the design system, the code, the observability limits R6.8, or the forecast code of `compare`.
- The numbers in 3.6, 3.8 and 3.9 (30 runs, 5 minimum, p25 to p90, 20 percent, 1.25 ratio, 90 days) are my starting values. They are not from a source. Test them on real crsp history before they ship.
- Paper claims come from abstracts and summaries only.

---

## Sources

crsp specs (this repo):

- `docs/features/web-console/spec.md`, section 4.6 Jobs.
- `docs/features/scheduling/spec.md`, sections 3, 5.2 (R5.6 to R5.11), 5.3 (R5.12 to R5.27), 5.4 (R5.28 to R5.30), 5.6 (R5.38, R5.39), 5.7 (R5.40 to R5.47), 5.8 (R5.48 to R5.50), 5.9 (R5.51 to R5.54).
- `docs/features/observability/spec.md`, section 5 (Job history R5.7 to R5.12, Minutes saved, compare R5.34, Retention R5.32).
- `docs/features/github-integration/spec.md`, sections 5.8 Demand (R5.35 to R5.38, R5.48, R5.50, R5.51).
- `docs/features/runners/spec.md`, sections 5.6 (R5.25 to R5.27), 5.7, 5.10.
- `packages/contract/openapi.yaml`, schemas `Job` and `WaitReason`.
- `AGENTS.md` and `.claude/rules/agents-and-integration.md` (branch naming and docs rules).

GitHub:

- [Webhook events and payloads, workflow_job](https://docs.github.com/en/webhooks/webhook-events-and-payloads#workflow_job) (not fetched; official reference to check)
- [octokit workflow-job JSON schema](https://github.com/octokit/webhooks/blob/b6bad6afd6482eb5700e8c41eaf5d96bbd1536a9/payload-schemas/api.github.com/common/workflow-job.schema.json)
- [Changelog: webhook enhancements for environment protection rules](https://github.blog/changelog/2022-11-21-webhook-enhancements-for-environment-protection-rules)
- [REST API: workflow jobs](https://docs.github.com/en/rest/actions/workflow-jobs)
- [REST API best practices (rate limits, conditional requests)](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) (not fetched)
- [Endor Labs: GitHub API rate limits](https://www.endorlabs.com/learn/how-to-get-the-most-out-of-github-api-rate-limits) and [Fast.io rate limit guide](https://fast.io/resources/github-api-rate-limiting-strategies/) (secondary)
- [GitHub Actions metrics concepts](https://docs.github.com/en/actions/concepts/metrics)
- [Viewing Actions metrics for your organization](https://docs.github.com/en/organizations/collaborating-with-groups-in-organizations/viewing-github-actions-metrics-for-your-organization)
- [Changelog: Actions Performance Metrics GA](https://github.blog/changelog/2025-03-14-actions-performance-metrics-are-generally-available-and-enterprise-level-metrics-are-in-public-preview)
- [Blacksmith: measuring p50 and p95 build duration](https://info.blacksmith.sh/task/blog/measuring-p50-p95-build-duration-github-actions) (vendor)
- [r-bloggers: dynamic build matrix](https://www.r-bloggers.com/2020/12/dynamic-build-matrix-in-github-actions/) (third party)

Other CI products:

- GitLab: [needs keyword](https://docs.gitlab.com/ee/ci/yaml/needs.html), [pipeline efficiency](https://sources.debian.org/src/gitlab/17.6.5-19/doc/ci/pipelines/pipeline_efficiency.md), [issue 336564](https://gitlab.com/gitlab-org/gitlab/-/issues/336564), [forum thread](https://forum.gitlab.com/t/how-to-get-information-about-the-dependency-graph-in-a-pipeline/93653)
- Buildkite: [waterfall release note](https://buildkite.com/releases/2024-q1/investigate-jobs-from-the-waterfall-view), [waterfall improvements](https://buildkite.com/releases/2023-09/waterfall-improvements), [build waterfall view](https://buildkite.com/resources/changelog/191-build-waterfall-view), [forum: build run times](https://forum.buildkite.community/t/build-run-times/4093), [cluster insights](https://buildkite.com/docs/pipelines/insights/clusters), [cluster insights changelog](https://buildkite.com/resources/changelog/267-introducing-cluster-insights-real-time-visibility-into-your-ci-performance)
- CircleCI: [Using Insights](https://circleci.com/docs/insights/), [Insights glossary](https://circleci.com/docs/guides/insights/insights-glossary/), [OpenTelemetry integration](https://circleci.com/docs/guides/integration/open-telemetry-integration/index.md)
- Jenkins: [Blue Ocean docs](https://jenkins.io/doc/book/blueocean/), [Pipeline Graph View](https://plugins.jenkins.io/pipeline-graph-view/issues), [JENKINS-75811](https://issues.jenkins.io/browse/JENKINS-75811)
- Datadog: [CI pipelines](https://docs.datadoghq.com/continuous_integration/pipelines/), [CI search and Explorer](https://docs.datadoghq.com/continuous_integration/search/), [CI/CD monitoring best practices](https://datadoghq.com/blog/best-practices-for-ci-cd-monitoring)
- OpenTelemetry: [CI/CD spans](https://opentelemetry.io/docs/specs/semconv/cicd/cicd-spans/), [CI/CD metrics](https://opentelemetry.io/docs/specs/semconv/cicd/cicd-metrics/), [attribute registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/cicd/), [attributes registry (cicd)](https://opentelemetry.io/docs/specs/semconv/attributes-registry/cicd/)

Forecasting and statistics:

- Bisong, Tran, Baysal. [Built to Last or Built Too Fast? Evaluating Prediction Models for Build Times](https://arxiv.org/abs/1712.06796) (abstract only)
- Seow, Lim, Ang. [Random Forest Model for Software Build Time Prediction on CI/CD Pipeline](https://www.bohrium.com/paper-details/random-forest-model-for-software-build-time-prediction-on-ci-cd-pipeline/1099963369848307757-81683) (listing only)
- [SubmitQueue enhancements, arXiv 2501.03440](https://arxiv.org/pdf/2501.03440v2) (summary only)
- Little's law: [Sookocheff explainer](https://sookocheff.com/post/modeling/littles-law/), [Cavac summary](https://cavac.at/cavacopedia/Little%27s%20Law), [Little 1961 proof (DOI 10.1287/opre.9.3.383)](https://www.citedrive.com/en/discovery/a-proof-for-the-queuing-formula-ili-%CE%BBiwi)
- Drift: [menelaus change detection examples (CUSUM, Page-Hinkley)](https://menelaus.readthedocs.io/en/dev/examples/change_detection/change_detection_examples.html), [datadriftR PageHinkley](https://rdrr.io/cran/datadriftR/man/PageHinkley.html)
- Critical Path Method: no link fetched; **not verified** with a source in this run.
