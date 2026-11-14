import { expect, test } from '@playwright/test';
import { expectDomLayout } from '../../scripts/design/dom-layout';
import { signedIn } from './web-console/fixtures';

// The DOM layout checker (design system, Enforcement kit) on the console's M1 screens, at 360, 393 and 1300 px.
// It uses the DOM only. The known list (scripts/design/layout.known.json) is empty and only shrinks.
const SCREENS: { name: string; path: string; ready: string }[] = [
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
  { name: 'settings audit log', path: '/settings/audit', ready: 'Settings' },
  { name: 'settings config export', path: '/settings/export', ready: 'Settings' },
];

for (const screen of SCREENS) {
  test(`layout: ${screen.name}`, async ({ page }) => {
    await signedIn()
      .on('GET', '/api/v1/audit', {
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
      })
      .install(page);
    await page.goto(screen.path);
    await expect(
      page.getByRole('heading', { level: 1, name: screen.ready }),
    ).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectDomLayout(page, screen.name, { spaceVar: '--ds-space-' });
  });
}
