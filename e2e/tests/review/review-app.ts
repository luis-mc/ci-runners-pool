// Helpers for the RES19 and RES20 review build: a static server for docs/review/RES20/app and the screens to visit.
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { PROFILES } from '../../../apps/web/src/review/fixtures';

export const APP_DIR = resolve('docs/review/RES20/app');
export const SHOTS_DIR = resolve('docs/review/RES20/shots');

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export function hasApp(): boolean {
  return existsSync(join(APP_DIR, 'index.html'));
}

/** Serves the built review app on a free port, like `python3 -m http.server` in that folder. */
export function serveApp(): Promise<{ url: string; server: Server }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/'));
      const file = join(APP_DIR, path.endsWith('/') ? `${path}index.html` : path);
      if (!file.startsWith(APP_DIR) || !existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      ok({ url: `http://127.0.0.1:${port}/`, server });
    });
  });
}

export interface ReviewScreen {
  name: string;
  hash: string;
  /** The words of the h1. */
  h1: RegExp;
  /** Set for a wizard screen: the phase it shows. */
  phase?: string;
}

export const WIZARD_PHASES = [
  'loading',
  'first-run',
  'planning',
  'ready-to-review',
  'running',
  'paused',
  'stopped',
  'failed',
  'done',
  'done-after-reload',
] as const;

/** The add-runners wizard is shown in the five states that differ most. */
export const ADD_RUNNERS_PHASES = [
  'first-run',
  'ready-to-review',
  'running',
  'failed',
  'done',
] as const;

function exactly(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The screens of the review build: the four tabs, a page of each kind, and the wizards in their states. */
export function reviewScreens(): ReviewScreen[] {
  const name = (id: string) => PROFILES.find((p) => p.id === id)?.name ?? id;
  const tab = (n: string, q: string): ReviewScreen => ({
    name: n,
    hash: `#/pool/images${q}`,
    h1: /^Images and caches$/,
  });
  const page = (n: string, hash: string, h1: string): ReviewScreen => ({
    name: n,
    hash,
    h1: new RegExp(`^${exactly(h1)}$`),
  });
  const out: ReviewScreen[] = [
    tab('images-overview', ''),
    tab('images-profiles', '?tab=profiles'),
    tab('images-stacks', '?tab=stacks'),
    tab('images-caches', '?tab=caches'),
    page('profile-go-web', '#/pool/images/profiles/p_go_web', name('p_go_web')),
    page('profile-out-of-date', '#/pool/images/profiles/p_node', name('p_node')),
    page('profile-compose-group', '#/pool/images/profiles/p_pool', name('p_pool')),
    page('build-running', '#/pool/images/builds/bld_3', `${name('p_go_web')} on Pi lab`),
    page('build-failed', '#/pool/images/builds/bld_7', `${name('p_rust')} on Build box`),
    page('build-ready', '#/pool/images/builds/bld_1', `${name('p_go_web')} on Build box`),
    page(
      'build-pulled',
      '#/pool/images/builds/bld_2',
      `${name('p_go_web')} on Studio PC`,
    ),
    page(
      'build-out-of-date',
      '#/pool/images/builds/bld_5',
      `${name('p_node')} on Studio PC`,
    ),
    page('build-queued', '#/pool/images/builds/bld_10', `${name('p_py')} on Build box`),
    page(
      'stack-ml-notebooks',
      '#/pool/images/stacks/luis-mc/ml-notebooks',
      'luis-mc/ml-notebooks',
    ),
    page(
      'stack-docs-site-conflict',
      '#/pool/images/stacks/luis-mc/docs-site',
      'luis-mc/docs-site',
    ),
    page(
      'stack-mobile-client-new',
      '#/pool/images/stacks/luis-mc/mobile-client',
      'luis-mc/mobile-client',
    ),
    page(
      'stack-dev-standards-compose',
      '#/pool/images/stacks/luis-mc/dev-standards',
      'luis-mc/dev-standards',
    ),
    page(
      'cache-cargo-over-quota',
      '#/pool/images/caches/c_cargo',
      'Cargo registry and target',
    ),
    page('cache-gradle-empty', '#/pool/images/caches/c_gradle', 'Gradle and Maven'),
  ];
  for (const phase of WIZARD_PHASES)
    out.push({
      ...page(
        `profile-wizard-${phase}`,
        `#/pool/images/stacks/luis-mc/ml-notebooks/confirm?phase=${phase}`,
        'Confirm findings of luis-mc/ml-notebooks',
      ),
      phase,
    });
  out.push({
    ...page(
      'profile-wizard-edit',
      '#/pool/images/profiles/p_go_web/edit?phase=first-run',
      'Edit profile',
    ),
    phase: 'first-run',
  });
  out.push(
    tab('registry-overview', '?tab=registry'),
    page(
      'registry-image-update-found',
      '#/pool/images/registry/reg_c_docs_v4',
      'Node web apps',
    ),
    page(
      'registry-image-in-use',
      '#/pool/images/registry/reg_std_go_x64',
      'Go, Node and Postgres',
    ),
    page(
      'registry-image-superseded',
      '#/pool/images/registry/reg_c_docs_v2',
      'Node web apps',
    ),
    page(
      'registry-image-unused',
      '#/pool/images/registry/reg_c_mobile_old',
      'Rust and Windows packaging',
    ),
    page(
      'registry-image-variant',
      '#/pool/images/registry/reg_c_ml_wasm',
      'Python and uv',
    ),
    page('registry-budgets', '#/pool/images/registry/budgets', 'Registry budgets'),
  );
  for (const phase of WIZARD_PHASES)
    out.push({
      ...page(
        `registry-replace-${phase}`,
        `#/pool/images/registry/reg_c_docs_v4/replace?phase=${phase}`,
        'Replace an image',
      ),
      phase,
    });
  for (const phase of ADD_RUNNERS_PHASES)
    out.push({
      ...page(
        `add-runners-pulling-${phase}`,
        `#/pool/runners/add-pulling?phase=${phase}`,
        'Add runners',
      ),
      phase,
    });
  for (const phase of ADD_RUNNERS_PHASES)
    out.push({
      ...page(
        `add-runners-building-${phase}`,
        `#/pool/runners/add-building?phase=${phase}`,
        'Add runners',
      ),
      phase,
    });
  return out;
}

/** Other areas of the console must open in the review build too. */
export const OTHER_AREAS = [
  { name: 'overview', hash: '#/' },
  { name: 'shared-pool', hash: '#/pool' },
  { name: 'repositories', hash: '#/repositories' },
  { name: 'doctor', hash: '#/doctor' },
  { name: 'settings', hash: '#/settings' },
];

export const THEMES = [
  { name: 'phosphor-dark', theme: 'phosphor', mode: 'dark' },
  { name: 'phosphor-light', theme: 'phosphor', mode: 'light' },
] as const;
