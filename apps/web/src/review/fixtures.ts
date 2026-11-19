// Fake data for the RES19 review build (Images and caches): deterministic, realistic, never reachable from the
// production entry. Three machines, six repositories, five profiles, a dozen builds (one running, one failed, one
// stale, one queued), ten caches and the scan of every repository.
import type {
  Arch,
  Finding,
  ImageBuild,
  ImagesOverview,
  LayerRef,
  PoolStackRow,
  Profile,
  RepoScan,
  ServiceSpec,
  Toolchain,
  ToolCache,
  DiskUse,
  BuildStep,
} from '../screens/images-next/model';

/** The fixed "now" of the review build and of its screenshots. */
export const FIXED_NOW = Date.parse('2026-11-19T09:40:00Z');
const MIN = 60_000;
const DAY = 86_400_000;
const GB = 1024 ** 3;
const iso = (ms: number) => new Date(ms).toISOString();

export const MACHINES = [
  {
    id: 'm_studio',
    name: 'Studio PC',
    os: 'windows',
    arch: 'x64' as Arch,
    backends: ['persistent', 'docker'],
    slots: 3,
  },
  {
    id: 'm_build',
    name: 'Build box',
    os: 'linux',
    arch: 'x64' as Arch,
    backends: ['docker', 'kvm', 'persistent'],
    slots: 4,
  },
  {
    id: 'm_pi',
    name: 'Pi lab',
    os: 'linux',
    arch: 'arm64' as Arch,
    backends: ['docker', 'persistent'],
    slots: 2,
  },
] as const;

export const REPOS = [
  { id: 101, full_name: 'luis-mc/ci-runners-shared-pool' },
  { id: 102, full_name: 'luis-mc/dev-standards' },
  { id: 103, full_name: 'luis-mc/luismc-app' },
  { id: 104, full_name: 'luis-mc/docs-site' },
  { id: 105, full_name: 'luis-mc/ml-notebooks' },
  { id: 106, full_name: 'luis-mc/mobile-client' },
] as const;

export const RUNNERS = [
  {
    id: 'r1',
    name: 'studio-1',
    machine_id: 'm_studio',
    machine_name: 'Studio PC',
    os: 'windows',
    kind: 'persistent',
    backend: 'persistent',
    isolation: 'persistent',
  },
  {
    id: 'r2',
    name: 'build-1',
    machine_id: 'm_build',
    machine_name: 'Build box',
    os: 'linux',
    kind: 'ephemeral',
    backend: 'docker',
    isolation: 'container',
  },
  {
    id: 'r3',
    name: 'build-2',
    machine_id: 'm_build',
    machine_name: 'Build box',
    os: 'linux',
    kind: 'ephemeral',
    backend: 'docker',
    isolation: 'container',
  },
  {
    id: 'r4',
    name: 'pi-1',
    machine_id: 'm_pi',
    machine_name: 'Pi lab',
    os: 'linux',
    kind: 'ephemeral',
    backend: 'docker',
    isolation: 'container',
  },
] as const;

// ---------------------------------------------------------------- layers, toolchains, services

const L = {
  base: {
    id: 'base',
    name: 'Base tools',
    adds: 'git, curl, build-essential, Node 26 LTS, corepack, gh, jq',
    size_mb: 1480,
    state: 'on',
  } as LayerRef,
  browsers: {
    id: 'browsers',
    name: 'Browsers',
    adds: 'Chromium, Firefox and WebKit for Playwright 1.65.1',
    size_mb: 1320,
    state: 'on',
  } as LayerRef,
  llvm: {
    id: 'llvm',
    name: 'LLVM',
    adds: 'LLVM 20.1.8 with clang-cl and lld-link',
    size_mb: 940,
    state: 'on',
  } as LayerRef,
  winpkg: {
    id: 'windows-packaging',
    name: 'Windows packaging',
    adds: 'Wine 9.0, WiX tools, osslsigncode',
    size_mb: 710,
    state: 'on',
  } as LayerRef,
  kvm: {
    id: 'kvm',
    name: 'KVM tools',
    adds: 'qemu, cloud-image tools, the VM loader',
    size_mb: 380,
    state: 'on',
  } as LayerRef,
  linpkg: {
    id: 'linux-packaging',
    name: 'Linux packaging',
    adds: 'dpkg-dev, rpm, fakeroot, appimagetool',
    size_mb: 260,
    state: 'on',
  } as LayerRef,
  python: {
    id: 'python',
    name: 'Python and uv',
    adds: 'Python 3.12, uv 0.5, build headers',
    size_mb: 420,
    state: 'suggested',
  } as LayerRef,
  java: {
    id: 'java',
    name: 'Java and Gradle',
    adds: 'Temurin 21, Gradle 8.10, Android command-line tools',
    size_mb: 1650,
    state: 'suggested',
  } as LayerRef,
  extra: {
    id: 'extra-packages',
    name: 'Extra packages',
    adds: 'libpq-dev, libssl-dev, pkg-config',
    size_mb: 90,
    state: 'on',
  } as LayerRef,
};

const T = (
  tool: string,
  version: string,
  found_in: string,
  layer: string,
): Toolchain => ({ tool, version, found_in, layer });
const S = (
  name: string,
  image: string,
  role: string,
  lifetime: ServiceSpec['lifetime'],
): ServiceSpec => ({ name, image, role, lifetime });

export const PROFILES: Profile[] = [
  {
    id: 'p_go_web',
    name: 'Go, Node and Postgres',
    kind: 'automatic',
    purpose:
      'The pool itself: Go services, a React console, Playwright tests and a Postgres for the store tests.',
    base: 'Ubuntu 24.04',
    arches: ['x64', 'arm64'],
    layers: [L.base, L.browsers, L.extra],
    toolchains: [
      T('Go', '1.26.3', 'go.mod', 'Tool cache'),
      T('Node', '26.13.1', 'package.json engines', 'Base tools'),
      T('pnpm', '10.34.5', 'package.json packageManager', 'Base tools'),
      T('Playwright', '1.65.1', 'pnpm-lock.yaml', 'Browsers'),
    ],
    services: [S('db', 'postgres:16', 'The store tests connect to it.', 'per job')],
    labels: ['self-hosted', 'linux', 'docker'],
    repositories: ['luis-mc/ci-runners-shared-pool'],
    key: 'a41c9e02d7b3',
  },
  {
    id: 'p_node',
    name: 'Node web apps',
    kind: 'automatic',
    purpose: 'Static sites and small web apps built with npm and tested with Playwright.',
    base: 'Ubuntu 24.04',
    arches: ['x64', 'arm64'],
    layers: [L.base, L.browsers],
    toolchains: [
      T('Node', '22.23.4', '.nvmrc', 'Tool cache'),
      T('npm', '10.9', 'package-lock.json', 'Base tools'),
      T('Playwright', '1.65.1', 'package-lock.json', 'Browsers'),
    ],
    services: [],
    labels: ['self-hosted', 'linux'],
    repositories: ['luis-mc/docs-site'],
    key: '7be02f19c5a8',
    stale_because: 'The Playwright pin moved from 1.64.0 to 1.65.1.',
  },
  {
    id: 'p_rust',
    name: 'Rust and Windows packaging',
    kind: 'custom',
    purpose:
      'The desktop app: Rust, cross-builds for Windows, installers and a VM smoke test.',
    base: 'Ubuntu 24.04',
    arches: ['x64'],
    layers: [L.base, L.llvm, L.winpkg, L.kvm, L.linpkg],
    toolchains: [
      T('Rust', '1.90.0', 'rust-toolchain.toml', 'Tool cache'),
      T('cargo-xwin', '0.18.4', 'Cargo.toml', 'Tool cache'),
      T('LLVM', '20.1.8', 'workflow: windows.yml', 'LLVM'),
      T('Wine', '9.0', 'workflow: windows.yml', 'Windows packaging'),
      T('Node', '24.12.0', '.tool-versions', 'Tool cache'),
    ],
    services: [],
    labels: ['self-hosted', 'linux', 'kvm'],
    repositories: ['luis-mc/luismc-app'],
    key: 'c3d58a7710ef',
  },
  {
    id: 'p_pool',
    name: 'Pool tools',
    kind: 'custom',
    purpose:
      'A runner with its helpers: a VM loader and a database that stay up together, like the dev-standards pool.',
    base: 'Ubuntu 24.04',
    arches: ['x64'],
    layers: [L.base, L.kvm],
    toolchains: [
      T('Python', '3.12.7', '.python-version', 'Base tools'),
      T('Bash', '5.2', 'scripts/delivery', 'Base tools'),
    ],
    services: [
      S(
        'kvm-loader-1',
        'alpine:3.22',
        'Loads the VM images before a job.',
        'with the runner',
      ),
      S('db-1', 'postgres:16', 'The delivery tests use it.', 'with the runner'),
    ],
    labels: ['self-hosted', 'linux', 'kvm'],
    repositories: ['luis-mc/dev-standards'],
    key: '09fa6b3e41d2',
  },
  {
    id: 'p_py',
    name: 'Python and uv',
    kind: 'automatic',
    purpose:
      'Notebooks and data jobs with uv, pinned by a lock file, and a Redis for the queue tests.',
    base: 'Ubuntu 24.04',
    arches: ['x64', 'arm64'],
    layers: [L.base, { ...L.python, state: 'on' }],
    toolchains: [
      T('Python', '3.12.7', '.python-version', 'Python and uv'),
      T('uv', '0.5.11', 'uv.lock', 'Python and uv'),
    ],
    services: [S('redis', 'redis:7', 'The queue tests connect to it.', 'per job')],
    labels: ['self-hosted', 'linux'],
    repositories: ['luis-mc/ml-notebooks'],
    key: 'e6120b9d55c7',
  },
];

// ---------------------------------------------------------------- builds

const STEP_NAMES = (p: Profile): { name: string; seconds: number }[] => {
  const out = [{ name: 'Pull Ubuntu 24.04', seconds: 40 }];
  for (const l of p.layers) {
    out.push({
      name: `${l.name} layer`,
      seconds: Math.max(45, Math.round(l.size_mb / 2.2)),
    });
  }
  if (p.toolchains.some((t) => t.layer === 'Tool cache'))
    out.push({ name: 'Fill the tool cache', seconds: 90 });
  out.push({ name: 'Self-check', seconds: 30 });
  return out;
};

const LOG_LINES: Record<string, string[]> = {
  'Pull Ubuntu 24.04': [
    '#1 FROM ubuntu:24.04@sha256:2198e4c6…',
    '#1 resolve ubuntu:24.04 done',
    '#1 sha256:6b7a… 29.7MB / 29.7MB done',
    '#1 DONE 38.4s',
  ],
  'Base tools layer': [
    '#2 apt-get install build-essential ca-certificates curl git jq',
    '#2 Setting up git (1:2.43.0-1ubuntu7.3) …',
    '#3 node-v26.13.1-linux-x64.tar.xz sha256 ok',
    '#3 corepack enable',
    '#4 gh_2.103.3_linux_amd64.tar.gz sha256 ok',
    '#4 DONE',
  ],
  'Browsers layer': [
    '#5 playwright install --with-deps chromium firefox webkit',
    '#5 Downloading Chromium 141.0.7390.37',
    '#5 Downloading Firefox 142.0.1',
    '#5 Downloading WebKit 26.0',
  ],
  'LLVM layer': [
    '#6 curl LLVM-20.1.8-Linux-X64.tar.xz',
    '#6 sha256sum -c: FAILED',
    '#6 expected 9a10c3…',
    '#6 got        e1bb02…',
    '#6 ERROR: the download does not match its pin',
  ],
};

function step(
  name: string,
  state: BuildStep['state'],
  seconds?: number,
  note?: string,
): BuildStep {
  return {
    name,
    state,
    ...(seconds !== undefined ? { seconds } : {}),
    ...(note ? { note } : {}),
  };
}

function logOf(p: Profile, upTo: number): string[] {
  const out: string[] = [];
  STEP_NAMES(p).forEach((s, i) => {
    if (i >= upTo) return;
    out.push(`==> ${s.name}`);
    out.push(...(LOG_LINES[s.name] ?? [`#${i + 2} ${s.name.toLowerCase()} … done`]));
  });
  return out;
}

function doneSteps(p: Profile): BuildStep[] {
  return STEP_NAMES(p).map((s) => step(s.name, 'done', Math.round(s.seconds * 0.97)));
}

const prof = (id: string) => PROFILES.find((p) => p.id === id) as Profile;
const mach = (id: string) =>
  MACHINES.find((m) => m.id === id) as (typeof MACHINES)[number];

function build(
  n: number,
  profile: string,
  machine: string,
  over: Partial<ImageBuild> & Pick<ImageBuild, 'state' | 'reason'>,
): ImageBuild {
  const p = prof(profile);
  const m = mach(machine);
  const typical =
    STEP_NAMES(p).reduce((a, s) => a + s.seconds, 0) * (m.arch === 'arm64' ? 2.1 : 1);
  return {
    id: `bld_${n}`,
    profile_id: p.id,
    profile: p.name,
    machine_id: m.id,
    machine: m.name,
    arch: m.arch,
    key: p.key,
    origin: 'built here',
    typical_seconds: Math.round(typical),
    steps: [],
    log: [],
    ...over,
  };
}

/** The running build starts this long before the fixed now; the mock reads the clock to place its steps. */
export const RUNNING_STARTED = FIXED_NOW - 6 * MIN - 20_000;

export function buildFixtures(): ImagesOverview & { scans: RepoScan[] } {
  const goWeb = prof('p_go_web');
  const rust = prof('p_rust');
  const builds: ImageBuild[] = [
    build(1, 'p_go_web', 'm_build', {
      state: 'ready',
      reason: 'first runner',
      started_at: iso(FIXED_NOW - 2 * DAY - 25 * MIN),
      finished_at: iso(FIXED_NOW - 2 * DAY - 6 * MIN),
      size_mb: 3180,
      steps: doneSteps(goWeb),
      log: logOf(goWeb, 99),
    }),
    build(2, 'p_go_web', 'm_studio', {
      state: 'ready',
      reason: 'first runner',
      origin: 'pulled',
      started_at: iso(FIXED_NOW - 2 * DAY + 3 * MIN),
      finished_at: iso(FIXED_NOW - 2 * DAY + 7 * MIN),
      size_mb: 3180,
      steps: [
        step(
          'Pull from the registry',
          'done',
          236,
          'ghcr.io/luis-mc/crsp-pool, 3.1 GB, 4 layers already there',
        ),
      ],
      log: [
        'pulling a41c9e02d7b3 from ghcr.io/luis-mc/crsp-pool',
        'sha256 of every layer matches the key',
        'done in 3 min 56 s',
      ],
    }),
    build(3, 'p_go_web', 'm_pi', {
      state: 'building',
      reason: 'first runner',
      started_at: iso(RUNNING_STARTED),
      typical_seconds: Math.round(
        STEP_NAMES(goWeb).reduce((a, s) => a + s.seconds, 0) * 2.1,
      ),
      steps: [],
      log: [],
    }),
    build(4, 'p_node', 'm_build', {
      state: 'ready',
      reason: 'first runner',
      started_at: iso(FIXED_NOW - 6 * DAY),
      finished_at: iso(FIXED_NOW - 6 * DAY + 14 * MIN),
      size_mb: 2790,
      steps: doneSteps(prof('p_node')),
      log: logOf(prof('p_node'), 99),
    }),
    build(5, 'p_node', 'm_studio', {
      state: 'stale',
      reason: 'pin updated',
      started_at: iso(FIXED_NOW - 6 * DAY),
      finished_at: iso(FIXED_NOW - 6 * DAY + 9 * MIN),
      size_mb: 2790,
      steps: doneSteps(prof('p_node')),
      log: logOf(prof('p_node'), 99),
      previous_image: '2c91d03f7a60',
    }),
    build(6, 'p_node', 'm_pi', {
      state: 'ready',
      reason: 'first runner',
      started_at: iso(FIXED_NOW - 6 * DAY),
      finished_at: iso(FIXED_NOW - 6 * DAY + 31 * MIN),
      size_mb: 2790,
      steps: doneSteps(prof('p_node')),
      log: logOf(prof('p_node'), 99),
    }),
    build(7, 'p_rust', 'm_build', {
      state: 'failed',
      reason: 'layers changed',
      started_at: iso(FIXED_NOW - 55 * MIN),
      finished_at: iso(FIXED_NOW - 41 * MIN),
      previous_image: '5d7e20a9c1b4',
      steps: [
        step('Pull Ubuntu 24.04', 'done', 38),
        step('Base tools layer', 'done', 211),
        step('LLVM layer', 'failed', 322, 'The download does not match its pin'),
        step('Windows packaging layer', 'skipped'),
        step('KVM tools layer', 'skipped'),
        step('Linux packaging layer', 'skipped'),
        step('Fill the tool cache', 'skipped'),
        step('Self-check', 'skipped'),
      ],
      failure: {
        step: 'LLVM layer',
        kind: 'Checksum',
        why: 'The LLVM 20.1.8 download did not match its SHA-256 pin. The file was cut short, or the source changed.',
        next: 'Try again. If it fails again, check the pin. The old image of Build box keeps serving jobs.',
      },
      log: [
        ...logOf(rust, 2),
        '==> LLVM layer',
        ...(LOG_LINES['LLVM layer'] ?? []),
        'build failed after 5 min 22 s; the old image crsp-pool:5d7e20a9c1b4 stays in use',
      ],
    }),
    build(8, 'p_rust', 'm_studio', { state: 'not_built', reason: 'first runner' }),
    build(9, 'p_pool', 'm_build', {
      state: 'ready',
      reason: 'first runner',
      started_at: iso(FIXED_NOW - 9 * DAY),
      finished_at: iso(FIXED_NOW - 9 * DAY + 8 * MIN),
      size_mb: 1980,
      steps: doneSteps(prof('p_pool')),
      log: logOf(prof('p_pool'), 99),
    }),
    build(10, 'p_py', 'm_build', { state: 'queued', reason: 'stack changed' }),
    build(11, 'p_py', 'm_pi', { state: 'not_built', reason: 'first runner' }),
    // older, finished builds for the history
    build(12, 'p_go_web', 'm_build', {
      state: 'ready',
      reason: 'pin updated',
      started_at: iso(FIXED_NOW - 12 * DAY),
      finished_at: iso(FIXED_NOW - 12 * DAY + 17 * MIN),
      size_mb: 3110,
      steps: doneSteps(goWeb),
      log: logOf(goWeb, 99),
      key: '3f08aa17b290',
    }),
    build(13, 'p_go_web', 'm_build', {
      state: 'failed',
      reason: 'layers changed',
      started_at: iso(FIXED_NOW - 5 * DAY),
      finished_at: iso(FIXED_NOW - 5 * DAY + 3 * MIN),
      steps: [step('Pull Ubuntu 24.04', 'failed', 31)],
      failure: {
        step: 'Pull Ubuntu 24.04',
        kind: 'Network',
        why: 'The registry did not answer in time.',
        next: 'Tried again at once and it worked.',
      },
      log: ['==> Pull Ubuntu 24.04', 'dial tcp: i/o timeout'],
    }),
  ];
  const scans = scanFixtures();
  const pending = scans.filter((s) => s.state === 'needs_you');
  const disk: DiskUse[] = [
    {
      machine_id: 'm_studio',
      machine: 'Studio PC',
      total_bytes: 931 * GB,
      images_bytes: 9.1 * GB,
      caches_bytes: 31.6 * GB,
      budget_bytes: 100 * GB,
      free_bytes: 412 * GB,
      old_images: 1,
    },
    {
      machine_id: 'm_build',
      machine: 'Build box',
      total_bytes: 1863 * GB,
      images_bytes: 14.8 * GB,
      caches_bytes: 88.2 * GB,
      budget_bytes: 150 * GB,
      free_bytes: 1203 * GB,
      old_images: 2,
    },
    {
      machine_id: 'm_pi',
      machine: 'Pi lab',
      total_bytes: 238 * GB,
      images_bytes: 6.0 * GB,
      caches_bytes: 12.4 * GB,
      budget_bytes: 40 * GB,
      free_bytes: 71 * GB,
      old_images: 0,
    },
  ];
  return {
    profiles: PROFILES,
    builds,
    disk,
    scans,
    pending_findings: pending.reduce(
      (n, s) => n + s.findings.filter((f) => f.state !== 'covered').length,
      0,
    ),
    pending_repositories: pending.length,
    prebuilt: {
      registry: 'ghcr.io/luis-mc/crsp-pool',
      enabled: true,
      pulled: 1,
      built: 4,
    },
  };
}

/** The steps and the log of the running build at `now`: each step takes its typical time, scaled to the machine. */
export function liveBuild(b: ImageBuild, now: number): ImageBuild {
  if (b.state !== 'building' || !b.started_at) return b;
  const p = prof(b.profile_id);
  const plan = STEP_NAMES(p);
  const total = plan.reduce((a, s) => a + s.seconds, 0);
  const scale = b.typical_seconds / total;
  const elapsed = Math.max(0, (now - Date.parse(b.started_at)) / 1000);
  let acc = 0;
  let current = plan.length - 1;
  const steps: BuildStep[] = plan.map((s, i) => {
    const len = s.seconds * scale;
    const start = acc;
    acc += len;
    if (elapsed >= acc) return step(s.name, 'done', Math.round(len));
    if (elapsed >= start) {
      current = i;
      return step(s.name, 'running', Math.round(elapsed - start));
    }
    return step(s.name, 'waiting');
  });
  const log = logOf(p, current + 1);
  return { ...b, steps, log };
}

// ---------------------------------------------------------------- scans

const F = (
  id: string,
  kind: Finding['kind'],
  name: string,
  version: string | undefined,
  file: string,
  becomes: string,
  state: Finding['state'],
  note?: string,
): Finding => ({
  id,
  kind,
  name,
  ...(version ? { version } : {}),
  file,
  becomes,
  state,
  ...(note ? { note } : {}),
});

export function scanFixtures(): RepoScan[] {
  const at = iso(FIXED_NOW - 38 * MIN);
  const mk = (
    repo: (typeof REPOS)[number],
    profile_id: string,
    state: RepoScan['state'],
    files: number,
    workflows: number,
    findings: Finding[],
    commit: string,
  ): RepoScan => ({
    repository: repo.full_name,
    scanned_at: at,
    commit,
    files_read: files,
    workflows,
    profile_id,
    profile: profile_id ? (prof(profile_id)?.name ?? 'None yet') : 'None yet',
    state,
    findings,
  });
  return [
    mk(
      REPOS[0],
      'p_go_web',
      'confirmed',
      41,
      6,
      [
        F('a1', 'language', 'Go', '1.26', 'go.mod', 'Go in the tool cache', 'covered'),
        F(
          'a2',
          'language',
          'TypeScript',
          undefined,
          'tsconfig.json',
          'Node in Base tools',
          'covered',
        ),
        F(
          'a3',
          'package manager',
          'pnpm',
          '10.34.5',
          'package.json (packageManager)',
          'Base tools',
          'covered',
        ),
        F(
          'a4',
          'toolchain',
          'Node',
          '26.13.1',
          'package.json (engines)',
          'Base tools',
          'covered',
        ),
        F(
          'a5',
          'browser',
          'Playwright',
          '1.65.1',
          'pnpm-lock.yaml',
          'Browsers layer',
          'covered',
        ),
        F(
          'a6',
          'service',
          'Postgres',
          '16',
          '.github/workflows/ci.yml (services)',
          'postgres:16 per job',
          'covered',
        ),
        F(
          'a7',
          'container',
          'Docker build',
          undefined,
          'images/linux-base/Dockerfile',
          'Docker layer cache',
          'covered',
        ),
      ],
      '56edc0f',
    ),
    mk(
      REPOS[1],
      'p_pool',
      'confirmed',
      63,
      9,
      [
        F('b1', 'language', 'Python', '3.12', '.python-version', 'Base tools', 'covered'),
        F(
          'b2',
          'language',
          'Shell',
          undefined,
          'scripts/delivery/*.sh',
          'Base tools',
          'covered',
        ),
        F(
          'b3',
          'service',
          'Postgres',
          '16',
          'compose.yaml (db-1)',
          'postgres:16 with the runner',
          'covered',
        ),
        F(
          'b4',
          'service',
          'Alpine VM loader',
          '3.22',
          'compose.yaml (kvm-loader-1)',
          'alpine:3.22 with the runner',
          'covered',
        ),
        F(
          'b5',
          'container',
          'Compose group pool-main',
          undefined,
          'compose.yaml',
          'Pool tools profile',
          'covered',
        ),
      ],
      'a90c2f4',
    ),
    mk(
      REPOS[2],
      'p_rust',
      'needs_you',
      52,
      5,
      [
        F(
          'c1',
          'language',
          'Rust',
          '1.90.0',
          'rust-toolchain.toml',
          'Rust in the tool cache',
          'covered',
        ),
        F(
          'c2',
          'build tool',
          'cargo-xwin',
          '0.18.4',
          'Cargo.toml',
          'Tool cache',
          'covered',
        ),
        F(
          'c3',
          'toolchain',
          'LLVM',
          '20.1.8',
          '.github/workflows/windows.yml',
          'LLVM layer',
          'covered',
        ),
        F(
          'c4',
          'toolchain',
          'Node',
          '24.12.0',
          '.tool-versions',
          'Node in the tool cache',
          'covered',
        ),
        F(
          'c5',
          'build tool',
          'sccache',
          '0.10',
          '.github/workflows/ci.yml (mozilla-actions/sccache-action)',
          'sccache cache, 10 GB',
          'new',
          'The workflow turns it on; crsp would give it a local cache.',
        ),
        F(
          'c6',
          'toolchain',
          'Wine',
          '9.0',
          '.github/workflows/windows.yml',
          'Windows packaging layer',
          'covered',
        ),
      ],
      '3b71e08',
    ),
    mk(
      REPOS[3],
      'p_node',
      'needs_you',
      17,
      3,
      [
        F(
          'd1',
          'language',
          'JavaScript',
          undefined,
          'package.json',
          'Node in the tool cache',
          'covered',
        ),
        F(
          'd2',
          'toolchain',
          'Node',
          '22.23.4',
          '.nvmrc',
          'Node in the tool cache',
          'covered',
        ),
        F(
          'd3',
          'package manager',
          'npm',
          '10.9',
          'package-lock.json',
          'npm cache, 10 GB',
          'covered',
        ),
        F(
          'd4',
          'browser',
          'Playwright',
          '1.65.1',
          'package-lock.json',
          'Browsers layer',
          'covered',
        ),
        F(
          'd5',
          'toolchain',
          'Node',
          '20',
          '.github/workflows/preview.yml (setup-node)',
          'Node 20 in the tool cache',
          'conflict',
          '.nvmrc says 22; the preview workflow asks for 20.',
        ),
      ],
      'f20d6a1',
    ),
    mk(
      REPOS[4],
      'p_py',
      'needs_you',
      24,
      2,
      [
        F(
          'e1',
          'language',
          'Python',
          '3.12',
          '.python-version',
          'Python and uv layer',
          'new',
        ),
        F(
          'e2',
          'package manager',
          'uv',
          '0.5.11',
          'uv.lock',
          'Python and uv layer',
          'new',
        ),
        F(
          'e3',
          'service',
          'Redis',
          '7',
          '.github/workflows/ci.yml (services)',
          'redis:7 per job',
          'new',
        ),
        F(
          'e4',
          'build tool',
          'libpq headers',
          undefined,
          'pyproject.toml (psycopg)',
          'Extra packages: libpq-dev',
          'new',
        ),
      ],
      '8e4b0c7',
    ),
    mk(
      REPOS[5],
      '',
      'needs_you',
      38,
      4,
      [
        F(
          'f1',
          'language',
          'Kotlin',
          '2.0',
          'build.gradle.kts',
          'Java and Gradle layer',
          'new',
        ),
        F(
          'f2',
          'toolchain',
          'Java',
          '21',
          '.github/workflows/android.yml (setup-java, temurin)',
          'Java and Gradle layer',
          'new',
        ),
        F(
          'f3',
          'build tool',
          'Gradle',
          '8.10',
          'gradle/wrapper/gradle-wrapper.properties',
          'Gradle cache, 10 GB',
          'new',
        ),
        F(
          'f4',
          'toolchain',
          'Android SDK',
          '35',
          'app/build.gradle.kts (compileSdk)',
          'Android command-line tools',
          'new',
        ),
      ],
      '1d9c5b3',
    ),
  ];
}

export function poolRows(scans: readonly RepoScan[]): PoolStackRow[] {
  const map = new Map<string, PoolStackRow>();
  for (const s of scans)
    for (const f of s.findings) {
      const key = `${f.kind}:${f.name}`;
      const row = map.get(key) ?? {
        kind: f.kind,
        name: f.name,
        versions: [],
        repositories: [],
        becomes: f.becomes,
        state: 'covered' as const,
      };
      if (f.version && !row.versions.includes(f.version)) row.versions.push(f.version);
      if (!row.repositories.includes(s.repository)) row.repositories.push(s.repository);
      if (f.state === 'conflict') row.state = 'conflict';
      else if (f.state === 'new' && row.state !== 'conflict') row.state = 'new';
      map.set(key, row);
    }
  return [...map.values()].sort(
    (a, b) =>
      b.repositories.length - a.repositories.length || a.name.localeCompare(b.name),
  );
}

// ---------------------------------------------------------------- caches

const C = (
  id: string,
  tool: string,
  holds: string,
  scope: ToolCache['scope'],
  sizeGb: number,
  quotaGb: number,
  entries: number,
  hits: number,
  misses: number,
  saved: number,
  usedMinAgo: number,
  key_rule: string,
  eviction: string,
  machines: [string, number][],
): ToolCache => ({
  id,
  tool,
  holds,
  scope,
  size_bytes: Math.round(sizeGb * GB),
  quota_bytes: quotaGb * GB,
  entries,
  hit_rate_pct: hits + misses === 0 ? 0 : Math.round((hits / (hits + misses)) * 100),
  hits,
  misses,
  saved_seconds_week: saved,
  last_used_at: iso(FIXED_NOW - usedMinAgo * MIN),
  key_rule,
  eviction,
  per_machine: machines.map(([machine, gb]) => ({
    machine,
    size_bytes: Math.round(gb * GB),
  })),
  state: sizeGb > quotaGb ? 'over' : 'ok',
});

export function cacheFixtures(): ToolCache[] {
  return [
    C(
      'c_actions',
      'Actions cache',
      'Archives of actions/cache steps',
      'pool-wide',
      21.6,
      50,
      214,
      1820,
      463,
      41_400,
      4,
      'The key in the workflow, plus its restore keys',
      'Least recently used first; not used for 7 days goes',
      [['Build box', 21.6]],
    ),
    C(
      'c_pnpm',
      'pnpm store',
      'Packages by content hash',
      'per machine',
      8.4,
      20,
      4210,
      3410,
      220,
      28_800,
      9,
      'pnpm-lock.yaml hash',
      'Least recently used first',
      [
        ['Studio PC', 3.1],
        ['Build box', 4.2],
        ['Pi lab', 1.1],
      ],
    ),
    C(
      'c_npm',
      'npm cache',
      'Tarballs from the npm registry',
      'per machine',
      3.2,
      10,
      1980,
      910,
      84,
      7_200,
      31,
      'package-lock.json hash',
      'Least recently used first',
      [
        ['Build box', 2.4],
        ['Pi lab', 0.8],
      ],
    ),
    C(
      'c_go',
      'Go modules and build cache',
      'Module downloads and compiled packages',
      'per runner',
      6.1,
      20,
      1320,
      2750,
      410,
      33_100,
      6,
      'go.sum hash and the Go version',
      'Least recently used first',
      [
        ['Studio PC', 1.9],
        ['Build box', 3.4],
        ['Pi lab', 0.8],
      ],
    ),
    C(
      'c_cargo',
      'Cargo registry and target',
      'Crates and compiled build profiles',
      'per runner',
      41.2,
      40,
      26,
      290,
      97,
      61_800,
      52,
      'Cargo.lock hash and the Rust version',
      'Whole build profiles, oldest first; cap 40 GB',
      [['Build box', 41.2]],
    ),
    C(
      'c_sccache',
      'sccache',
      'Compiled objects shared by Rust and C',
      'pool-wide',
      4.7,
      10,
      8210,
      4010,
      2290,
      12_600,
      52,
      'Hash of the compiler, flags and source',
      'Least recently used first',
      [['Build box', 4.7]],
    ),
    C(
      'c_py',
      'pip and uv',
      'Wheels and built packages',
      'per machine',
      1.8,
      10,
      690,
      530,
      61,
      3_900,
      140,
      'uv.lock or requirements hash',
      'Least recently used first',
      [
        ['Build box', 1.2],
        ['Pi lab', 0.6],
      ],
    ),
    C(
      'c_gradle',
      'Gradle and Maven',
      'Dependencies and build outputs',
      'per machine',
      0,
      10,
      0,
      0,
      0,
      0,
      0,
      'Wrapper version and lock file hash',
      'Least recently used first',
      [],
    ),
    C(
      'c_docker',
      'Docker layers',
      'Layers of docker build and buildx',
      'per machine',
      12.2,
      30,
      318,
      640,
      140,
      18_400,
      17,
      'The layer content hash',
      'Layers no image uses, oldest first',
      [
        ['Studio PC', 4.2],
        ['Build box', 6.4],
        ['Pi lab', 1.6],
      ],
    ),
    C(
      'c_tools',
      'Tool cache',
      'Node, Go, Rust, Python builds by version',
      'per machine',
      5.4,
      20,
      41,
      1250,
      33,
      9_900,
      12,
      'Tool and version; SHA-256 checked',
      'Versions no repository asks for any more',
      [
        ['Studio PC', 1.7],
        ['Build box', 2.8],
        ['Pi lab', 0.9],
      ],
    ),
  ];
}

export function imagesDisk(f: ReturnType<typeof buildFixtures>): DiskUse[] {
  return f.disk;
}

/** Every layer a profile can have, for the wizard's choice list. */
export const LAYER_CATALOG: LayerRef[] = Object.values(L).map((l) => ({
  ...l,
  state: 'on' as const,
}));
