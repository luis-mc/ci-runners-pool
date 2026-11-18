// Fake data for the RES15 review build: deterministic (a seeded generator and a fixed "now"), realistic, and never
// reachable from the production entry. Four repositories, two machines, about 12 queued, 8 running and 150 done
// jobs over 14 days, with steps, runners, histories and forecasts.
import type { Schemas } from '../api/api';
import {
  chainForecast,
  criticalPath,
  forecastFromSamples,
  queueEta,
  usableHistory,
  runEta,
  type DagNode,
} from '../screens/jobs-next/forecast';
import {
  makeJobKey,
  type Eta,
  type Forecast,
  type HistoryPoint,
  type JobItem,
  type JobResult,
  type JobType,
  type RunItem,
  type RunnerRef,
  type StepItem,
  type WaitReason,
} from '../screens/jobs-next/model';

/** The fixed "now" of the review build and of its screenshots. */
export const FIXED_NOW = Date.parse('2026-11-18T14:30:00Z');
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

// ---------------------------------------------------------------- generator

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

class Rng {
  private next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  f(): number {
    return this.next();
  }
  between(lo: number, hi: number): number {
    return lo + (hi - lo) * this.f();
  }
  int(lo: number, hi: number): number {
    return Math.floor(this.between(lo, hi + 1));
  }
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.f() * xs.length)] as T;
  }
  chance(p: number): boolean {
    return this.f() < p;
  }
  /** A factor around 1: most of the time inside 0.9..1.15, now and then a slow one. */
  noise(): number {
    const base = 0.9 + this.f() * 0.25;
    return this.chance(0.07) ? base * this.between(1.3, 1.9) : base;
  }
  hex(n: number): string {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(this.f() * 16).toString(16);
    return s;
  }
}

// ---------------------------------------------------------------- the pool

export const REPOS = [
  { id: 1001, full_name: 'luis-mc/ci-runners-shared-pool' },
  { id: 1002, full_name: 'luis-mc/comics-organizer' },
  { id: 1003, full_name: 'luis-mc/home-automation' },
  { id: 1004, full_name: 'luis-mc/dev-standards' },
] as const;
const repoId = (name: string) => REPOS.find((r) => r.full_name === name)?.id ?? 0;

export interface MachineRec {
  id: string;
  name: string;
  os: 'windows' | 'linux';
  backends: string[];
  slots: number;
}
export const MACHINES: MachineRec[] = [
  {
    id: 'm_gameroom',
    name: 'GameRoomPC',
    os: 'windows',
    backends: ['docker', 'wsl2', 'hyperv'],
    slots: 5,
  },
  { id: 'm_linuxbox', name: 'linux-box', os: 'linux', backends: ['docker'], slots: 4 },
];

interface RunnerRec extends RunnerRef {
  os: 'windows' | 'linux';
  /** Which job types it takes. */
  takes: JobType[];
}
const R = (
  name: string,
  kind: 'persistent' | 'ephemeral',
  machine: MachineRec,
  backend: string,
  isolation: RunnerRef['isolation'],
  os: 'windows' | 'linux',
  takes: JobType[],
): RunnerRec => ({
  id: `r_${name}`,
  name,
  kind,
  machine_id: machine.id,
  machine_name: machine.name,
  backend,
  isolation,
  cache: 'warm',
  os,
  takes,
});
const [GAME, LINUX] = MACHINES as [MachineRec, MachineRec];
export const RUNNERS: RunnerRec[] = [
  R('crsp-gameroom-hyperv-1', 'ephemeral', GAME, 'hyperv', 'VM', 'windows', [
    'standard',
    'heavy',
  ]),
  R('crsp-gameroom-hyperv-2', 'ephemeral', GAME, 'hyperv', 'VM', 'windows', [
    'standard',
    'heavy',
  ]),
  R('crsp-gameroom-win-1', 'persistent', GAME, 'persistent', 'persistent', 'windows', [
    'light',
    'standard',
  ]),
  R('crsp-gameroom-docker-1', 'ephemeral', GAME, 'docker', 'container', 'linux', [
    'light',
    'standard',
  ]),
  R('crsp-gameroom-wsl2-1', 'persistent', GAME, 'wsl2', 'persistent', 'linux', [
    'light',
    'standard',
    'heavy',
  ]),
  R('crsp-linuxbox-docker-1', 'ephemeral', LINUX, 'docker', 'container', 'linux', [
    'light',
    'standard',
  ]),
  R('crsp-linuxbox-docker-2', 'ephemeral', LINUX, 'docker', 'container', 'linux', [
    'light',
    'standard',
    'heavy',
  ]),
  R('crsp-linuxbox-docker-3', 'ephemeral', LINUX, 'docker', 'container', 'linux', [
    'standard',
    'heavy',
  ]),
  R('crsp-linuxbox-persist-1', 'persistent', LINUX, 'persistent', 'persistent', 'linux', [
    'light',
    'standard',
  ]),
];

// ---------------------------------------------------------------- workflows

type Share = readonly [string, number];
const STEPS: Record<string, readonly Share[]> = {
  light: [
    ['Set up job', 0.04],
    ['Checkout', 0.06],
    ['Restore cache', 0.08],
    ['Install dependencies', 0.22],
    ['Run checks', 0.5],
    ['Post cache', 0.06],
    ['Complete job', 0.04],
  ],
  test: [
    ['Set up job', 0.03],
    ['Checkout', 0.04],
    ['Restore cache', 0.05],
    ['Install dependencies', 0.14],
    ['Build', 0.18],
    ['Run tests', 0.45],
    ['Upload coverage', 0.05],
    ['Post cache', 0.04],
    ['Complete job', 0.02],
  ],
  build: [
    ['Set up job', 0.03],
    ['Checkout', 0.04],
    ['Restore cache', 0.06],
    ['Install dependencies', 0.12],
    ['Compile', 0.55],
    ['Upload artifact', 0.14],
    ['Post cache', 0.04],
    ['Complete job', 0.02],
  ],
  e2e: [
    ['Set up job', 0.02],
    ['Checkout', 0.03],
    ['Restore cache', 0.04],
    ['Install dependencies', 0.08],
    ['Start services', 0.1],
    ['Run browser tests', 0.6],
    ['Upload traces', 0.08],
    ['Complete job', 0.05],
  ],
  publish: [
    ['Set up job', 0.05],
    ['Download artifacts', 0.25],
    ['Sign', 0.2],
    ['Publish', 0.42],
    ['Complete job', 0.08],
  ],
};

interface JobTpl {
  name: string;
  /** Each entry is one matrix copy; none means a single job. */
  matrix?: string[][];
  needs?: string[];
  type: JobType;
  os: 'windows' | 'linux';
  /** Median seconds on a warm runner. */
  base: number;
  steps: keyof typeof STEPS;
  /** How many past runs the history holds (default 30). */
  past?: number;
  /** The job calls a reusable workflow. */
  reusable?: boolean;
}
interface WfTpl {
  repo: string;
  workflow: string;
  jobs: JobTpl[];
  /** Weight when drawing a run. */
  weight: number;
  triggers: string[];
}
const SP = 'luis-mc/ci-runners-shared-pool';
const CO = 'luis-mc/comics-organizer';
const HA = 'luis-mc/home-automation';
const DS = 'luis-mc/dev-standards';
const J = (j: JobTpl): JobTpl => j;

export const WORKFLOWS: WfTpl[] = [
  {
    repo: SP,
    workflow: 'CI',
    weight: 9,
    triggers: ['pull_request', 'push'],
    jobs: [
      J({ name: 'lint', type: 'light', os: 'linux', base: 70, steps: 'light' }),
      J({ name: 'typecheck', type: 'light', os: 'linux', base: 96, steps: 'light' }),
      J({
        name: 'unit',
        matrix: [['ubuntu'], ['windows']],
        type: 'standard',
        os: 'linux',
        base: 250,
        steps: 'test',
      }),
      J({
        name: 'integration',
        needs: ['unit'],
        type: 'standard',
        os: 'linux',
        base: 330,
        steps: 'test',
      }),
      J({
        name: 'build',
        needs: ['lint', 'typecheck'],
        type: 'standard',
        os: 'linux',
        base: 180,
        steps: 'build',
      }),
      J({
        name: 'e2e',
        needs: ['build', 'integration'],
        type: 'heavy',
        os: 'windows',
        base: 540,
        steps: 'e2e',
      }),
    ],
  },
  {
    repo: SP,
    workflow: 'Docs',
    weight: 4,
    triggers: ['pull_request', 'push'],
    jobs: [
      J({ name: 'docs-check', type: 'light', os: 'linux', base: 42, steps: 'light' }),
    ],
  },
  {
    repo: CO,
    workflow: 'CI',
    weight: 8,
    triggers: ['pull_request', 'push'],
    jobs: [
      J({ name: 'lint', type: 'light', os: 'linux', base: 55, steps: 'light' }),
      J({
        name: 'test',
        matrix: [
          ['ubuntu', '22'],
          ['ubuntu', '24'],
          ['windows', '24'],
        ],
        type: 'standard',
        os: 'linux',
        base: 210,
        steps: 'test',
      }),
      J({
        name: 'build',
        needs: ['lint', 'test'],
        type: 'standard',
        os: 'linux',
        base: 150,
        steps: 'build',
      }),
    ],
  },
  {
    repo: CO,
    workflow: 'Visual',
    weight: 2,
    triggers: ['schedule'],
    jobs: [
      J({
        name: 'e2e-visual',
        type: 'heavy',
        os: 'linux',
        base: 480,
        steps: 'e2e',
        past: 3,
      }),
    ],
  },
  {
    repo: HA,
    workflow: 'Tests',
    weight: 5,
    triggers: ['pull_request', 'push'],
    jobs: [
      J({
        name: 'py-test',
        matrix: [['3.12'], ['3.13']],
        type: 'standard',
        os: 'linux',
        base: 130,
        steps: 'test',
      }),
      J({
        name: 'integration',
        needs: ['py-test'],
        type: 'heavy',
        os: 'linux',
        base: 400,
        steps: 'e2e',
      }),
    ],
  },
  {
    repo: HA,
    workflow: 'Firmware',
    weight: 2,
    triggers: ['push'],
    jobs: [
      J({
        name: 'build-firmware',
        type: 'heavy',
        os: 'linux',
        base: 620,
        steps: 'build',
      }),
    ],
  },
  {
    repo: DS,
    workflow: 'Validate',
    weight: 3,
    triggers: ['pull_request', 'push'],
    jobs: [
      J({
        name: 'validate',
        type: 'light',
        os: 'linux',
        base: 36,
        steps: 'light',
        past: 2,
      }),
      J({ name: 'docs', type: 'light', os: 'linux', base: 52, steps: 'light', past: 2 }),
    ],
  },
];

/** The long run: 14 jobs in 5 stages over a needs graph. Not drawn at random: one run, 3 days ago. */
export const RELEASE: WfTpl = {
  repo: SP,
  workflow: 'Release',
  weight: 0,
  triggers: ['push'],
  jobs: [
    J({ name: 'lint', type: 'light', os: 'linux', base: 70, steps: 'light' }),
    J({ name: 'typecheck', type: 'light', os: 'linux', base: 96, steps: 'light' }),
    J({ name: 'unit-linux', type: 'standard', os: 'linux', base: 250, steps: 'test' }),
    J({
      name: 'unit-windows',
      type: 'standard',
      os: 'windows',
      base: 330,
      steps: 'test',
    }),
    J({
      name: 'build-controller',
      needs: ['lint', 'typecheck'],
      type: 'standard',
      os: 'linux',
      base: 200,
      steps: 'build',
    }),
    J({
      name: 'build-agent-linux',
      needs: ['lint', 'typecheck'],
      type: 'standard',
      os: 'linux',
      base: 170,
      steps: 'build',
    }),
    J({
      name: 'build-agent-windows',
      needs: ['lint', 'typecheck', 'unit-windows'],
      type: 'standard',
      os: 'windows',
      base: 260,
      steps: 'build',
    }),
    J({
      name: 'build-web',
      needs: ['lint', 'unit-linux'],
      type: 'standard',
      os: 'linux',
      base: 140,
      steps: 'build',
    }),
    J({
      name: 'integration',
      needs: ['build-controller', 'build-agent-linux'],
      type: 'standard',
      os: 'linux',
      base: 340,
      steps: 'test',
    }),
    J({
      name: 'e2e-web',
      needs: ['build-web', 'build-controller'],
      type: 'heavy',
      os: 'windows',
      base: 560,
      steps: 'e2e',
    }),
    J({
      name: 'package-msi',
      needs: ['build-agent-windows', 'integration'],
      type: 'standard',
      os: 'windows',
      base: 230,
      steps: 'build',
    }),
    J({
      name: 'package-deb',
      needs: ['build-agent-linux', 'integration'],
      type: 'standard',
      os: 'linux',
      base: 120,
      steps: 'build',
    }),
    J({
      name: 'package-docker',
      needs: ['build-controller', 'e2e-web'],
      type: 'heavy',
      os: 'linux',
      base: 410,
      steps: 'build',
    }),
    J({
      name: 'publish',
      reusable: true,
      needs: ['package-msi', 'package-deb', 'package-docker'],
      type: 'light',
      os: 'linux',
      base: 90,
      steps: 'publish',
    }),
  ],
};

const BRANCHES: Record<string, { name: string; weight: number }[]> = {
  [SP]: [
    { name: 'main', weight: 4 },
    { name: 'RES15-jobs-section', weight: 2 },
    { name: 'RES14-pool-size', weight: 1 },
    { name: 'HND27-handover-notes', weight: 1 },
    { name: 'dependabot/npm_and_yarn/vite-8.3.8', weight: 1 },
  ],
  [CO]: [
    { name: 'main', weight: 4 },
    { name: 'feature/series-grouping', weight: 2 },
    { name: 'fix/cover-cache', weight: 1 },
  ],
  [HA]: [
    { name: 'main', weight: 3 },
    { name: 'feature/garage-sensor', weight: 2 },
  ],
  [DS]: [
    { name: 'main', weight: 3 },
    { name: 'wip/css-tokens', weight: 1 },
  ],
};
const TASK_BRANCH = /^[A-Z]+\d+-/;

function weighted<T extends { weight: number }>(rng: Rng, xs: readonly T[]): T {
  let r = rng.f() * xs.reduce((a, x) => a + x.weight, 0);
  for (const x of xs) {
    r -= x.weight;
    if (r <= 0) return x;
  }
  return xs[xs.length - 1] as T;
}

// ---------------------------------------------------------------- histories and forecasts

/** The last 30 (or `past`) durations of a job key, oldest first, over about 6 weeks. */
function historyFor(tpl: JobTpl, key: string, matrixFactor: number): HistoryPoint[] {
  const rng = new Rng(hash(`history ${key}`));
  const n = tpl.past ?? 30;
  const out: HistoryPoint[] = [];
  for (let i = 0; i < n; i++) {
    const at =
      FIXED_NOW - (n - i) * (rng.between(0.6, 1.6) * DAY) - rng.between(0, 0.4) * DAY;
    const result: JobResult = rng.chance(0.9)
      ? 'success'
      : rng.chance(0.7)
        ? 'failure'
        : 'cancelled';
    const drift = 1 + (i / n - 0.5) * 0.06;
    out.push({
      at: iso(at),
      seconds: Math.round(tpl.base * matrixFactor * drift * rng.noise()),
      result,
      branch: rng.chance(0.7) ? 'main' : 'feature',
      machine: rng.chance(0.55) ? 'linux-box' : 'GameRoomPC',
    });
  }
  return out;
}

const matrixFactorOf = (m: readonly string[]): number =>
  m.includes('windows') ? 1.35 : m.includes('24') || m.includes('3.13') ? 1.05 : 1;

// ---------------------------------------------------------------- the data set

export interface FixtureData {
  now: number;
  jobs: JobItem[];
  runs: RunItem[];
  histories: Map<string, HistoryPoint[]>;
  /** Planned seconds of each step of a running job; the live view advances them with the clock. */
  plans: Map<number, number[]>;
}

const WAIT_TEXT: Record<WaitReason, (machine: string) => string> = {
  free_slot: (m) => `waits for a free slot on ${m} (every slot is busy)`,
  load_over_budget: (m) =>
    `waits until the load of ${m} is under its budget (memory 91% over 80%)`,
  no_runner_with_labels: () =>
    'waits for a runner with its labels (self-hosted, windows, crsp-heavy)',
  repository_parallel_limit: () =>
    "waits for the repository's parallel limit (2 of 2 running)",
  machine_drained: (m) => `waits because ${m} is not taking jobs (it is being drained)`,
  quiet_hours: () => 'waits for quiet hours to end at 18:00',
  load_not_measured: (m) => `waits because the load of ${m} is not measured yet`,
  paused: (m) => `waits because ${m} is paused`,
  on_battery: (m) => `waits because ${m} runs on battery`,
  unknown: () => 'waits, the reason is not known yet',
};

interface Ctx {
  rng: Rng;
  jobs: JobItem[];
  nextJobId: number;
  nextRunId: number;
  histories: Map<string, HistoryPoint[]>;
  plans: Map<number, number[]>;
  /** Count of runs that reported a worktree: some task-branch jobs do. */
  busy: Map<string, number>;
}

function copiesOf(t: JobTpl): string[][] {
  return t.matrix ?? [[]];
}
const nodeIdOf = (t: JobTpl, m: readonly string[]) =>
  m.length ? `${t.name} [${m.join(', ')}]` : t.name;

/** Steps of a finished or planned job: shares of the run time, with a failure cutting the job short. */
function makeSteps(
  tpl: JobTpl,
  startMs: number,
  runSec: number,
  result: JobResult,
  rng: Rng,
  jobForecast: Forecast,
): StepItem[] {
  const shares = STEPS[tpl.steps] as readonly Share[];
  const total = shares.reduce((a, s) => a + s[1], 0);
  const failAt =
    result === 'success' ? -1 : shares.length - 3 - (rng.chance(0.5) ? 1 : 0);
  const out: StepItem[] = [];
  let t = startMs;
  let remaining = runSec;
  shares.forEach(([name, share], i) => {
    const forecast = stepForecast(jobForecast, share / total);
    if (failAt >= 0 && i > failAt && i < shares.length - 1) {
      out.push({ number: i + 1, name, state: 'skipped', result: 'skipped', forecast });
      return;
    }
    const last = i === shares.length - 1;
    const own = last
      ? Math.max(1, remaining)
      : Math.max(1, Math.round(((runSec * share) / total) * (0.85 + rng.f() * 0.3)));
    const sec = Math.min(own, Math.max(1, remaining - (last ? 0 : 1)));
    const stepResult: StepItem['result'] =
      i === failAt ? (result === 'cancelled' ? 'cancelled' : 'failure') : 'success';
    out.push({
      number: i + 1,
      name,
      state: 'done',
      result: stepResult,
      started_at: iso(t),
      completed_at: iso(t + sec * 1000),
      run_seconds: sec,
      forecast,
    });
    t += sec * 1000;
    remaining -= sec;
  });
  return out;
}

function stepForecast(job: Forecast, share: number): Forecast {
  if (job.basis === 'not_enough_history') return job;
  return {
    ...job,
    p50: Math.max(1, Math.round(job.p50 * share)),
    lo: Math.max(1, Math.round(job.lo * share)),
    hi: Math.max(1, Math.round(job.hi * share)),
  };
}

interface RunSpec {
  tpl: WfTpl;
  id: number;
  attempt: number;
  createdAt: number;
  branch: string;
  trigger: string;
  /** Only jobs in this set exist (a re-run after a failure). */
  only?: Set<string>;
  /** Open runs: the state of each node; done runs: leave out. */
  open?: Record<string, 'done' | 'running' | 'queued' | 'blocked'> | undefined;
  /** Force a failure in this node (done runs). */
  fail?: { node: string; result: JobResult } | undefined;
  /** The job reports its worktree. */
  worktree?: string | undefined;
  /** Extra wait seconds to model a busy pool. */
  busy?: number;
}

function makeRun(ctx: Ctx, spec: RunSpec): JobItem[] {
  const { rng, histories } = ctx;
  const { tpl } = spec;
  const sha = rng.hex(40);
  const pr = spec.trigger === 'pull_request' ? 40 + (hash(spec.branch) % 60) : undefined;
  const nodes = tpl.jobs.flatMap((t) =>
    copiesOf(t).map((m) => ({ t, m, id: nodeIdOf(t, m) })),
  );
  const byName = (name: string) => nodes.filter((n) => n.t.name === name);
  const made = new Map<string, JobItem>();
  const finish = new Map<string, number>();
  const failedNodes = new Set<string>();
  const out: JobItem[] = [];
  const runnerFree = new Map<string, number>(); // runner id -> time it is free again
  const open = spec.open;

  // Order the nodes so needs come first.
  const order: typeof nodes = [];
  const place = (n: (typeof nodes)[number]) => {
    if (order.includes(n)) return;
    for (const need of n.t.needs ?? []) for (const dep of byName(need)) place(dep);
    order.push(n);
  };
  nodes.forEach(place);

  for (const n of order) {
    if (spec.only && !spec.only.has(n.id)) continue;
    const needs = (n.t.needs ?? []).flatMap((x) => byName(x).map((d) => d.id));
    // A node whose need failed or never ran does not run (done runs).
    if (
      !open &&
      needs.some(
        (d) =>
          failedNodes.has(d) || (spec.only && !spec.only.has(d) ? false : !made.has(d)),
      )
    ) {
      if (needs.some((d) => failedNodes.has(d))) {
        failedNodes.add(n.id);
        continue;
      }
    }
    const key = makeJobKey(tpl.repo, tpl.workflow, n.t.name, n.m);
    let hist = histories.get(key);
    if (!hist) {
      hist = historyFor(n.t, key, matrixFactorOf(n.m));
      histories.set(key, hist);
    }
    const id = ctx.nextJobId++;
    const state0 = open ? (open[n.id] ?? 'blocked') : 'done';
    const factor = matrixFactorOf(n.m);
    const planned = Math.round(n.t.base * factor * rng.noise());
    const waitBase = open
      ? rng.between(8, 60)
      : rng.chance(0.15)
        ? rng.between(120, 900)
        : rng.between(4, 70);
    const wait = Math.round(waitBase + (spec.busy ?? 0));

    // Runner.
    const eligible = RUNNERS.filter(
      (r) =>
        r.os === (n.m.includes('windows') ? 'windows' : n.t.os) &&
        r.takes.includes(n.t.type),
    );
    const runner = rng.pick(eligible.length ? eligible : RUNNERS);

    let queuedAt: number;
    let startedAt: number | undefined;
    let completedAt: number | undefined;
    let state: JobItem['state'] = 'done';
    let result: JobResult | undefined = 'success';
    let runSec = planned;
    if (open) {
      if (state0 === 'done') {
        completedAt = FIXED_NOW - Math.round(rng.between(90, 420)) * 1000;
        startedAt = completedAt - planned * 1000;
        queuedAt = startedAt - wait * 1000;
      } else if (state0 === 'running') {
        const elapsed = Math.round(rng.between(0.2, 0.7) * planned);
        startedAt = FIXED_NOW - elapsed * 1000;
        queuedAt = startedAt - wait * 1000;
        state = 'running';
        result = undefined;
        runSec = elapsed;
        ctx.plans.set(id, planSteps(n.t, planned, rng));
      } else if (state0 === 'queued') {
        queuedAt = FIXED_NOW - Math.round(rng.between(40, 900)) * 1000;
        state = 'queued';
        result = undefined;
        runSec = 0;
      } else {
        queuedAt = FIXED_NOW;
        state = 'queued';
        result = undefined;
        runSec = 0;
      }
    } else {
      const ready = Math.max(
        spec.createdAt + 3000,
        ...needs.map((d) => finish.get(d) ?? 0),
      );
      queuedAt = ready + Math.round(rng.between(1, 4)) * 1000;
      const free = runnerFree.get(runner.id) ?? 0;
      startedAt = Math.max(queuedAt + wait * 1000, free);
      const fail = spec.fail?.node === n.id ? spec.fail.result : undefined;
      result = fail ?? 'success';
      if (result === 'timed_out') runSec = Math.round(planned * 3.2);
      else if (result === 'failure')
        runSec = Math.round(planned * rng.between(0.35, 0.9));
      else if (result === 'cancelled')
        runSec = Math.round(planned * rng.between(0.2, 0.6));
      completedAt = startedAt + runSec * 1000;
      runnerFree.set(runner.id, completedAt + 20_000);
      finish.set(n.id, completedAt + 20_000);
      if (result !== 'success') failedNodes.add(n.id);
    }

    const forecast = chainForecast(
      {
        jobKey: hist.filter((h) => Date.parse(h.at) < (startedAt ?? FIXED_NOW)),
        workflow: workflowHistory(ctx, tpl).filter(
          (h) => Date.parse(h.at) < (startedAt ?? FIXED_NOW),
        ),
        repository: repoHistory(ctx, tpl.repo).filter(
          (h) => Date.parse(h.at) < (startedAt ?? FIXED_NOW),
        ),
      },
      startedAt ?? FIXED_NOW,
      runner.machine_name,
    );

    const runnerRef: RunnerRef | undefined =
      state === 'queued'
        ? undefined
        : {
            id: runner.id,
            name: runner.name,
            kind: runner.kind,
            machine_id: runner.machine_id,
            machine_name: runner.machine_name,
            backend: runner.backend,
            isolation: runner.isolation,
            cache: rng.chance(0.78) ? 'warm' : 'cold',
          };
    if (runnerRef?.cache === 'cold')
      runSec = state === 'done' ? Math.round(runSec * 1.18) : runSec;
    if (state === 'done' && startedAt !== undefined && runnerRef?.cache === 'cold')
      completedAt = startedAt + runSec * 1000;

    const job: JobItem = {
      id,
      repository: tpl.repo,
      repository_id: repoId(tpl.repo),
      run_id: spec.id,
      run_attempt: spec.attempt,
      github_job_id: 31_000_000_000 + (hash(`${spec.id}-${n.id}`) % 900_000_000),
      workflow: tpl.workflow,
      job_name: nodeIdOf(n.t, n.m),
      head_sha: sha,
      trigger: spec.trigger,
      labels: labelsOf(n.t, n.m),
      state,
      created_at: iso(spec.createdAt),
      queued_at: iso(queuedAt),
      html_url: `https://github.com/${tpl.repo}/actions/runs/${spec.id}/job/${31_000_000_000 + (hash(`${spec.id}-${n.id}`) % 900_000_000)}`,
      jobKey: key,
      node_id: n.id,
      matrix: n.m,
      branch: spec.branch,
      job_type: n.t.type,
      ...(n.t.reusable ? { reusable: true } : {}),
      needs,
      forecast,
      ...(pr ? { pull_request: pr } : {}),
      ...(spec.worktree ? { worktree: spec.worktree } : {}),
    };
    if (startedAt !== undefined && runnerRef) {
      job.started_at = iso(startedAt);
      job.slot_at = iso(startedAt - 2000);
      job.machine_id = runnerRef.machine_id;
      job.runner_id = runnerRef.id;
      job.runner_name = runnerRef.name;
      job.backend = runnerRef.backend;
      job.isolation = runnerRef.isolation;
      job.runner = runnerRef;
      job.github_wait_seconds = Math.round((startedAt - queuedAt) / 1000);
      job.slot_wait_seconds = Math.max(0, job.github_wait_seconds - 3);
    }
    if (state === 'done' && completedAt !== undefined && startedAt !== undefined) {
      job.completed_at = iso(completedAt);
      job.run_seconds = runSec;
      job.result = result as JobResult;
      job.cleanup_seconds =
        runnerRef?.isolation === 'VM'
          ? Math.round(rng.between(38, 85))
          : Math.round(rng.between(4, 24));
      job.steps = makeSteps(n.t, startedAt, runSec, result as JobResult, rng, forecast);
    } else if (state === 'running' && startedAt !== undefined) {
      const template: StepItem[] = (STEPS[n.t.steps] as readonly Share[]).map(
        ([name, share], i) => ({
          number: i + 1,
          name,
          state: 'queued' as const,
          forecast: stepForecast(forecast, share),
        }),
      );
      job.steps = liveSteps(
        { ...job, steps: template },
        ctx.plans.get(id) ?? [],
        FIXED_NOW,
      );
    } else {
      job.steps = (STEPS[n.t.steps] as readonly Share[]).map(([name, share], i) => ({
        number: i + 1,
        name,
        state: 'queued' as const,
        forecast: stepForecast(forecast, share),
      }));
    }
    if (state === 'done' && (job.github_wait_seconds ?? 0) > 90) {
      const reason: WaitReason = rng.chance(0.7) ? 'free_slot' : 'load_over_budget';
      job.wait_reason = reason;
      job.wait_text = WAIT_TEXT[reason](runnerRef?.machine_name ?? 'the machine');
    }
    if (state === 'queued' && state0 === 'queued') {
      job.wait_reason = 'free_slot';
    }
    if (state === 'queued' && state0 === 'blocked') {
      job.wait_text = `waits for ${needs.length > 2 ? `${needs.length} jobs` : needs.join(' and ')} to finish`;
    }
    made.set(n.id, job);
    out.push(job);
  }
  return out;
}

function planSteps(t: JobTpl, plannedSec: number, rng: Rng): number[] {
  const shares = STEPS[t.steps] as readonly Share[];
  const total = shares.reduce((a, s) => a + s[1], 0);
  return shares.map(([, s]) =>
    Math.max(1, Math.round(((plannedSec * s) / total) * (0.9 + rng.f() * 0.2))),
  );
}

/** The steps of a running job at time `now`, from its planned step seconds: done, one running, the rest queued. */
export function liveSteps(
  job: JobItem,
  plan: readonly number[],
  now: number,
): StepItem[] {
  const started = job.started_at ? Date.parse(job.started_at) : now;
  const elapsed = Math.max(0, (now - started) / 1000);
  const base = job.steps ?? [];
  let acc = 0;
  let runningSeen = false;
  return base.map((s, i) => {
    const sec = plan[i] ?? 10;
    const start = acc;
    acc += sec;
    const last = i === base.length - 1;
    if (elapsed >= acc && !last) {
      return {
        ...s,
        state: 'done' as const,
        result: 'success' as const,
        started_at: iso(started + start * 1000),
        completed_at: iso(started + acc * 1000),
        run_seconds: sec,
      };
    }
    if (!runningSeen && (elapsed >= start || last)) {
      runningSeen = true;
      const { result: _r, completed_at: _c, ...rest } = s;
      void _r;
      void _c;
      return {
        ...rest,
        state: 'running' as const,
        started_at: iso(started + start * 1000),
        run_seconds: Math.max(0, Math.round(elapsed - start)),
      };
    }
    const { result: _r, started_at: _s, completed_at: _c, run_seconds: _d, ...rest } = s;
    void _r;
    void _s;
    void _c;
    void _d;
    return { ...rest, state: 'queued' as const };
  });
}

function labelsOf(t: JobTpl, m: readonly string[]): string[] {
  const os = m.includes('windows') ? 'windows' : t.os;
  const base = ['self-hosted', os];
  if (t.type === 'light') base.push('crsp-light');
  if (t.type === 'heavy') base.push('crsp-heavy');
  return base;
}

function workflowHistory(ctx: Ctx, tpl: WfTpl): HistoryPoint[] {
  const out: HistoryPoint[] = [];
  for (const t of tpl.jobs)
    for (const m of copiesOf(t)) {
      const key = makeJobKey(tpl.repo, tpl.workflow, t.name, m);
      let h = ctx.histories.get(key);
      if (!h) {
        h = historyFor(t, key, matrixFactorOf(m));
        ctx.histories.set(key, h);
      }
      out.push(...h);
    }
  return out;
}
function repoHistory(ctx: Ctx, repo: string): HistoryPoint[] {
  return [...WORKFLOWS, RELEASE]
    .filter((w) => w.repo === repo)
    .flatMap((w) => workflowHistory(ctx, w));
}

// ---------------------------------------------------------------- the build

/** Builds every fixture for a fixed "now". Same input, same output. */
export function buildFixtures(now = FIXED_NOW): FixtureData {
  const ctx: Ctx = {
    rng: new Rng(20261118),
    jobs: [],
    nextJobId: 5001,
    nextRunId: 8101,
    histories: new Map(),
    plans: new Map(),
    busy: new Map(),
  };
  const rng = ctx.rng;
  const jobs: JobItem[] = [];
  const specs: RunSpec[] = [];

  // Done runs: drawn over 14 days, fewer at the weekend, working hours.
  const total = 33;
  const times: number[] = [];
  for (let i = 0; i < total; i++) {
    let at: number;
    do {
      const day = Math.floor(rng.between(0, 14));
      const hour = rng.chance(0.85) ? rng.between(8, 22) : rng.between(0, 24);
      at = now - day * DAY - (now % DAY) + hour * 3_600_000;
      const wd = new Date(at).getUTCDay();
      if ((wd === 0 || wd === 6) && rng.chance(0.65)) at = now + 1;
    } while (at > now - 50 * 60_000);
    times.push(at);
  }
  times.sort((a, b) => a - b);
  const retried = 15;
  times.forEach((at, i) => {
    const tpl = weighted(rng, WORKFLOWS);
    const branch = weighted(
      rng,
      BRANCHES[tpl.repo] as { name: string; weight: number }[],
    ).name;
    const trigger =
      tpl.triggers.length === 1
        ? (tpl.triggers[0] as string)
        : branch === 'main'
          ? 'push'
          : 'pull_request';
    const nodeNames = tpl.jobs.flatMap((t) => copiesOf(t).map((m) => nodeIdOf(t, m)));
    const roll = rng.f();
    const forced: Record<number, JobResult> = {
      4: 'cancelled',
      9: 'timed_out',
      12: 'failure',
      22: 'failure',
    };
    const fail: RunSpec['fail'] =
      i === retried
        ? { node: 'integration', result: 'failure' }
        : forced[i]
          ? { node: rng.pick(nodeNames), result: forced[i] }
          : roll < 0.08
            ? { node: rng.pick(nodeNames), result: 'failure' }
            : undefined;
    const spec: RunSpec = {
      tpl: i === retried ? (WORKFLOWS[0] as WfTpl) : tpl,
      id: ctx.nextRunId++,
      attempt: 1,
      createdAt: at,
      branch: i === retried ? 'RES14-pool-size' : branch,
      trigger: i === retried ? 'pull_request' : trigger,
      ...(fail ? { fail } : {}),
      ...(TASK_BRANCH.test(branch) && rng.chance(0.4) ? { worktree: branch } : {}),
      ...(rng.chance(0.12) ? { busy: rng.between(60, 400) } : {}),
    };
    specs.push(spec);
  });
  specs.sort((a, b) => a.createdAt - b.createdAt);

  for (const spec of specs) {
    const made = makeRun(ctx, spec);
    jobs.push(...made);
    if (
      spec.fail &&
      spec.branch === 'RES14-pool-size' &&
      spec.fail.node === 'integration'
    ) {
      // The retry: attempt 2 re-runs the failed job and what depends on it.
      const failedIds = new Set(
        made.filter((j) => j.result === 'failure').map((j) => j.node_id),
      );
      const again = new Set<string>();
      for (const n of spec.tpl.jobs.flatMap((t) =>
        copiesOf(t).map((m) => ({ id: nodeIdOf(t, m), t })),
      )) {
        if (failedIds.has(n.id)) again.add(n.id);
      }
      again.add('e2e').add('build');
      const last = Math.max(
        ...made.map((j) => Date.parse(j.completed_at ?? j.created_at ?? '')),
      );
      jobs.push(
        ...makeRun(ctx, {
          ...spec,
          attempt: 2,
          createdAt: last + 14 * 60_000,
          only: new Set([...again].filter((x) => x !== 'build')),
          fail: undefined,
        }),
      );
    }
  }

  // The long run: 14 jobs, 5 stages, 3 days ago.
  jobs.push(
    ...makeRun(ctx, {
      tpl: RELEASE,
      id: ctx.nextRunId++,
      attempt: 1,
      createdAt: now - 3 * DAY - 3_600_000 * 2,
      branch: 'main',
      trigger: 'push',
    }),
  );

  // Open runs: running jobs and their blocked jobs.
  const open: [WfTpl, string, string, RunSpec['open'], string | undefined][] = [
    [
      WORKFLOWS[0] as WfTpl,
      'RES15-jobs-section',
      'pull_request',
      {
        lint: 'done',
        typecheck: 'done',
        'unit [ubuntu]': 'running',
        'unit [windows]': 'running',
        integration: 'blocked',
        build: 'queued',
        e2e: 'blocked',
      },
      'RES15-jobs-section',
    ],
    [
      WORKFLOWS[2] as WfTpl,
      'main',
      'push',
      {
        lint: 'done',
        'test [ubuntu, 22]': 'running',
        'test [ubuntu, 24]': 'running',
        'test [windows, 24]': 'running',
        build: 'blocked',
      },
      undefined,
    ],
    [
      WORKFLOWS[4] as WfTpl,
      'feature/garage-sensor',
      'pull_request',
      {
        'py-test [3.12]': 'running',
        'py-test [3.13]': 'running',
        integration: 'blocked',
      },
      undefined,
    ],
    [
      WORKFLOWS[6] as WfTpl,
      'main',
      'push',
      { validate: 'running', docs: 'done' },
      undefined,
    ],
  ];
  open.forEach(([tpl, branch, trigger, states, worktree], i) => {
    jobs.push(
      ...makeRun(ctx, {
        tpl,
        id: ctx.nextRunId++,
        attempt: 1,
        createdAt: now - (9 + i * 3) * 60_000,
        branch,
        trigger,
        open: states,
        ...(worktree ? { worktree } : {}),
      }),
    );
  });

  // Queued runs: every job waits in the queue, in order.
  const queuedRuns: [WfTpl, string, string, RunSpec['open']][] = [
    [
      WORKFLOWS[0] as WfTpl,
      'dependabot/npm_and_yarn/vite-8.3.8',
      'pull_request',
      {
        lint: 'queued',
        typecheck: 'queued',
        'unit [ubuntu]': 'queued',
        'unit [windows]': 'queued',
        integration: 'blocked',
        build: 'blocked',
        e2e: 'blocked',
      },
    ],
    [
      WORKFLOWS[2] as WfTpl,
      'feature/series-grouping',
      'pull_request',
      {
        lint: 'queued',
        'test [ubuntu, 22]': 'queued',
        'test [ubuntu, 24]': 'queued',
        'test [windows, 24]': 'queued',
        build: 'blocked',
      },
    ],
    [WORKFLOWS[5] as WfTpl, 'main', 'push', { 'build-firmware': 'queued' }],
    [
      WORKFLOWS[6] as WfTpl,
      'wip/css-tokens',
      'pull_request',
      { validate: 'queued', docs: 'blocked' },
    ],
    [
      WORKFLOWS[1] as WfTpl,
      'HND27-handover-notes',
      'pull_request',
      { 'docs-check': 'queued' },
    ],
    [WORKFLOWS[3] as WfTpl, 'main', 'schedule', { 'e2e-visual': 'queued' }],
  ];
  queuedRuns.forEach(([tpl, branch, trigger, states], i) => {
    jobs.push(
      ...makeRun(ctx, {
        tpl,
        id: ctx.nextRunId++,
        attempt: 1,
        createdAt: now - (14 - i * 2) * 60_000,
        branch,
        trigger,
        open: states,
        ...(TASK_BRANCH.test(branch) ? { worktree: branch } : {}),
      }),
    );
  });

  // Queue order: by the time a job joined the queue; then the gate's reason and the ETA of each.
  const queued = jobs
    .filter((j) => j.state === 'queued' && j.wait_reason === 'free_slot')
    .sort((a, b) => (a.queued_at ?? '').localeCompare(b.queued_at ?? ''));
  const reasons: WaitReason[] = [
    'free_slot',
    'free_slot',
    'load_over_budget',
    'free_slot',
    'repository_parallel_limit',
    'free_slot',
    'no_runner_with_labels',
    'free_slot',
    'quiet_hours',
    'free_slot',
    'machine_drained',
    'free_slot',
  ];
  const running = jobs.filter((j) => j.state === 'running');
  const totalSlots = MACHINES.reduce((a, m) => a + m.slots, 0);
  const runningLeft = running.map((j) => {
    const done = j.started_at ? (now - Date.parse(j.started_at)) / 1000 : 0;
    return Math.max(5, j.forecast.p50 - done);
  });
  queued.forEach((j, i) => {
    j.queue_position = i + 1;
    const reason = reasons[i] ?? 'free_slot';
    j.wait_reason = reason;
    const machine = j.labels.includes('windows')
      ? 'GameRoomPC'
      : j.job_type === 'heavy'
        ? 'linux-box'
        : i % 2
          ? 'linux-box'
          : 'GameRoomPC';
    j.wait_text = `${WAIT_TEXT[reason](machine)}${i > 0 ? `, ${i} ahead in the queue` : ''}`;
    const ahead: Eta[] = queued.slice(0, i).map((q) => etaOf(q.forecast, 240));
    j.queue_eta = finiteEta(
      queueEta({
        runningLeft,
        freeSlots: Math.max(0, totalSlots - running.length),
        ahead,
      }),
    );
  });

  // Runs from the jobs.
  const runs = buildRuns(jobs, now);
  // Open runs' ETA: the longest path over the needs graph.
  for (const r of runs) {
    if (r.state !== 'done') {
      const dag = dagOf(r.jobs, now);
      r.eta = runEta(dag);
    }
  }

  return { now, jobs, runs, histories: ctx.histories, plans: ctx.plans };
}

function etaOf(f: Forecast, fallback: number): Eta {
  return f.basis === 'not_enough_history'
    ? { p50: fallback, lo: fallback * 0.8, hi: fallback * 1.3 }
    : { p50: f.p50, lo: f.lo, hi: f.hi };
}
function finiteEta(e: Eta): Eta {
  const f = (n: number) => (Number.isFinite(n) ? Math.round(n) : 3600);
  return { p50: f(e.p50), lo: f(e.lo), hi: f(e.hi) };
}

/** The nodes of a run for the critical path: what each still has to run, from `now`. */
export function dagOf(jobs: readonly JobItem[], now: number): DagNode[] {
  return jobs.map((j) => {
    const base = etaOf(j.forecast, 240);
    let remaining: Eta;
    // The run's range is the sum of p25 to the sum of p75 along the path (forecast method 6).
    const q = {
      p50: base.p50,
      lo: j.forecast.p25 ?? base.lo,
      hi: j.forecast.p75 ?? base.hi,
    };
    if (j.state === 'done') remaining = { p50: 0, lo: 0, hi: 0 };
    else if (j.state === 'running') {
      const ran = j.started_at ? (now - Date.parse(j.started_at)) / 1000 : 0;
      remaining = {
        p50: Math.max(5, q.p50 - ran),
        lo: Math.max(3, q.lo - ran),
        hi: Math.max(8, q.hi - ran),
      };
    } else remaining = q;
    return { id: j.node_id, needs: j.needs, remaining };
  });
}

export function buildRuns(jobs: readonly JobItem[], now: number): RunItem[] {
  const groups = new Map<string, JobItem[]>();
  for (const j of jobs) {
    const k = `${j.run_id}:${j.run_attempt}`;
    groups.set(k, [...(groups.get(k) ?? []), j]);
  }
  const attemptsOf = new Map<number, number[]>();
  for (const j of jobs) {
    const a = attemptsOf.get(j.run_id) ?? [];
    if (!a.includes(j.run_attempt))
      attemptsOf.set(j.run_id, [...a, j.run_attempt].sort());
  }
  const runs: RunItem[] = [];
  for (const js of groups.values()) {
    const first = js[0] as JobItem;
    const ids = new Set(js.map((j) => j.node_id));
    const edges: [string, string][] = js.flatMap((j) =>
      j.needs.filter((n) => ids.has(n)).map((n): [string, string] => [n, j.node_id]),
    );
    const dag = dagOf(js, now);
    const state: RunItem['state'] = js.some((j) => j.state === 'running')
      ? 'running'
      : js.some((j) => j.state === 'queued')
        ? 'queued'
        : 'done';
    const worktree = js.find((j) => j.worktree)?.worktree;
    const pr = first.pull_request;
    runs.push({
      id: first.run_id,
      attempt: first.run_attempt,
      attempts: attemptsOf.get(first.run_id) ?? [1],
      repository: first.repository,
      workflow: first.workflow ?? 'workflow',
      branch: first.branch,
      head_sha: first.head_sha ?? '',
      trigger: first.trigger ?? 'push',
      html_url: `https://github.com/${first.repository}/actions/runs/${first.run_id}`,
      state,
      created_at: first.created_at ?? iso(now),
      jobs: js,
      edges,
      critical_path: criticalIds(dag),
      graph: { source: 'workflow_file', sha: first.head_sha ?? '' },
      ...(pr ? { pull_request: pr } : {}),
      ...(worktree ? { worktree } : {}),
    });
  }
  // One finished run whose workflow file could not be read: only the overlap in time is drawn.
  const odd = [...runs]
    .filter((r) => r.state === 'done' && r.attempt === 1 && r.jobs.length >= 4)
    .sort((a, b) => a.id - b.id)[2];
  if (odd) odd.graph = { source: 'timing', sha: odd.head_sha };
  return runs;
}

function criticalIds(dag: DagNode[]): string[] {
  return criticalPath(dag, 'p50').path;
}

/** The forecast of a key from its history, for the forecast endpoint. */
export function forecastOfKey(h: readonly HistoryPoint[], branch = 'main'): Forecast {
  void branch;
  const u = usableHistory(h, FIXED_NOW);
  return forecastFromSamples(
    u.points.map((p) => p.seconds),
    'job_key',
  );
}

/** Wire shape for the shell: the contract's own Job fields only. */
export function toSchemaJob(j: JobItem): Schemas['Job'] {
  const {
    jobKey: _k,
    node_id: _n,
    matrix: _m,
    branch: _b,
    pull_request: _p,
    worktree: _w,
    job_type: _t,
    reusable: _ru,
    needs: _nd,
    runner: _r,
    cleanup_seconds: _c,
    queue_position: _q,
    queue_eta: _e,
    forecast: _f,
    steps: _s,
    ...rest
  } = j;
  void [_k, _n, _m, _b, _p, _w, _t, _ru, _nd, _r, _c, _q, _e, _f, _s];
  return rest;
}
