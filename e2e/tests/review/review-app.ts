// Helpers for the RES15 review build: a static server for docs/review/RES15/app and the screens to visit.
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { buildFixtures } from '../../../apps/web/src/review/fixtures';

export const APP_DIR = resolve('docs/review/RES15/app');
export const SHOTS_DIR = resolve('docs/review/RES15/shots');

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
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
  /** A step before the check or the picture: a run row opened in place. */
  expand?: boolean;
}

/** Opens the first run row of the list in place (its Open run button), and waits for its waterfall. */
export async function expandFirstRun(page: Page): Promise<void> {
  const button = page
    .getByRole('button', { name: 'Open run', exact: true })
    .and(page.locator('[aria-expanded]'))
    .first();
  await button.click();
  await page
    .getByRole('region', { name: /^Open run: / })
    .first()
    .waitFor();
  await page.waitForTimeout(200);
}

/** The screens of the review build: the tabs, and a job page of each kind, and a run page. */
export function reviewScreens(): ReviewScreen[] {
  const data = buildFixtures();
  const job = (f: (j: (typeof data.jobs)[number]) => boolean) => {
    const j = data.jobs.find(f);
    if (!j) throw new Error('no fixture job of this kind');
    return j;
  };
  const running = job((j) => j.state === 'running' && (j.steps?.length ?? 0) > 0);
  const failed = job((j) => j.result === 'failure');
  const queued = job((j) => j.queue_position === 1);
  const matrix = job((j) => j.matrix.length === 2 && j.state === 'done');
  const retried = job((j) => j.run_attempt === 2);
  const long = data.runs.find((r) => r.jobs.length === 14);
  if (!long) throw new Error('no long run');
  const timing = data.runs.find((r) => r.graph?.source === 'timing');
  if (!timing) throw new Error('no run with a timing graph');
  const tab = (name: string, path: string): ReviewScreen => ({
    name,
    hash: `#/jobs${path}`,
    h1: /^Jobs$/,
  });
  return [
    tab('jobs-queue', ''),
    tab('jobs-running', '/running'),
    tab('jobs-done', '/done'),
    tab('jobs-by-repository', '/repository'),
    tab('jobs-by-machine', '/machine'),
    tab('jobs-by-runner', '/runner'),
    tab('jobs-by-runner-type', '/runner-type'),
    tab('jobs-by-job-type', '/job-type'),
    tab('jobs-charts', '/charts'),
    tab('jobs-queue-jobs', '?view=jobs'),
    tab('jobs-running-jobs', '/running?view=jobs'),
    tab('jobs-done-jobs', '/done?view=jobs'),
    { ...tab('jobs-queue-expanded', ''), expand: true },
    { ...tab('jobs-running-expanded', '/running'), expand: true },
    { ...tab('jobs-done-expanded', '/done'), expand: true },
    {
      name: 'job-running',
      hash: `#/jobs/${running.id}`,
      h1: new RegExp(exactly(running.job_name as string)),
    },
    {
      name: 'job-failed',
      hash: `#/jobs/${failed.id}`,
      h1: new RegExp(exactly(failed.job_name as string)),
    },
    {
      name: 'job-queued',
      hash: `#/jobs/${queued.id}`,
      h1: new RegExp(exactly(queued.job_name as string)),
    },
    {
      name: 'job-matrix',
      hash: `#/jobs/${matrix.id}`,
      h1: new RegExp(exactly(matrix.job_name as string)),
    },
    {
      name: 'job-retried',
      hash: `#/jobs/${retried.id}`,
      h1: new RegExp(exactly(retried.job_name as string)),
    },
    {
      name: 'run-timing-graph',
      hash: `#/jobs/run/${timing.id}`,
      h1: new RegExp(exactly(`${timing.workflow} on ${timing.branch}`)),
    },
    { name: 'run-long-dag', hash: `#/jobs/run/${long.id}`, h1: /Release on main/ },
  ];
}

function exactly(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
