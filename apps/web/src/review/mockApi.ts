// The mock API of the review build: a fetch implementation that answers the shell, the other areas and the PROPOSED
// Images and caches endpoints from the fake fixtures. Nothing here is reachable from the production entry (main.tsx).
import type { Schemas } from '../api/api';
import type {
  ImageBuild,
  ImagesOverview,
  RepoScan,
  StackSummary,
  ToolCache,
} from '../screens/images-next/model';
import {
  FIXED_NOW,
  MACHINES,
  REPOS,
  RUNNERS,
  buildFixtures,
  LAYER_CATALOG,
  cacheFixtures,
  liveBuild,
  poolRows,
} from './fixtures';
import { compareFixture, registryFixtures } from './registryFixtures';
import type { RegistryOverview } from '../screens/images-next/registryModel';

const OWNER: Schemas['User'] = {
  id: 1,
  login: 'luis-mc',
  role: 'owner',
  added_at: '2026-10-01T10:00:00Z',
};

function machineRec(m: (typeof MACHINES)[number]): Schemas['Machine'] {
  return {
    id: m.id,
    name: m.name,
    os: m.os,
    arch: m.arch,
    state: 'active',
    online: true,
    is_controller: m.os === 'windows',
    backends: m.backends.map((b) => ({
      name: b,
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
      allowed_backends: [...m.backends] as Schemas['BackendName'][],
      drain_timeout_minutes: 30,
      windows_symlink_right: m.os === 'windows',
      mode: 'automatic',
      pause_on_battery: true,
      cpu_cap_pct: 100,
    },
    accepting: true,
    taking: { taking_jobs: true },
    load: {
      memory_pct: 48,
      cpu_pct: 30,
      memory_known: true,
      cpu_known: true,
      sampled_at: new Date(Date.now()).toISOString(),
      stale: false,
    },
    slots_used: 0,
    last_seen_at: new Date(Date.now()).toISOString(),
    running_jobs: [],
  };
}

function runnerRec(r: (typeof RUNNERS)[number]): Schemas['Runner'] {
  return {
    id: r.id,
    name: r.name,
    machine_id: r.machine_id,
    machine_name: r.machine_name,
    os: r.os,
    arch: 'x64',
    kind: r.kind,
    backend: r.backend,
    isolation: r.isolation,
    labels: ['self-hosted', r.os],
    scope: { kind: 'pool' },
    state: 'idle',
    managed: true,
    keeps_state: r.kind === 'persistent',
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

/** The fake controller. `now` is the review clock; the running build advances with it. */
export class ReviewApi {
  private data: ImagesOverview & { scans: RepoScan[] };
  private caches: ToolCache[];
  private now: () => number;
  /** Repositories whose findings the reader confirmed in this page view. */
  private confirmed = new Set<string>();
  private retried = new Map<string, number>();
  private cleared = new Set<string>();
  /** Registry changes of this page view: deleted images, replaced images, edited budgets. */
  private deleted = new Set<string>();
  private replaced = new Set<string>();
  private budgets: {
    standard?: number;
    custom?: number;
    unused?: number;
    keep?: number;
  } = {};

  constructor(now: () => number = () => FIXED_NOW) {
    this.now = now;
    this.data = buildFixtures();
    this.caches = cacheFixtures();
  }

  private builds(): ImageBuild[] {
    return this.data.builds.map((b) => {
      const again = this.retried.get(b.id);
      const eff: ImageBuild =
        again !== undefined
          ? {
              ...b,
              state: 'building',
              started_at: new Date(again).toISOString(),
              ...(b.finished_at ? { finished_at: '' } : {}),
              steps: [],
              log: [],
            }
          : b;
      return liveBuild(eff, this.now());
    });
  }

  private scans(): RepoScan[] {
    return this.data.scans.map((s) =>
      this.confirmed.has(s.repository)
        ? {
            ...s,
            state: 'confirmed',
            findings: s.findings.map((f) =>
              f.state === 'new' ? { ...f, state: 'covered' as const } : f,
            ),
          }
        : s,
    );
  }

  /** The builds that run now, for the activity strip of the review shell. */
  running(): ImageBuild[] {
    return this.builds().filter((b) => b.state === 'building');
  }

  overview(): Schemas['Overview'] {
    return {
      machines: MACHINES.map(machineRec),
      queued_count: 0,
      queued: [],
      waiting: [],
      running: [],
      minutes_saved_today: [
        { os: 'linux', minutes: 74 },
        { os: 'windows', minutes: 41 },
      ],
      last_event_id: '1',
    };
  }

  images(): ImagesOverview {
    const scans = this.scans();
    const pending = scans.filter((s) => s.state === 'needs_you');
    return {
      ...this.data,
      builds: this.builds(),
      pending_repositories: pending.length,
      pending_findings: pending.reduce(
        (n, s) => n + s.findings.filter((f) => f.state !== 'covered').length,
        0,
      ),
    };
  }

  /** The registry as this page view has changed it. */
  registry(): RegistryOverview {
    const GB = 1e9;
    const base = registryFixtures();
    const images = base.images
      .filter((i) => !this.deleted.has(i.id))
      .map((i) => {
        if (this.replaced.has(i.id)) return { ...i, state: 'current' as const };
        if (i.replaced_by && this.replaced.has(i.replaced_by))
          return {
            ...i,
            state: 'superseded' as const,
            keep_until: new Date(this.now() + 7 * 86_400_000).toISOString(),
          };
        return i;
      });
    const gone = (to: string) => {
      const m = /registry\/(reg_[a-z0-9_]+)/.exec(to);
      return m?.[1] ? this.deleted.has(m[1]) || this.replaced.has(m[1]) : false;
    };
    const b = this.budgets;
    const freed = base.images
      .filter((i) => this.deleted.has(i.id) && i.kind === 'custom')
      .reduce((n, i) => n + i.unique_bytes, 0);
    const custom = {
      ...base.custom,
      used_bytes: base.custom.used_bytes - freed,
      budget_bytes: (b.custom ?? base.custom.budget_bytes / GB) * GB,
    };
    return {
      ...base,
      images,
      standard: {
        ...base.standard,
        budget_bytes: (b.standard ?? base.standard.budget_bytes / GB) * GB,
      },
      custom,
      unused_days: b.unused ?? base.unused_days,
      keep_old_days: b.keep ?? base.keep_old_days,
      recommendations: base.recommendations.filter(
        (r) =>
          !gone(r.to) &&
          !(r.kind === 'over budget' && custom.used_bytes <= custom.budget_bytes),
      ),
    };
  }

  /** Writes of the registry: delete refuses while a runner uses the image (409), the rest changes the fake state. */
  private registryWrite(
    method: string,
    path: string,
    query: URLSearchParams,
  ): Response | undefined {
    const img = /^\/api\/v1\/registry\/images\/([^/]+)(\/replace)?$/.exec(path);
    if (img?.[1]) {
      const id = img[1];
      if (method === 'POST' && img[2]) {
        this.replaced.add(id);
        return new Response(null, { status: 204 });
      }
      if (method === 'DELETE') {
        const found = this.registry().images.find((i) => i.id === id);
        const busy = found?.machines.filter((m) => m.state === 'used now') ?? [];
        if (busy.length > 0)
          return json(
            {
              error: {
                code: 'needs_confirmation',
                message: 'A runner uses this image.',
                details: busy.map((m) => ({
                  text: `${m.job ?? 'a job'} on ${m.runner ?? 'a runner'} (${m.machine})`,
                })),
              },
            },
            409,
          );
        this.deleted.add(id);
        return new Response(null, { status: 204 });
      }
    }
    if (method === 'POST' && path === '/api/v1/registry/budgets') {
      const n = (k: string) => (query.has(k) ? Number(query.get(k)) : undefined);
      this.budgets = {
        ...this.budgets,
        ...Object.fromEntries(
          (['standard', 'custom', 'unused', 'keep'] as const)
            .map((k) => [k, n(k)] as const)
            .filter(([, v]) => v !== undefined),
        ),
      };
      return new Response(null, { status: 204 });
    }
    return undefined;
  }

  fetch = (input: Request | string, init?: RequestInit): Promise<Response> =>
    Promise.resolve(this.answer(input, init));

  private post(path: string): Response {
    const confirm = /^\/api\/v1\/stack-scans\/(.+)\/confirm$/.exec(path);
    if (confirm?.[1]) this.confirmed.add(decodeURIComponent(confirm[1]));
    const retry = /^\/api\/v1\/image-builds\/([^/]+)\/retry$/.exec(path);
    if (retry?.[1]) this.retried.set(retry[1], this.now());
    const clear = /^\/api\/v1\/cache-tools\/([^/]+)\/wipe$/.exec(path);
    if (clear?.[1]) this.cleared.add(clear[1]);
    return new Response(null, { status: 204 });
  }

  private answer(input: Request | string, init?: RequestInit): Response {
    const req = typeof input === 'string' ? new Request(input, init) : input;
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method !== 'GET')
      return this.registryWrite(req.method, path, url.searchParams) ?? this.post(path);

    switch (path) {
      case '/api/v1/me':
        return json({
          user: OWNER,
          csrf: 'review',
          github_signin: { state: 'active', expires_at: '2026-11-19T18:30:00Z' },
        });
      case '/api/v1/me/preferences': {
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
        return json({ items: MACHINES.map(machineRec) });
      case '/api/v1/runners':
        return json({ items: RUNNERS.map(runnerRec), stale: { stale: false } });
      case '/api/v1/repositories':
        return json({ items: REPOS.map(repositoryRec), stale: { stale: false } });
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
      case '/api/v1/image-layers':
        return json({ items: LAYER_CATALOG });
      case '/api/v1/image-overview':
        return json(this.images());
      case '/api/v1/stack-scans': {
        const scans = this.scans();
        const body: StackSummary = { scans, rows: poolRows(scans) };
        return json(body);
      }
      case '/api/v1/registry':
        return json(this.registry());
      case '/api/v1/cache-tools':
        return json({
          items: this.caches.map((c) =>
            this.cleared.has(c.id)
              ? { ...c, size_bytes: 0, entries: 0, per_machine: [], state: 'ok' as const }
              : c,
          ),
        });
      default:
    }
    const regImg = /^\/api\/v1\/registry\/images\/([^/]+?)(\/compare)?$/.exec(path);
    if (regImg?.[1]) {
      if (regImg[2]) {
        const c = compareFixture(regImg[1]);
        return c ? json(c) : notFound('comparison');
      }
      const i = this.registry().images.find((x) => x.id === regImg[1]);
      return i ? json(i) : notFound('image');
    }
    const profile = /^\/api\/v1\/image-profiles\/([^/]+)$/.exec(path);
    if (profile?.[1]) {
      const p = this.data.profiles.find((x) => x.id === profile[1]);
      return p
        ? json({ profile: p, builds: this.builds().filter((b) => b.profile_id === p.id) })
        : notFound('profile');
    }
    const build = /^\/api\/v1\/image-builds\/([^/]+)$/.exec(path);
    if (build?.[1]) {
      const b = this.builds().find((x) => x.id === build[1]);
      return b ? json(b) : notFound('build');
    }
    const scan = /^\/api\/v1\/stack-scans\/(.+)$/.exec(path);
    if (scan?.[1]) {
      const s = this.scans().find(
        (x) => x.repository === decodeURIComponent(scan[1] ?? ''),
      );
      return s ? json(s) : notFound('scan');
    }
    const repo = /^\/api\/v1\/repositories\/(\d+)$/.exec(path);
    if (repo) {
      const r = REPOS.find((x) => String(x.id) === repo[1]);
      return r ? json(repositoryRec(r)) : notFound('repository');
    }
    // Every other list is empty, so the areas outside Images and caches open without an error.
    return json({ items: [], stale: { stale: false } });
  }
}
