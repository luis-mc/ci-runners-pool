import { expect, test } from '@playwright/test';
import { expectDomLayout } from '../../scripts/design/dom-layout';
import { failure, needingRecovery, signedIn } from './web-console/fixtures';
import { jobsAndDoctor } from './web-console/jobs-doctor-fixtures';

// The DOM layout checker (design system, Enforcement kit) on the console's M1 screens, at 360, 393 and 1300 px.
// It uses the DOM only. The known list (scripts/design/layout.known.json) is empty and only shrinks.
const SCREENS: {
  name: string;
  path: string;
  ready: string;
  loads?: string[];
  recovery?: boolean;
  signedOut?: boolean;
}[] = [
  { name: 'sign-in', path: '/sign-in', ready: 'Sign in', signedOut: true },
  { name: 'first-run wizard', path: '/setup', ready: 'Set up the pool' },
  { name: 'overview', path: '/', ready: 'Overview' },
  { name: 'repositories', path: '/repositories', ready: 'Repositories' },
  { name: 'repository detail', path: '/repositories/octo/app', ready: 'octo/app' },
  { name: 'turn on the pool', path: '/repositories/turn-on', ready: 'Turn on the pool' },
  { name: 'machines', path: '/machines', ready: 'Machines' },
  { name: 'machine detail', path: '/machines/m1', ready: 'build-1' },
  {
    name: 'machine detail needing recovery',
    path: '/machines/m1',
    ready: 'build-1',
    recovery: true,
  },
  { name: 'add a machine', path: '/machines/add', ready: 'Add a machine' },
  { name: 'runners', path: '/runners', ready: 'Runners' },
  { name: 'jobs', path: '/jobs', ready: 'Jobs' },
  { name: 'job detail', path: '/jobs/2', ready: 'test-2' },
  { name: 'doctor', path: '/doctor', ready: 'Doctor' },
  { name: 'add runners', path: '/runners/add', ready: 'Add runners' },
  { name: 'images', path: '/images', ready: 'Images and caches' },
  { name: 'caches', path: '/images?tab=caches', ready: 'Images and caches' },
  { name: 'settings users', path: '/settings/users', ready: 'Settings' },
  { name: 'settings app key', path: '/settings/app', ready: 'Settings' },
  { name: 'settings appearance', path: '/settings/appearance', ready: 'Settings' },
  { name: 'settings retention', path: '/settings/retention', ready: 'Settings' },
  {
    name: 'settings budgets',
    path: '/settings/budgets',
    ready: 'Settings',
    loads: ['/api/v1/settings/pool', '/api/v1/settings/queue'],
  },
  { name: 'settings audit log', path: '/settings/audit', ready: 'Settings' },
  { name: 'settings config export', path: '/settings/export', ready: 'Settings' },
];

for (const screen of SCREENS) {
  test(`layout: ${screen.name}`, async ({ page }) => {
    const mock = jobsAndDoctor(signedIn());
    if (screen.recovery) mock.on('GET', '/api/v1/machines/:id', needingRecovery());
    if (screen.loads) {
      mock
        .on('GET', '/api/v1/settings/pool', {
          budget_memory_pct: 85,
          budget_cpu_pct: 60,
          size_slots_from_machine: true,
          default_job_slots: 2,
          drain_timeout_minutes: 60,
        })
        .on('GET', '/api/v1/settings/queue', {
          order: ['priority', 'event_class', 'fair_share', 'queued_at'],
          fair_share: true,
          no_runner_wait_minutes: 2,
        });
    }
    mock.on('GET', '/api/v1/audit', {
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
    if (screen.signedOut)
      mock.on('GET', '/api/v1/me', failure(401, 'unauthenticated', 'Sign in.'));
    await mock.install(page);
    await page.goto(screen.path);
    await expect(
      page.getByRole('heading', { level: 1, name: screen.ready }),
    ).toBeVisible();
    if (screen.loads) await expect(page.getByText('Queue order')).toBeVisible();
    if (screen.recovery)
      await expect(page.getByRole('button', { name: 'Recover' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectDomLayout(page, screen.name, { spaceVar: '--ds-space-' });
  });
}

// UX-15: on a wide screen the step bar of a wizard is one row, not a wrapped narrow column (CRSP124).
for (const path of ['/repositories/turn-on', '/runners/add', '/machines/add']) {
  test(`step bar is one row at 1300 px: ${path}`, async ({ page }) => {
    const mock = jobsAndDoctor(signedIn());
    await mock.install(page);
    await page.setViewportSize({ width: 1300, height: 900 });
    await page.goto(path);
    await expect(page.getByRole('list', { name: 'Steps' })).toBeVisible();
    const tops = await page
      .getByRole('list', { name: 'Steps' })
      .locator('li')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    const frame = await page.locator('.ds-page').first().boundingBox();
    expect(frame?.width ?? 0).toBeGreaterThan(900);
  });
}
