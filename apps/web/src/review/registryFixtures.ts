// Fake data for the Registry section of the RES20 review build: nine standard and custom images, the pulls of the
// last 14 days, layers they share, and the recommendations the engine would give. Deterministic; never reachable
// from the production entry.
import type {
  FileDiff,
  Recommendation,
  RegistryImage,
  RegistryOverview,
  ReplaceCompare,
} from '../screens/images-next/registryModel';
import { FIXED_NOW } from './fixtures';

const HOUR = 3_600_000;
const DAY = 86_400_000;
const GB = 1e9;
const iso = (ms: number) => new Date(ms).toISOString();
const ago = (ms: number) => iso(FIXED_NOW - ms);
const gb = (n: number) => Math.round(n * GB);

const BASE = 'ubuntu:24.04@sha256:4c1e';

const vulns = (c: number, h: number, m: number, l: number) => ({
  critical: c,
  high: h,
  medium: m,
  low: l,
});

type Seed = Partial<RegistryImage> &
  Pick<
    RegistryImage,
    'id' | 'profile' | 'profile_id' | 'kind' | 'arch' | 'key' | 'state' | 'repositories'
  > & { size: number; unique: number };

function image(s: Seed): RegistryImage {
  const { size, unique, ...rest } = s;
  return {
    stack_hash: s.key,
    base: BASE,
    size_bytes: gb(size),
    unique_bytes: gb(unique),
    pushed_at: ago(2 * DAY),
    pushed_by: 'Build box',
    last_pulled_at: ago(3 * HOUR),
    pulls_week: 0,
    pulls_total: 0,
    saved_seconds_week: 0,
    pulls_by_day: Array.from({ length: 14 }, () => 0),
    machines: [],
    shared: [],
    sbom_packages: 1180,
    vulns: vulns(0, 2, 14, 31),
    signed: true,
    stack_files: [],
    ...rest,
  };
}

const days = (v: number[]) => v;

export const REGISTRY_IMAGES: RegistryImage[] = [
  image({
    id: 'reg_std_go_x64',
    profile: 'Go, Node and Postgres',
    profile_id: 'p_go_web',
    kind: 'standard',
    arch: 'x64',
    key: 'a1f3c9',
    state: 'in use',
    repositories: [
      'luis-mc/ci-runners-shared-pool',
      'luis-mc/luismc-app',
      'luis-mc/dev-standards',
      'luis-mc/docs-site',
    ],
    size: 3.1,
    unique: 0.9,
    pulls_week: 38,
    pulls_total: 412,
    saved_seconds_week: 38 * 16 * 60,
    pulls_by_day: days([4, 6, 5, 7, 3, 1, 2, 6, 5, 8, 4, 6, 5, 3]),
    sbom_packages: 1342,
    vulns: vulns(0, 1, 11, 27),
    machines: [
      {
        machine: 'Build box',
        state: 'used now',
        runner: 'build-1',
        job: 'job 8133 of luis-mc/ci-runners-shared-pool',
        pulled_at: ago(2 * DAY),
      },
      { machine: 'Studio PC', state: 'holds', pulled_at: ago(2 * DAY) },
    ],
    shared: [
      {
        image_id: 'reg_std_go_arm',
        name: 'Go, Node and Postgres',
        key: 'b7e204',
        shared_bytes: gb(1.6),
      },
      {
        image_id: 'reg_std_rust',
        name: 'Rust and Windows packaging',
        key: 'c05d18',
        shared_bytes: gb(1.1),
      },
    ],
    stack_files: [
      { path: 'go.mod', hash: '91ac3e' },
      { path: 'package.json', hash: '3be07f' },
      { path: 'pnpm-lock.yaml', hash: 'f20d84' },
    ],
  }),
  image({
    id: 'reg_std_go_arm',
    profile: 'Go, Node and Postgres',
    profile_id: 'p_go_web',
    kind: 'standard',
    arch: 'arm64',
    key: 'b7e204',
    state: 'in use',
    repositories: ['luis-mc/ci-runners-shared-pool', 'luis-mc/luismc-app'],
    size: 3.4,
    unique: 1.1,
    pulls_week: 9,
    pulls_total: 61,
    saved_seconds_week: 9 * 34 * 60,
    pulls_by_day: days([1, 0, 2, 1, 0, 0, 1, 1, 0, 2, 0, 1, 0, 0]),
    machines: [
      {
        machine: 'Pi lab',
        state: 'used now',
        runner: 'pi-1',
        job: 'job 8139 of luis-mc/luismc-app',
        pulled_at: ago(5 * DAY),
      },
    ],
    shared: [
      {
        image_id: 'reg_std_go_x64',
        name: 'Go, Node and Postgres',
        key: 'a1f3c9',
        shared_bytes: gb(1.6),
      },
    ],
  }),
  image({
    id: 'reg_std_rust',
    profile: 'Rust and Windows packaging',
    profile_id: 'p_rust',
    kind: 'standard',
    arch: 'x64',
    key: 'c05d18',
    state: 'in use',
    repositories: ['luis-mc/ci-runners-shared-pool', 'luis-mc/luismc-app'],
    size: 4.6,
    unique: 2.2,
    pulls_week: 14,
    pulls_total: 133,
    saved_seconds_week: 14 * 17 * 60,
    pulls_by_day: days([2, 1, 1, 3, 0, 0, 2, 1, 2, 1, 0, 3, 1, 1]),
    vulns: vulns(1, 4, 19, 40),
    machines: [
      { machine: 'Build box', state: 'holds', pulled_at: ago(6 * DAY) },
      { machine: 'Studio PC', state: 'holds', pulled_at: ago(6 * DAY) },
    ],
    shared: [
      {
        image_id: 'reg_std_go_x64',
        name: 'Go, Node and Postgres',
        key: 'a1f3c9',
        shared_bytes: gb(1.1),
      },
    ],
  }),
  image({
    id: 'reg_std_py',
    profile: 'Python and uv',
    profile_id: 'p_py',
    kind: 'standard',
    arch: 'x64',
    key: 'd93a6b',
    state: 'current',
    repositories: ['luis-mc/ml-notebooks'],
    size: 2.2,
    unique: 0.6,
    pulls_week: 6,
    pulls_total: 47,
    saved_seconds_week: 6 * 12 * 60,
    pulls_by_day: days([0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0]),
    last_pulled_at: ago(9 * HOUR),
    machines: [{ machine: 'Build box', state: 'holds', pulled_at: ago(4 * DAY) }],
  }),
  image({
    id: 'reg_std_pool',
    profile: 'Pool tools',
    profile_id: 'p_pool',
    kind: 'standard',
    arch: 'x64',
    key: 'e4410a',
    state: 'in use',
    repositories: ['luis-mc/dev-standards'],
    size: 1.6,
    unique: 0.4,
    pulls_week: 3,
    pulls_total: 30,
    saved_seconds_week: 3 * 9 * 60,
    pulls_by_day: days([0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]),
    machines: [
      {
        machine: 'Studio PC',
        state: 'used now',
        runner: 'studio-1',
        job: 'job 8140 of luis-mc/dev-standards',
        pulled_at: ago(7 * DAY),
      },
    ],
  }),
  image({
    id: 'reg_c_docs_v3',
    profile: 'Node web apps',
    profile_id: 'p_node',
    kind: 'custom',
    arch: 'x64',
    key: '7d21e0',
    stack_hash: 'c41e9b',
    state: 'in use',
    repositories: ['luis-mc/docs-site'],
    size: 2.6,
    unique: 0.8,
    pushed_at: ago(12 * DAY),
    pulls_week: 21,
    pulls_total: 96,
    saved_seconds_week: 21 * 11 * 60,
    pulls_by_day: days([3, 4, 2, 3, 0, 0, 3, 2, 4, 3, 1, 2, 3, 2]),
    replaces: 'reg_c_docs_v2',
    replaced_by: 'reg_c_docs_v4',
    machines: [
      {
        machine: 'Build box',
        state: 'used now',
        runner: 'build-2',
        job: 'job 8141 of luis-mc/docs-site',
        pulled_at: ago(12 * DAY),
      },
      { machine: 'Pi lab', state: 'holds', pulled_at: ago(10 * DAY) },
    ],
    shared: [
      {
        image_id: 'reg_c_docs_v4',
        name: 'Node web apps',
        key: '8a63f2',
        shared_bytes: gb(1.8),
      },
      {
        image_id: 'reg_c_docs_v2',
        name: 'Node web apps',
        key: '51b7c4',
        shared_bytes: gb(1.8),
      },
    ],
    stack_files: [
      { path: 'package.json', hash: '5be0a1' },
      { path: 'pnpm-lock.yaml', hash: 'c41e9b' },
      { path: '.nvmrc', hash: '08d3f6' },
    ],
  }),
  image({
    id: 'reg_c_docs_v4',
    profile: 'Node web apps',
    profile_id: 'p_node',
    kind: 'custom',
    arch: 'x64',
    key: '8a63f2',
    stack_hash: '82aa07',
    state: 'update found',
    repositories: ['luis-mc/docs-site'],
    size: 2.7,
    unique: 0.9,
    pushed_at: ago(3 * HOUR),
    last_pulled_at: ago(2 * HOUR),
    pulls_week: 1,
    pulls_total: 1,
    saved_seconds_week: 0,
    pulls_by_day: days([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
    replaces: 'reg_c_docs_v3',
    vulns: vulns(0, 1, 9, 28),
    machines: [{ machine: 'Build box', state: 'holds', pulled_at: ago(2 * HOUR) }],
    shared: [
      {
        image_id: 'reg_c_docs_v3',
        name: 'Node web apps',
        key: '7d21e0',
        shared_bytes: gb(1.8),
      },
    ],
    stack_files: [
      { path: 'package.json', hash: '77c2d9' },
      { path: 'pnpm-lock.yaml', hash: '82aa07' },
      { path: '.nvmrc', hash: '08d3f6' },
    ],
  }),
  image({
    id: 'reg_c_docs_v2',
    profile: 'Node web apps',
    profile_id: 'p_node',
    kind: 'custom',
    arch: 'x64',
    key: '51b7c4',
    stack_hash: '1f9d30',
    state: 'superseded',
    repositories: ['luis-mc/docs-site'],
    size: 2.5,
    unique: 0.7,
    pushed_at: ago(33 * DAY),
    last_pulled_at: ago(12 * DAY),
    pulls_week: 0,
    pulls_total: 118,
    saved_seconds_week: 0,
    pulls_by_day: days([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    replaced_by: 'reg_c_docs_v3',
    keep_until: iso(FIXED_NOW + 2 * DAY),
    machines: [],
    shared: [
      {
        image_id: 'reg_c_docs_v3',
        name: 'Node web apps',
        key: '7d21e0',
        shared_bytes: gb(1.8),
      },
    ],
    vulns: vulns(1, 5, 18, 36),
  }),
  image({
    id: 'reg_c_ml_main',
    profile: 'Python and uv',
    profile_id: 'p_py',
    kind: 'custom',
    arch: 'x64',
    key: '2c5e91',
    stack_hash: 'a09b44',
    state: 'in use',
    repositories: ['luis-mc/ml-notebooks'],
    size: 3.6,
    unique: 1.5,
    pulls_week: 12,
    pulls_total: 74,
    saved_seconds_week: 12 * 14 * 60,
    pulls_by_day: days([1, 2, 1, 0, 0, 0, 2, 1, 2, 1, 1, 0, 1, 0]),
    machines: [{ machine: 'Build box', state: 'holds', pulled_at: ago(5 * DAY) }],
    shared: [
      {
        image_id: 'reg_c_ml_wasm',
        name: 'Python and uv',
        key: '6e08d2',
        shared_bytes: gb(1.7),
      },
    ],
    stack_files: [
      { path: 'pyproject.toml', hash: '4a7e12' },
      { path: 'uv.lock', hash: 'a09b44' },
    ],
  }),
  image({
    id: 'reg_c_ml_wasm',
    profile: 'Python and uv',
    profile_id: 'p_py',
    kind: 'custom',
    arch: 'x64',
    key: '6e08d2',
    stack_hash: 'd7731c',
    state: 'variant',
    branch: 'rust-wasm',
    repositories: ['luis-mc/ml-notebooks'],
    size: 3.8,
    unique: 1.9,
    pushed_at: ago(9 * DAY),
    last_pulled_at: ago(3 * DAY),
    pulls_week: 2,
    pulls_total: 11,
    saved_seconds_week: 2 * 14 * 60,
    pulls_by_day: days([0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
    machines: [{ machine: 'Build box', state: 'holds', pulled_at: ago(9 * DAY) }],
    shared: [
      {
        image_id: 'reg_c_ml_main',
        name: 'Python and uv',
        key: '2c5e91',
        shared_bytes: gb(1.7),
      },
    ],
    stack_files: [
      { path: 'pyproject.toml', hash: 'b5f208' },
      { path: 'uv.lock', hash: 'd7731c' },
    ],
  }),
  image({
    id: 'reg_c_mobile_old',
    profile: 'Rust and Windows packaging',
    profile_id: 'p_rust',
    kind: 'custom',
    arch: 'x64',
    key: '9f4b27',
    stack_hash: '30c8e5',
    state: 'unused',
    unused_days: 41,
    repositories: ['luis-mc/mobile-client'],
    size: 4.4,
    unique: 3.9,
    pushed_at: ago(70 * DAY),
    last_pulled_at: ago(41 * DAY),
    pulls_week: 0,
    pulls_total: 23,
    saved_seconds_week: 0,
    pulls_by_day: days([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    vulns: vulns(2, 7, 21, 44),
    signed: true,
    machines: [{ machine: 'Build box', state: 'holds', pulled_at: ago(70 * DAY) }],
    shared: [
      {
        image_id: 'reg_std_rust',
        name: 'Rust and Windows packaging',
        key: 'c05d18',
        shared_bytes: gb(0.5),
      },
    ],
    stack_files: [
      { path: 'Cargo.lock', hash: '0be194' },
      { path: 'rust-toolchain.toml', hash: '66d1a0' },
    ],
  }),
];

const SHARED = { standard: gb(11.5), custom: gb(6.2) };

export const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'rec_replace_docs',
    kind: 'replace',
    title: 'Node web apps for docs-site has a newer version',
    why: 'A run of luis-mc/docs-site at 4be1f09 needs Playwright 1.65.1. The image it uses has 1.64.0.',
    saves_bytes: gb(0.8),
    decides: 'you',
    to: '/pool/images/registry/reg_c_docs_v4/replace',
  },
  {
    id: 'rec_unused_mobile',
    kind: 'unused',
    title: 'Rust and Windows packaging for mobile-client: not pulled for 41 days',
    why: 'No run of luis-mc/mobile-client has asked for it since 9 Oct. It can be built again when needed.',
    saves_bytes: gb(3.9),
    decides: 'you',
    to: '/pool/images/registry/reg_c_mobile_old',
  },
  {
    id: 'rec_budget_custom',
    kind: 'over budget',
    title: 'Custom images use 15.9 GB of 15 GB',
    why: 'Deleting the unused image above frees enough. Or raise the budget.',
    saves_bytes: gb(0.9),
    decides: 'you',
    to: '/pool/images/registry/budgets',
  },
  {
    id: 'rec_variant_wasm',
    kind: 'variant',
    title: 'Python and uv, variant of rust-wasm: the branch was merged 6 days ago',
    why: 'Its stack files now match main. crsp deletes a variant 7 days after its branch is merged.',
    saves_bytes: gb(1.9),
    decides: 'crsp',
    when: 'on Sat 21 Nov',
    to: '/pool/images/registry/reg_c_ml_wasm',
  },
  {
    id: 'rec_dangling',
    kind: 'dangling layers',
    title: '1.3 GB of layers that no image uses',
    why: 'Left behind by deleted images. The weekly cleanup removes them.',
    saves_bytes: gb(1.3),
    decides: 'crsp',
    when: 'on Sun 22 Nov, 03:00',
    to: '/pool/images/registry/budgets',
  },
];

export function registryFixtures(): RegistryOverview {
  const used = (kind: 'standard' | 'custom') =>
    REGISTRY_IMAGES.filter((i) => i.kind === kind).reduce(
      (n, i) => n + i.unique_bytes,
      0,
    ) + SHARED[kind];
  const pulls = REGISTRY_IMAGES.reduce((n, i) => n + i.pulls_week, 0);
  const saved = REGISTRY_IMAGES.reduce((n, i) => n + i.saved_seconds_week, 0);
  return {
    where: 'Studio PC',
    path: 'C:\\ProgramData\\crsp\\registry',
    free_bytes: gb(212),
    last_cleanup_at: ago(4 * DAY),
    next_cleanup_at: iso(FIXED_NOW + 3 * DAY + 17 * HOUR + 20 * 60_000),
    standard: {
      used_bytes: used('standard'),
      budget_bytes: gb(30),
      shared_bytes: SHARED.standard,
    },
    custom: {
      used_bytes: used('custom'),
      budget_bytes: gb(15),
      shared_bytes: SHARED.custom,
    },
    unused_days: 30,
    keep_old_days: 7,
    images: REGISTRY_IMAGES,
    recommendations: RECOMMENDATIONS,
    pulls_week: pulls,
    pulls_prev_week: pulls - 17,
    saved_seconds_week: saved,
    builds_avoided_week: pulls - 9,
    dangling_bytes: gb(1.3),
  };
}

const DIFFS: FileDiff[] = [
  {
    path: 'package.json',
    before: '@playwright/test 1.64.0',
    after: '@playwright/test 1.65.1',
  },
  { path: 'pnpm-lock.yaml', before: 'hash c41e9b', after: 'hash 82aa07' },
];

export function compareFixture(newId: string): ReplaceCompare | undefined {
  const next = REGISTRY_IMAGES.find((i) => i.id === newId);
  const old = REGISTRY_IMAGES.find((i) => i.id === next?.replaces);
  if (!next || !old) return undefined;
  return {
    old,
    next,
    files: DIFFS,
    switching: next.repositories,
    freed_bytes: old.unique_bytes,
  };
}
