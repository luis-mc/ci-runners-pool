import { expect, test } from '@playwright/test';
import { expectDomLayout } from '../../scripts/design/dom-layout';
import { signedIn } from './web-console/fixtures';
import { jobsAndDoctor } from './web-console/jobs-doctor-fixtures';

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
  { name: 'jobs', path: '/jobs', ready: 'Jobs' },
  { name: 'job detail', path: '/jobs/2', ready: 'test-2' },
  { name: 'doctor', path: '/doctor', ready: 'Doctor' },
  { name: 'add runners', path: '/runners/add', ready: 'Add runners' },
  { name: 'images', path: '/images', ready: 'Images and caches' },
  { name: 'caches', path: '/images?tab=caches', ready: 'Images and caches' },
  { name: 'settings users', path: '/settings/users', ready: 'Settings' },
  { name: 'settings appearance', path: '/settings/appearance', ready: 'Settings' },
  { name: 'settings retention', path: '/settings/retention', ready: 'Settings' },
];

for (const screen of SCREENS) {
  test(`layout: ${screen.name}`, async ({ page }) => {
    await jobsAndDoctor(signedIn()).install(page);
    await page.goto(screen.path);
    await expect(
      page.getByRole('heading', { level: 1, name: screen.ready }),
    ).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectDomLayout(page, screen.name, { spaceVar: '--ds-space-' });
  });
}
