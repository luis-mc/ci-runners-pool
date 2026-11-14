// R6.13: the console keeps working when the internet is down. Every request that is not to the controller origin
// is blocked; every screen still renders and nothing external was requested (also R6.3).
import { expect, test } from '@playwright/test';
import { failure, signedIn } from './fixtures';
import { jobsAndDoctor } from './jobs-doctor-fixtures';
import { consoleRoutes, NOT_FOUND_URL } from './routes';

const screens = [
  ...consoleRoutes().map((r) => ({
    name: r.pattern,
    url: r.url,
    signedOut: r.signedOut,
  })),
  { name: 'not found', url: NOT_FOUND_URL, signedOut: false },
];

for (const screen of screens) {
  test(`offline: ${screen.name}`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? '').origin;
    const external: string[] = [];
    // Registered first, so the mock's routes (registered later) win for the controller's own /api/v1.
    await page.route(
      (url) =>
        url.origin !== origin && url.protocol !== 'data:' && url.protocol !== 'blob:',
      (route) => {
        external.push(route.request().url());
        return route.abort('internetdisconnected');
      },
    );
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.origin !== origin && u.protocol !== 'data:' && u.protocol !== 'blob:')
        external.push(req.url());
    });
    const mock = jobsAndDoctor(signedIn());
    if (screen.signedOut)
      mock.on('GET', '/api/v1/me', failure(401, 'unauthenticated', 'Sign in.'));
    await mock.install(page);
    await page.goto(screen.url);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect([...new Set(external)]).toEqual([]);
  });
}
