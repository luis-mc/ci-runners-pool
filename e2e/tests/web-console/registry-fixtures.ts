// The registry API of the console fixtures (REG5): one overview, three images (one with a newer one found, one
// unused, one a runner uses), one replace plan, budgets, settings, mirror and pulls. Ids start with img_.
import type { Mock } from './fixtures';

const GB = 1e9;
const day = (n: number) =>
  new Date(Date.UTC(2026, 10, 19 - n)).toISOString().slice(0, 10);

const summary = (over: Record<string, unknown> = {}) => ({
  id: 'img_goold',
  kind: 'standard',
  name: 'crsp/std/go-node-postgres',
  key: 'b7e204a1c9d3',
  profile: 'Go, Node and Postgres',
  arch: 'arm64',
  state: 'current',
  manifest_digest: 'sha256:' + 'a1'.repeat(32),
  size_bytes: 3.4 * GB,
  unique_bytes: 1.1 * GB,
  pulls_7_days: 12,
  last_pull_at: '2026-11-18T09:00:00Z',
  scan_state: 'done',
  pushed_at: '2026-11-10T09:00:00Z',
  ...over,
});

export const IMAGES = [
  summary(),
  summary({
    id: 'img_docsv4',
    kind: 'custom',
    name: 'crsp/custom/octo-docs/node-web',
    key: 'c57a886d9402',
    profile: 'Node web',
    arch: 'amd64',
    source_repository: 'octo/docs',
    update_found: true,
    pulls_7_days: 3,
    size_bytes: 2.1 * GB,
  }),
  summary({
    id: 'img_mobile',
    kind: 'custom',
    name: 'crsp/custom/octo-mobile/rust-win',
    key: 'b82203cda3a4',
    profile: 'Rust and Windows packaging',
    arch: 'amd64',
    source_repository: 'octo/mobile',
    pulls_7_days: 0,
    last_pull_at: '2026-09-01T09:00:00Z',
    unique_bytes: 3.9 * GB,
    size_bytes: 4.2 * GB,
  }),
];

export const overview = () => ({
  where: {
    host: 'pool-ctl:5443',
    folder: '/var/lib/crsp/registry',
    read_only: false,
    running: true,
  },
  budgets: [
    {
      kind: 'standard',
      limit_bytes: 20 * GB,
      used_bytes: 8.1 * GB,
      shared_bytes: 2 * GB,
      over: false,
    },
    {
      kind: 'custom',
      limit_bytes: 15 * GB,
      used_bytes: 16.3 * GB,
      shared_bytes: 1 * GB,
      over: true,
    },
  ],
  last_7_days: {
    pulls: 15,
    builds_avoided: 11,
    saved_seconds: 11 * 1800,
    bytes_pulled: 30 * GB,
  },
  recommendations: [
    {
      id: 'rec_1',
      rule: 'replace',
      image_id: 'img_docsv4',
      other_image_id: 'img_goold',
      kind: 'custom',
      frees_bytes: 1.8 * GB,
      decider: 'owner',
      created_at: '2026-11-18T09:00:00Z',
    },
    {
      id: 'rec_2',
      rule: 'unused',
      image_id: 'img_mobile',
      kind: 'custom',
      frees_bytes: 3.9 * GB,
      decider: 'owner',
      created_at: '2026-11-18T09:00:00Z',
    },
    {
      id: 'rec_3',
      rule: 'dangling',
      kind: 'standard',
      frees_bytes: 0.6 * GB,
      decider: 'crsp',
      due_at: '2026-11-22T03:00:00Z',
      created_at: '2026-11-18T09:00:00Z',
    },
  ],
  images: { standard: 1, custom: 2 },
  in_flight: { builds: 0, pulls: 0, pushes: 0 },
  next_cleanup_at: '2026-11-22T03:00:00Z',
});

const detail = (s: Record<string, unknown>, inUse: boolean) => ({
  ...s,
  stack_hash: '3ce86298410301e478baa185c81f75e9d8e02dcf22633e16d02d5ee627d67eb0',
  base_name: 'ubuntu:24.04',
  pushed_by: 'm1',
  lineage: [
    {
      image_id: 'img_goold',
      key: 'b7e204a1c9d3',
      state: 'current',
      pushed_at: '2026-11-10T09:00:00Z',
    },
  ],
  layers: [
    { digest: 'sha256:' + 'ab'.repeat(32), size_bytes: 1.2 * GB, shared_with: 2 },
    { digest: 'sha256:' + 'cd'.repeat(32), size_bytes: 0.4 * GB, shared_with: 0 },
  ],
  pulls_by_day: Array.from({ length: 14 }, (_, n) => ({
    day: day(13 - n),
    pulls: n % 4,
  })),
  pulls_text: '19 pulls in 14 days, most on 17 Nov (3).',
  saved_seconds: 9000,
  machines: [
    {
      machine_id: 'm1',
      machine_name: 'build-1',
      holds: true,
      in_use_by_runner: inUse,
      last_used_at: '2026-11-18T09:00:00Z',
    },
  ],
  pointers: [
    {
      repository: 'octo/docs',
      profile: 'Node web',
      arch: 'amd64',
      image_id: s.id,
      moved_at: '2026-11-10T09:00:00Z',
      moved_by: 'crsp',
    },
  ],
  scan: { state: 'done', packages: 812, critical: 0, high: 2, medium: 5, low: 9 },
});

const plan = (state: string, over: Record<string, unknown> = {}) => ({
  id: 'plan_1',
  state,
  new_image: IMAGES[1],
  old_image: IMAGES[0],
  keep_days: 7,
  keep_until: '2026-11-26T09:00:00Z',
  repositories: ['octo/docs'],
  machines: ['build-1'],
  frees_bytes: 1.8 * GB,
  steps_done: state === 'done' ? 3 : 0,
  steps_total: 3,
  can_rollback: state === 'done',
  created_at: '2026-11-19T09:00:00Z',
  ...over,
});

/** Answers the registry routes (GET and the writes the screens make). A `state` option makes the plan end there. */
export function registryApi(mock: Mock, opts: { planAfterStart?: string } = {}): Mock {
  let started = false;
  return mock
    .on('GET', '/api/v1/registry/overview', overview())
    .on('GET', '/api/v1/registry/images', { items: IMAGES })
    .on('GET', '/api/v1/registry/images/:id', (_c, p) => {
      const s = IMAGES.find((i) => i.id === p.id) ?? IMAGES[0]!;
      return detail(s, p.id === 'img_goold');
    })
    .on('DELETE', '/api/v1/registry/images/:id', (c, p) => {
      if (p.id === 'img_goold')
        return {
          status: 409,
          error: {
            code: 'conflict',
            message: 'A runner uses this image.',
            details: [{ kind: 'job', id: '8133', text: 'job 8133 of octo/app uses it' }],
          },
        };
      if (c.query.get('confirm') !== 'true')
        return {
          status: 409,
          error: {
            code: 'needs_confirmation',
            message: 'Name what goes.',
            details: [{ kind: 'image', id: p.id, text: '3.9 GB freed' }],
          },
        };
      return { ...IMAGES[2] };
    })
    .on('GET', '/api/v1/registry/images/:id/compare', {
      new: IMAGES[1],
      old: IMAGES[0],
      stack_files: [
        {
          path: 'pnpm-lock.yaml',
          change: 'changed',
          before_sha256: 'a1b2c3'.padEnd(64, '0'),
          after_sha256: 'd4e5f6'.padEnd(64, '0'),
        },
      ],
      base_changed: false,
      shared_bytes: 1 * GB,
      frees_bytes: 1.8 * GB,
      repositories: ['octo/docs'],
      keep_days_default: 7,
    })
    .on('GET', '/api/v1/registry/budgets', {
      standard: overview().budgets[0],
      custom: overview().budgets[1],
      free_disk_bytes: 80 * GB,
      max_total_bytes: 50 * GB,
    })
    .on('PUT', '/api/v1/registry/budgets', (c) => ({
      ...(c.body as object),
      standard: overview().budgets[0],
      custom: overview().budgets[1],
      free_disk_bytes: 80 * GB,
      max_total_bytes: 50 * GB,
    }))
    .on('GET', '/api/v1/registry/settings', {
      folder: '/var/lib/crsp/registry',
      unused_days: 60,
      keep_old_days: 7,
      variant_gone_days: 7,
      variant_unused_days: 30,
      cleanup_weekday: 0,
      cleanup_hour: 3,
      alone_rules: ['superseded', 'variant', 'dangling'],
    })
    .on('PUT', '/api/v1/registry/settings', (c) => c.body)
    .on('POST', '/api/v1/registry/replace-plans', plan('draft'))
    .on('GET', '/api/v1/registry/replace-plans/:id', () =>
      plan(started ? (opts.planAfterStart ?? 'done') : 'draft'),
    )
    .on('POST', '/api/v1/registry/replace-plans/:id/start', () => {
      started = true;
      return plan('running');
    })
    .on('POST', '/api/v1/registry/replace-plans/:id/stop', plan('stopped'))
    .on('POST', '/api/v1/registry/replace-plans/:id/rollback', plan('rolled_back'))
    .on('GET', '/api/v1/registry/mirror', {
      enabled: true,
      upstreams: ['docker.io', 'ghcr.io'],
      folder: '/var/lib/crsp/mirror',
      budget_bytes: 10 * GB,
      tag_recheck_minutes: 60,
      used_bytes: 2.5 * GB,
    })
    .on('PUT', '/api/v1/registry/mirror', (c) => c.body)
    .on('GET', '/api/v1/registry/pulls', { items: [] });
}
