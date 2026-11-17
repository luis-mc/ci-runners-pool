// Review-only (LOOK17). Renders Repositories (7 private repos, 2 with the pool on) at 1300, 1800 and 393 px,
// Phosphor dark, and audits every console screen for a horizontal scroll bar. Not part of the product or the gate.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, type Page } from '@playwright/test';
import { repository, signedIn } from '../../../../e2e/tests/web-console/fixtures';
import { jobsAndDoctor } from '../../../../e2e/tests/web-console/jobs-doctor-fixtures';

const variant = process.env.VARIANT ?? 'today';
const out = resolve(import.meta.dirname, '..');
const WIDTHS = [
  { width: 1300, height: 900 },
  { width: 1800, height: 1000 },
  { width: 393, height: 852 },
];

const NAMES = [
  'comics-organizer',
  'home-automation',
  'lan-link',
  'moobable',
  'padevia',
  'personal-finances-management',
  'shared-product-framework',
];
const base = (i: number) => {
  const on = i === 3 || i === 4; // moobable and padevia
  return repository({
    id: 100 + i,
    full_name: `luis-mc/${NAMES[i]}`,
    owner: 'luis-mc',
    name: NAMES[i],
    visibility: 'private',
    pool_on: on,
    variables: on ? [{ name: 'CRSP_POOL', status: 'ok' }] : [],
    policy: {
      priority: on ? 10 : 0,
      max_parallel_jobs: on ? 2 : 1,
      allow_fork_pull_requests: false,
      light_runner: true,
      labels: on ? ['self-hosted', 'linux', 'x64', 'crsp'] : ['self-hosted'],
      runner_groups: [],
    },
    routing: on ? { where: 'crsp', why: 'machine_up', oses: ['linux'], used_minutes: 0 } : undefined,
    webhook: on
      ? { mode: 'webhook', last_delivery_at: '2026-11-17T09:00:00Z', last_result: 'ok', failures_in_a_row: 0 }
      : undefined,
  });
};

function mocked() {
  const m = jobsAndDoctor(signedIn());
  const items = NAMES.map((_, i) => base(i));
  m.on('GET', '/api/v1/github/repositories', { items, stale: { stale: false } });
  m.on('GET', '/api/v1/repositories/:id', (_c: unknown, p: Record<string, string>) =>
    items.find((r) => String(r.id) === p['id']) ?? items[3],
  );
  return m;
}

async function open(page: Page, mock: ReturnType<typeof mocked>, path: string) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('crsp.theme-name', 'phosphor');
    } catch {
      /* none */
    }
  });
  await mock.install(page);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-theme-name', 'phosphor');
  });
  for (const name of ['all', variant]) {
    const css = resolve(import.meta.dirname, `${name}.css`);
    if (existsSync(css)) await page.addStyleTag({ content: readFileSync(css, 'utf8') });
  }
  await page.waitForTimeout(400);
}

/** Every box that scrolls sideways: the page itself, or a frame inside it (a bar the owner sees). */
async function scrollers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) found.push('page');
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1)
        found.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0] ?? ''}`);
    }
    // A table that pokes out of its pane without a scroll bar is still wrong: compare each pane with what is in it.
    for (const pane of document.querySelectorAll<HTMLElement>('.ds-pane')) {
      const edge = pane.getBoundingClientRect().right;
      for (const el of pane.querySelectorAll<HTMLElement>('td, th, li, dd')) {
        if (el.getBoundingClientRect().right > edge + 1) {
          found.push('pokes out of pane');
          break;
        }
      }
    }
    return found;
  });
}

test('repositories', async ({ page }) => {
  mkdirSync(resolve(out, variant), { recursive: true });
  const report: Record<string, string[]> = {};
  for (const vp of WIDTHS) {
    await page.setViewportSize(vp);
    await open(page, mocked(), '/repositories');
    await page.getByRole('heading', { level: 1, name: 'Repositories' }).waitFor();
    await page.waitForTimeout(300);
    report[String(vp.width)] = await scrollers(page);
    await page.screenshot({ path: resolve(out, variant, `repositories-${vp.width}.png`), fullPage: true });
  }
  console.log(`SCROLL ${variant} ${JSON.stringify(report)}`);
});

// Every other screen: which ones show a horizontal scroll bar (the page, or a frame inside it) at 1300 and 393 px, today.
const SCREENS: [string, string][] = [
  ['overview', '/'],
  ['machines', '/machines'],
  ['machine-detail', '/machines/m1'],
  ['add-machine', '/machines/add'],
  ['repository-detail', '/repositories/octo/app'],
  ['turn-on-the-pool', '/repositories/turn-on'],
  ['runners', '/runners'],
  ['add-runners', '/runners/add'],
  ['jobs', '/jobs'],
  ['job-detail', '/jobs/2'],
  ['doctor', '/doctor'],
  ['images', '/images'],
  ['image-detail', '/images/img_m1_linux'],
  ['caches', '/images?tab=caches'],
  ['settings-access', '/settings/access'],
  ['settings-repositories', '/settings/repositories'],
  ['settings-console', '/settings/console'],
  ['settings-data', '/settings/data'],
  ['settings-audit', '/settings/audit'],
];

test('audit: other screens', async ({ page }) => {
  test.skip(variant !== 'today', 'only for today');
  const dir = resolve(out, 'scroll-audit');
  mkdirSync(dir, { recursive: true });
  const rows: string[] = [];
  for (const [name, path] of SCREENS) {
    for (const vp of [WIDTHS[0]!, WIDTHS[2]!]) {
      await page.setViewportSize(vp);
      const m = mocked();
      m.on('GET', '/api/v1/audit', {
        items: [
          {
            id: 1,
            at: '2026-11-14T10:00:00Z',
            actor: 'octo',
            source: 'web',
            action: 'machine.drain',
            target_type: 'machine',
            target_id: 'm1',
            summary: 'drained build-1',
            result: 'done',
          },
        ],
      });
      await open(page, m, path);
      const found = await scrollers(page);
      const bar = found;
      if (bar.length) {
        await page.screenshot({ path: resolve(dir, `${name}-${vp.width}.png`), fullPage: true });
        rows.push(`${name}\t${vp.width}\t${[...new Set(bar)].join(', ')}`);
      }
    }
  }
  console.log(`AUDIT\n${rows.join('\n')}`);
});
