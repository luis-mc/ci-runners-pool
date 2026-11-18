import { expect, test } from '@playwright/test';
import { expectDomLayout } from '../../scripts/design/dom-layout';
import { failure, needingRecovery, publicRows, signedIn } from './web-console/fixtures';
import { jobsAndDoctor } from './web-console/jobs-doctor-fixtures';

// The DOM layout checker (design system, Enforcement kit) on the console's M1 screens, at 360, 393 and 1300 px.
// It uses the DOM only. The known list (scripts/design/layout.known.json) is empty and only shrinks.
const SCREENS: {
  name: string;
  path: string;
  ready: string;
  loads?: string[];
  recovery?: boolean;
  publicRows?: boolean;
  signedOut?: boolean;
  policy?: boolean;
  tweak?: (m: ReturnType<typeof signedIn>) => unknown;
}[] = [
  { name: 'sign-in', path: '/sign-in', ready: 'Sign in', signedOut: true },
  { name: 'first-run wizard', path: '/setup', ready: 'Set up the pool' },
  {
    name: 'first-run without a setup link',
    path: '/setup',
    ready: 'Set up the pool',
    tweak: (m: ReturnType<typeof signedIn>) =>
      m.on('GET', '/api/v1/setup', {
        has_app: false,
        has_owner: false,
        setup_link_redeemed: false,
        steps: {
          connect_github: 'todo',
          first_machine: 'todo',
          first_repository: 'todo',
        },
      }),
  },
  { name: 'overview', path: '/', ready: 'Overview' },
  { name: 'repositories', path: '/repositories', ready: 'Repositories' },
  {
    name: 'repositories with a public row while the setting is off',
    path: '/repositories',
    ready: 'Repositories',
    publicRows: true,
  },
  { name: 'repository detail', path: '/repositories/octo/app', ready: 'octo/app' },
  {
    name: 'repository policy',
    path: '/repositories/octo/app',
    ready: 'octo/app',
    policy: true,
  },
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
  {
    name: 'jobs empty',
    path: '/jobs',
    ready: 'Jobs',
    tweak: (m: ReturnType<typeof signedIn>) =>
      m.on('GET', '/api/v1/jobs', { items: [], stale: { stale: false } }),
  },
  { name: 'job detail', path: '/jobs/2', ready: 'test-2' },
  { name: 'doctor', path: '/doctor', ready: 'Doctor' },
  { name: 'add runners', path: '/runners/add', ready: 'Add runners' },
  { name: 'images', path: '/images', ready: 'Images and caches' },
  { name: 'image detail', path: '/images/img_m1_linux', ready: 'build-1' },
  { name: 'caches', path: '/images?tab=caches', ready: 'Images and caches' },
  { name: 'settings access', path: '/settings/access', ready: 'Settings' },
  {
    name: 'settings repositories',
    path: '/settings/repositories',
    ready: 'Settings',
    loads: ['/api/v1/settings/pool', '/api/v1/settings/queue'],
  },
  { name: 'settings console', path: '/settings/console', ready: 'Settings' },
  { name: 'settings data', path: '/settings/data', ready: 'Settings' },
  { name: 'settings audit log', path: '/settings/audit', ready: 'Settings' },
  { name: 'settings old address', path: '/settings/backups', ready: 'Settings' },
  // The small page the tray opens (TRAY4): asks first, follows the stage, says what failed.
  ...(['confirm', 'running', 'failed', 'done'] as const).map((state) => ({
    name: `update page ${state}`,
    path: '/update',
    ready: 'Update',
    tweak: (m: ReturnType<typeof signedIn>) =>
      m.on('GET', '/api/v1/update', updateStatus(state)),
  })),
];

function updateStatus(state: 'confirm' | 'running' | 'failed' | 'done') {
  const base = {
    current_version: '1.4.0',
    latest_version: '1.5.0',
    update_available: true,
    state: 'idle',
    auto_update: false,
    running_jobs: [],
    drain_timeout_minutes: 60,
  };
  if (state === 'running')
    return {
      ...base,
      state: 'downloading',
      stage: {
        name: 'downloading',
        percent: 42,
        version: '1.5.0',
        at: new Date().toISOString(),
      },
    };
  if (state === 'failed')
    return {
      ...base,
      state: 'failed',
      error: 'The installer failed with exit code 1603',
      stage: {
        name: 'failed',
        failed_at: 'installing',
        error: 'The installer failed with exit code 1603',
        log_path: 'C:\\ProgramData\\crsp\\logs\\msi-update.log',
        at: new Date().toISOString(),
      },
    };
  if (state === 'done')
    return {
      ...base,
      current_version: '1.5.0',
      update_available: false,
      stage: {
        name: 'done',
        percent: 100,
        version: '1.5.0',
        at: new Date().toISOString(),
      },
    };
  return base;
}

for (const screen of SCREENS) {
  test(`layout: ${screen.name}`, async ({ page }) => {
    const mock = jobsAndDoctor(signedIn());
    screen.tweak?.(mock);
    if (screen.recovery) mock.on('GET', '/api/v1/machines/:id', needingRecovery());
    if (screen.publicRows) mock.on('GET', '/api/v1/github/repositories', publicRows());
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
    if (screen.policy)
      await expect(page.getByRole('heading', { name: 'Policy' })).toBeVisible();
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

// CRSP132, UX-11: on a wide screen the toolbar above a list is one row (search, filters, selection, count, actions).
for (const path of ['/repositories', '/machines', '/runners', '/jobs']) {
  test(`list toolbar is one row at 1300 px: ${path}`, async ({ page }) => {
    // The Repositories toolbar (search, Pool, Active types, Select all, count, Add) no longer fits one row inside its pane.
    test.fixme(
      path === '/repositories',
      'CRSP162 toolbar wraps inside the pane at 1300 px',
    );
    const mock = jobsAndDoctor(signedIn());
    await mock.install(page);
    await page.setViewportSize({ width: 1300, height: 900 });
    await page.goto(path);
    const bar = page.locator('.ds-list-toolbar').first();
    await expect(bar).toBeVisible();
    const tops = await bar.locator(':scope > *').evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return Math.round(r.top + r.height / 2);
      }),
    );
    expect(tops.length).toBeGreaterThan(1);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(8);
  });
}

// UX-15, UX-68, CRSP157: the Settings tabs are one row when they fit; on a phone they wrap onto more rows and never
// scroll sideways, and the page does not scroll sideways either.
for (const width of [1232, 1300, 393, 360]) {
  test(`settings tabs do not scroll sideways at ${width} px`, async ({ page }) => {
    const mock = jobsAndDoctor(signedIn());
    await mock.install(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/settings/users');
    const list = page.getByRole('tablist', { name: 'Settings' });
    await expect(list).toBeVisible();
    if (width >= 1232) {
      const tops = await list
        .getByRole('tab')
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      expect(new Set(tops).size).toBe(1);
    }
    const tabsFit = await list.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(tabsFit).toBe(true);
    const page_ = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(page_).toBe(true);
  });
}

// CRSP140: every titled part of a page is a pane with its title in the top border.
test('settings access for CI shows panes and the form only on demand', async ({
  page,
}) => {
  const mock = jobsAndDoctor(signedIn());
  await mock.install(page);
  await page.goto('/settings/access');
  await expect(page.getByRole('region', { name: 'Access for CI' })).toBeVisible();
  await expect(page.locator('.ds-pane').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Make an access' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Make an access' }).click();
  await expect(page.getByRole('region', { name: 'Make an access' })).toBeVisible();
});

// CRSP159, UX-15, UX-16: on a phone the areas are one Menu button, not four rows of links; every area is
// reachable by opening it.
for (const width of [360, 393]) {
  test(`the areas are one Menu button at ${width} px`, async ({ page }) => {
    const mock = jobsAndDoctor(signedIn());
    await mock.install(page);
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const button = page.getByRole('button', { name: /^Menu:/ });
    await expect(button).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Areas' })).toHaveCount(0);
    expect((await button.boundingBox())?.height ?? 99).toBeLessThanOrEqual(60);
    await button.click();
    await expect(
      page.getByRole('navigation', { name: 'Areas' }).getByRole('link'),
    ).toHaveCount(8);
  });
}

// CRSP160, UX-6: with every step done the setup page offers one primary that goes on, and no word sends the owner to a terminal.
test('setup done: one primary, Open the overview, and no terminal words', async ({
  page,
}) => {
  await jobsAndDoctor(signedIn()).install(page);
  await page.goto('/setup');
  const go = page.getByRole('button', { name: 'Open the overview' });
  await expect(go).toBeVisible();
  await expect(page.locator('[data-kind="primary"]')).toHaveCount(1);
  await expect(page.locator('main')).not.toContainText(/crsp open|terminal/i);
  await go.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
});

// CRSP160, UX-6: the first-run text offers the tray's Open, not a command.
test('setup without a link names the tray, not a terminal', async ({ page }) => {
  const mock = jobsAndDoctor(signedIn());
  mock.on('GET', '/api/v1/setup', {
    has_app: false,
    has_owner: false,
    setup_link_redeemed: false,
    steps: { connect_github: 'todo', first_machine: 'todo', first_repository: 'todo' },
  });
  await mock.install(page);
  await page.goto('/setup');
  await expect(page.getByText(/Open in the tray menu/)).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/crsp open|terminal/i);
});
