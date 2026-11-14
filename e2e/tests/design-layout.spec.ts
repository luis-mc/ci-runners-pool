import { expect, test } from '@playwright/test';
import { expectDomLayout } from '../../scripts/design/dom-layout';
import { signedIn } from './web-console/fixtures';

// The DOM layout checker (design system, Enforcement kit) on the console's M1 screens, at 360, 393 and 1300 px.
// It uses the DOM only. The known list (scripts/design/layout.known.json) is empty and only shrinks.
const SCREENS: { name: string; path: string; ready: string; loads?: string[] }[] = [
  { name: 'overview', path: '/', ready: 'Overview' },
  { name: 'repositories', path: '/repositories', ready: 'Repositories' },
  { name: 'repository detail', path: '/repositories/octo/app', ready: 'octo/app' },
  { name: 'turn on the pool', path: '/repositories/turn-on', ready: 'Turn on the pool' },
  { name: 'machines', path: '/machines', ready: 'Machines' },
  { name: 'machine detail', path: '/machines/m1', ready: 'build-1' },
  { name: 'add a machine', path: '/machines/add', ready: 'Add a machine' },
  { name: 'runners', path: '/runners', ready: 'Runners' },
  { name: 'add runners', path: '/runners/add', ready: 'Add runners' },
  { name: 'settings users', path: '/settings/users', ready: 'Settings' },
  { name: 'settings appearance', path: '/settings/appearance', ready: 'Settings' },
  { name: 'settings retention', path: '/settings/retention', ready: 'Settings' },
  {
    name: 'settings budgets',
    path: '/settings/budgets',
    ready: 'Settings',
    loads: ['/api/v1/settings/pool', '/api/v1/settings/queue'],
  },
];

for (const screen of SCREENS) {
  test(`layout: ${screen.name}`, async ({ page }) => {
    const mock = signedIn();
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
    await mock.install(page);
    await page.goto(screen.path);
    await expect(
      page.getByRole('heading', { level: 1, name: screen.ready }),
    ).toBeVisible();
    if (screen.loads) await expect(page.getByText('Queue order')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectDomLayout(page, screen.name, { spaceVar: '--ds-space-' });
  });
}
