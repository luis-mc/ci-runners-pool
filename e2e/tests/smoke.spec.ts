import { expect, test } from '@playwright/test';

// Runs against the built binary (see the webServer entry in playwright.config.ts).
test('console loads and reports a healthy controller', async ({ page, request }) => {
  const health = await request.get('/healthz');
  expect(health.status()).toBe(200);

  // The binary serves the embedded console. Whatever state the session is in, the page has one headline.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
