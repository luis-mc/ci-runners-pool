import { expect, test } from '@playwright/test';

// Runs against the built binary (see the webServer entry in playwright.config.ts).
test('console loads and reports a healthy controller', async ({ page, request }) => {
  const health = await request.get('/healthz');
  expect(health.status()).toBe(200);

  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'CI Runners Shared Pool' }),
  ).toBeVisible();
  await expect(page.getByTestId('health')).toContainText('Controller is ok');

  // A client-side route falls back to the app shell.
  await page.goto('/some/route');
  await expect(
    page.getByRole('heading', { name: 'CI Runners Shared Pool' }),
  ).toBeVisible();
});
