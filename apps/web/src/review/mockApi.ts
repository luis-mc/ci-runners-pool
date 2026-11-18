// The mock API of the review build: a fetch implementation that answers the shell, the other areas and the PROPOSED
// Jobs endpoints from the fake fixtures. Nothing here is reachable from the production entry (main.tsx).
import type { Schemas } from '../api/api';
import { percentile } from '../screens/jobs-next/forecast';
import type {
  ForecastAnswer,
  ForecastPoint,
  HourStat,
  JobDetail,
  JobItem,
  JobPage,
  JobStats,
  RunItem,
  RunPageData,
  DayStat,
} from '../screens/jobs-next/model';
import {
  FIXED_NOW,
  MACHINES,
  REPOS,
  RUNNERS,
  buildFixtures,
  dagOf,
  forecastOfKey,
  liveSteps,
  toSchemaJob,
  type FixtureData,
} from './fixtures';
import { runEta } from '../screens/jobs-next/forecast';
import { baseJobName } from '../screens/jobs-next/words';

const OWNER: Schemas['User'] = {
  id: 1,
  login: 'luis-mc',
  role: 'owner',
  added_at: '2026-10-01T10:00:00Z',
};

function machineRec(
  m: (typeof MACHINES)[number],
  running: JobItem[],
): Schemas['Machine'] {
  const mine = running.filter((j) => j.machine_id === m.id);
  return {
    id: m.id,
    name: m.name,
    os: m.os,
    arch: 'x64',
    state: 'active',
    online: true,
    is_controller: m.os === 'windows',
    backends: m.backends.map((b) => ({
      name: b as Schemas['BackendName'],
      present: true,
      usable: true,
      allowed: true,
      version: '1',
    })),
    settings: {
      budget_memory_pct: 80,
      budget_cpu_pct: 80,
      job_slots: m.slots,
      light_slots: 2,
      heavy_slots: 2,
      allowed_backends: m.backends as Schemas['BackendName'][],
      drain_timeout_minutes: 30,
      windows_symlink_right: m.os === 'windows',
      mode: 'automatic',
      pause_on_battery: true,
      cpu_cap_pct: 100,
    },
    accepting: true,
    load: {
      memory_pct: m.os === 'windows' ? 62 : 48,
      cpu_pct: m.os === 'windows' ? 41 : 30,
      memory_known: true,
      cpu_known: true,
      sampled_at: new Date(Date.now()).toISOString(),
      stale: false,
    },
    slots_used: mine.length,
    last_seen_at: new Date(Date.now()).toISOString(),
    running_jobs: mine.map(toSchemaJob),
  };
}

function runnerRec(r: (typeof RUNNERS)[number], running: JobItem[]): Schemas['Runner'] {
  const job = running.find((j) => j.runner_id === r.id);
  return {
    id: r.id,
    name: r.name,
    machine_id: r.machine_id,
    machine_name: r.machine_name,
    os: r.os,
    arch: 'x64',
    kind: r.kind,
    backend: r.backend as Schemas['BackendName'],
    isolation: r.isolation,
    labels: ['self-hosted', r.os],
    scope: { kind: 'pool' },
    state: job ? 'busy' : 'idle',
    managed: true,
    keeps_state: r.kind === 'persistent',
    ...(job ? { current_job: toSchemaJob(job), serving: job.repository } : {}),
    registrations: REPOS.length,
  };
}

function repositoryRec(r: (typeof REPOS)[number]): Schemas['Repository'] {
  const [owner = '', name = ''] = r.full_name.split('/');
  return {
    id: r.id,
    full_name: r.full_name,
    owner,
    name,
    installation_id: 1,
    visibility: 'private',
    default_branch: 'main',
    pool_on: true,
    user_is_github_admin: true,
    user_admin_known: true,
    variables: [],
    policy: {
      priority: 10,
      max_parallel_jobs: 2,
      allow_fork_pull_requests: false,
      light_runner: true,
      labels: ['self-hosted'],
      runner_groups: [],
    },
  };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const notFound = (what: string) =>
  json(
    {
      error: {
        code: 'not_found',
        message: `No ${what} in the review data.`,
        details: [],
      },
    },
    404,
  );

/** The fake controller. `now` is the review clock; running jobs advance with it. */
export class ReviewApi {
  readonly data: FixtureData;
  private now: () => number;
  /** Set to make the next requests of a path fail, for the failed state. */
  failing = new Set<string>();

  constructor(now: () => number = () => FIXED_NOW) {
    this.now = now;
    this.data = buildFixtures(FIXED_NOW);
  }

  /** A job at the review clock: a running job's steps and run time advance. */
  private live(j: JobItem): JobItem {
    if (j.state !== 'running') return j;
    const now = this.now();
    const started = j.started_at ? Date.parse(j.started_at) : now;
    return {
      ...j,
      steps: liveSteps(j, this.data.plans.get(j.id) ?? [], now),
      run_seconds: Math.max(0, Math.round((now - started) / 1000)),
    };
  }
  private all(): JobItem[] {
    return this.data.jobs.map((j) => this.live(j));
  }
  private running(): JobItem[] {
    return this.all().filter((j) => j.state === 'running');
  }
  private queue(): JobItem[] {
    return this.data.jobs
      .filter((j) => j.state === 'queued' && j.queue_position !== undefined)
      .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
  }
  private runOf(id: number, attempt?: number): RunItem | undefined {
    const all = this.data.runs.filter((r) => r.id === id);
    if (all.length === 0) return undefined;
    const run = attempt
      ? all.find((r) => r.attempt === attempt)
      : [...all].sort((a, b) => b.attempt - a.attempt)[0];
    if (!run) return undefined;
    const jobs = run.jobs.map((j) => this.live(j));
    const dag = dagOf(jobs, this.now());
    const eta = run.state === 'done' ? undefined : runEta(dag);
    if (run.graph?.source === 'timing') {
      // The workflow file could not be read: no edges, only the overlap in time (the jobs are drawn as parallel).
      return {
        ...run,
        jobs: jobs.map((j) => ({ ...j, needs: [] })),
        edges: [],
        critical_path: [],
        ...(eta ? { eta } : {}),
      };
    }
    return { ...run, jobs, ...(eta ? { eta } : {}) };
  }

  filter(items: JobItem[], q: URLSearchParams): JobItem[] {
    const repo = q.get('repository');
    const machine = q.get('machine');
    const runner = q.get('runner');
    const kind = q.get('runner_kind');
    const key = q.get('job_key');
    const type = q.get('job_type');
    const result = q.get('result');
    const repoId = q.get('repository_id');
    const machineId = q.get('machine_id');
    const branch = q.get('branch');
    const backend = q.get('backend');
    const jobBase = q.get('job');
    const since = Number(q.get('since') ?? 0);
    const from = since > 0 ? this.now() - since * 86_400_000 : 0;
    return items.filter(
      (j) =>
        (!repo || j.repository === repo) &&
        (!machine || j.runner?.machine_name === machine || j.machine_id === machine) &&
        (!runner || j.runner?.name === runner || j.runner_name === runner) &&
        (!kind || j.runner?.kind === kind) &&
        (!key || j.jobKey === key) &&
        (!type || j.job_type === type) &&
        (!result || j.result === result) &&
        (!repoId || String(j.repository_id) === repoId) &&
        (!machineId || j.machine_id === machineId) &&
        (!branch || j.branch === branch) &&
        (!backend || j.runner?.backend === backend) &&
        (!jobBase || baseJobName(j.job_name) === jobBase) &&
        (!from || !j.completed_at || Date.parse(j.completed_at) >= from),
    );
  }

  /** One row for each run (its latest attempt), for the Queue, Running and Done lists. */
  private runsPage(q: URLSearchParams): RunPageData {
    const state = q.get('state');
    const latest = new Map<number, number>();
    for (const r of this.data.runs)
      latest.set(r.id, Math.max(latest.get(r.id) ?? 0, r.attempt));
    const repo = q.get('repository');
    const from =
      Number(q.get('since') ?? 0) > 0
        ? this.now() - Number(q.get('since')) * 86_400_000
        : 0;
    const runs = [...latest.entries()]
      .flatMap(([id, attempt]) => {
        const r = this.runOf(id, attempt);
        return r ? [r] : [];
      })
      .filter((r) => !repo || r.repository === repo);
    const placed = (r: RunItem) =>
      r.jobs.filter((j) => j.state === 'queued' && j.queue_position !== undefined);
    const lastEnd = (r: RunItem) =>
      Math.max(...r.jobs.map((j) => (j.completed_at ? Date.parse(j.completed_at) : 0)));
    let items: RunItem[];
    if (state === 'queued')
      items = runs
        .filter((r) => placed(r).length > 0)
        .sort(
          (a, b) =>
            Math.min(...placed(a).map((j) => j.queue_position ?? 0)) -
            Math.min(...placed(b).map((j) => j.queue_position ?? 0)),
        );
    else if (state === 'running')
      items = runs
        .filter((r) => r.state === 'running')
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    else
      items = runs
        .filter((r) => r.state === 'done' && (!from || lastEnd(r) >= from))
        .sort((a, b) => lastEnd(b) - lastEnd(a));
    const limit = Math.min(Number(q.get('limit') ?? 50) || 50, 200);
    const start = Number(q.get('cursor') ?? 0) || 0;
    return {
      items: items.slice(start, start + limit),
      ...(start + limit < items.length ? { next_cursor: String(start + limit) } : {}),
      total: items.length,
      stale: { stale: false },
    };
  }

  private jobsPage(q: URLSearchParams): JobPage {
    const state = q.get('state');
    let items: JobItem[];
    if (state === 'queued') items = this.queue();
    else if (state === 'running')
      items = this.running().sort((a, b) =>
        (b.started_at ?? '').localeCompare(a.started_at ?? ''),
      );
    else
      items = this.data.jobs
        .filter((j) => j.state === 'done')
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
    items = this.filter(items, q);
    const limit = Math.min(Number(q.get('limit') ?? 50) || 50, 200);
    const start = Number(q.get('cursor') ?? 0) || 0;
    const slice = items.slice(start, start + limit);
    return {
      // The list leaves out steps, except those of running jobs (the Running tab shows the step now).
      items: slice.map((j) => {
        if (j.state === 'running') return j;
        const { steps: _s, ...rest } = j;
        void _s;
        return rest;
      }),
      ...(start + limit < items.length ? { next_cursor: String(start + limit) } : {}),
      total: items.length,
      stale: { stale: false },
    };
  }

  private detail(id: number): JobDetail | undefined {
    const j = this.all().find((x) => x.id === id);
    if (!j) return undefined;
    const sameRun = this.all().filter(
      (x) => x.run_id === j.run_id && x.node_id === j.node_id,
    );
    const history = (this.data.histories.get(j.jobKey) ?? []).slice(-30);
    const run = this.runOf(j.run_id, j.run_attempt);
    return {
      ...j,
      steps: j.steps ?? [],
      history,
      attempts: sameRun
        .sort((a, b) => a.run_attempt - b.run_attempt)
        .map((x) => ({
          attempt: x.run_attempt,
          job_id: x.id,
          state: x.state,
          ...(x.result ? { result: x.result } : {}),
        })),
      ...(run?.eta ? { run_eta: run.eta } : {}),
    };
  }

  private stats(q: URLSearchParams): JobStats {
    const span = Number(q.get('days') ?? 14) || 14;
    const from = this.now() - span * 86_400_000;
    const done = this.filter(
      this.data.jobs.filter(
        (j) => j.state === 'done' && Date.parse(j.completed_at ?? '') >= from,
      ),
      q,
    );
    const byDay = new Map<string, JobItem[]>();
    for (const j of done) {
      const d = (j.completed_at ?? '').slice(0, 10);
      byDay.set(d, [...(byDay.get(d) ?? []), j]);
    }
    const days: DayStat[] = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, js]) => {
        const waits = js.map((j) => j.github_wait_seconds ?? 0);
        const runs = js.map((j) => j.run_seconds ?? 0);
        return {
          day,
          jobs: js.length,
          wait_p50: percentile(waits, 0.5),
          wait_p90: percentile(waits, 0.9),
          run_p50: percentile(runs, 0.5),
          run_p90: percentile(runs, 0.9),
        };
      });
    const grid = new Map<string, number>();
    for (const j of this.data.jobs) {
      if (!j.started_at || Date.parse(j.started_at) < from) continue;
      const d = new Date(j.started_at);
      const k = `${(d.getUTCDay() + 6) % 7}-${d.getUTCHours()}`;
      grid.set(k, (grid.get(k) ?? 0) + 1);
    }
    const hours: HourStat[] = [];
    for (let weekday = 0; weekday < 7; weekday++)
      for (let hour = 0; hour < 24; hour++)
        hours.push({ weekday, hour, count: grid.get(`${weekday}-${hour}`) ?? 0 });
    const forecast_points: ForecastPoint[] = done
      .filter(
        (j) =>
          j.result === 'success' &&
          j.forecast.basis !== 'not_enough_history' &&
          j.run_seconds,
      )
      .map((j) => ({
        job_id: j.id,
        forecast_seconds: j.forecast.p50,
        actual_seconds: j.run_seconds ?? 0,
        lo: j.forecast.lo,
        hi: j.forecast.hi,
        note: `${j.repository} ${j.job_name}`,
      }));
    return { days, hours, forecast_points };
  }

  private forecastAnswer(key: string): ForecastAnswer | undefined {
    const h = this.data.histories.get(key);
    if (!h) return undefined;
    const sample = this.data.jobs.find((j) => j.jobKey === key);
    return {
      jobKey: key,
      forecast: forecastOfKey(h),
      steps: (sample?.steps ?? []).map((s) => ({
        name: s.name,
        forecast: s.forecast ?? forecastOfKey(h),
      })),
      history: h.slice(-30),
    };
  }

  overview(): Schemas['Overview'] {
    const running = this.running();
    const queue = this.queue();
    return {
      machines: MACHINES.map((m) => machineRec(m, running)),
      queued_count: queue.length,
      queued: queue.map(toSchemaJob),
      waiting: queue.map((j) => ({
        job_id: j.id,
        repository: j.repository,
        job_name: j.job_name,
        reason: j.wait_reason ?? 'unknown',
        words: j.wait_text ?? 'waits',
      })),
      running: running.map(toSchemaJob),
      minutes_saved_today: [
        { os: 'linux', minutes: 74 },
        { os: 'windows', minutes: 41 },
      ],
      last_event_id: '1',
    };
  }

  fetch = (input: Request | string, init?: RequestInit): Promise<Response> =>
    Promise.resolve(this.answer(input, init));

  private answer(input: Request | string, init?: RequestInit): Response {
    const req = typeof input === 'string' ? new Request(input, init) : input;
    const url = new URL(req.url);
    const path = url.pathname;
    const q = url.searchParams;
    if (req.method !== 'GET') return new Response(null, { status: 204 });
    if (this.failing.has(path))
      return json(
        {
          error: {
            code: 'internal',
            message: 'The review build made this call fail.',
            details: [],
          },
        },
        500,
      );

    switch (path) {
      case '/api/v1/me':
        return json({
          user: OWNER,
          csrf: 'review',
          github_signin: { state: 'active', expires_at: '2026-11-19T18:30:00Z' },
        });
      case '/api/v1/me/preferences': {
        // The review page follows the theme mode the reader chose (localStorage), so a light page stays light.
        let theme: 'dark' | 'light' | 'system' = 'dark';
        try {
          const m = window.localStorage.getItem('crsp.theme-mode');
          if (m === 'light' || m === 'system') theme = m;
        } catch {
          /* blocked storage: dark */
        }
        return json({ theme });
      }
      case '/api/v1/app/webhook':
        return json({ state: 'off' });
      case '/api/v1/settings/public-repositories':
        return json({ enabled: false, public_on_pool: 0 });
      case '/api/v1/overview':
        return json(this.overview());
      case '/api/v1/machines':
        return json({ items: MACHINES.map((m) => machineRec(m, this.running())) });
      case '/api/v1/runners':
        return json({
          items: RUNNERS.map((r) => runnerRec(r, this.running())),
          stale: { stale: false },
        });
      case '/api/v1/repositories': {
        const items = REPOS.map(repositoryRec);
        return json({ items, stale: { stale: false } });
      }
      case '/api/v1/github/installations':
        return json({
          items: [
            {
              id: 1,
              account_login: 'luis-mc',
              account_type: 'User',
              suspended: false,
              repository_selection: 'all',
            },
          ],
          stale: { stale: false },
        });
      case '/api/v1/setup':
        return json({
          has_app: true,
          has_owner: true,
          setup_link_redeemed: true,
          steps: {
            connect_github: 'done',
            first_machine: 'done',
            first_repository: 'done',
          },
        });
      case '/api/v1/jobs':
        return json(this.jobsPage(q));
      case '/api/v1/runs':
        return json(this.runsPage(q));
      case '/api/v1/jobs/stats':
        return json(this.stats(q));
      case '/api/v1/forecast': {
        const a = this.forecastAnswer(q.get('job_key') ?? '');
        return a ? json(a) : notFound('job key');
      }
      default:
    }
    const job = /^\/api\/v1\/jobs\/(\d+)$/.exec(path);
    if (job) {
      const d = this.detail(Number(job[1]));
      return d ? json(d) : notFound('job');
    }
    const run = /^\/api\/v1\/runs\/(\d+)$/.exec(path);
    if (run) {
      const r = this.runOf(
        Number(run[1]),
        q.get('attempt') ? Number(q.get('attempt')) : undefined,
      );
      return r ? json(r) : notFound('run');
    }
    const repo = /^\/api\/v1\/repositories\/(\d+)$/.exec(path);
    if (repo) {
      const r = REPOS.find((x) => String(x.id) === repo[1]);
      return r ? json(repositoryRec(r)) : notFound('repository');
    }
    // Every other list is empty, so the areas outside Jobs open without an error.
    return json({ items: [], stale: { stale: false } });
  }
}
