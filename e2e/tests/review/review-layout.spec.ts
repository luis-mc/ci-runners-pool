import { expect, test, type Page } from '@playwright/test';
import { expectDomLayout } from '../../../scripts/design/dom-layout';
import { OTHER_AREAS, THEMES, hasApp, reviewScreens, serveApp } from './review-app';

// The review build (RES15) at 360, 393 and 1300 px, dark and light, with the shared DOM layout checker. The
// review build holds fake data and lives in docs/review/RES15/app; it is served here by a small static server.
// The known list stays untouched: a breach is fixed, never listed.
test.skip(
  !hasApp(),
  'docs/review/RES15/app is not built (pnpm --filter web build:review)',
);

let url = '';
let close: () => void = () => undefined;
test.beforeAll(async () => {
  const s = await serveApp();
  url = s.url;
  close = () => s.server.close();
});
test.afterAll(() => close());

async function open(page: Page, hash: string, theme: string, mode: string) {
  await page.addInitScript(
    ([t, m]) => {
      window.localStorage.setItem('crsp.theme-name', t as string);
      window.localStorage.setItem('crsp.theme-mode', m as string);
    },
    [theme, mode],
  );
  await page.setViewportSize({ width: 1300, height: 900 });
  await page.goto(`${url}?freeze${hash}`);
  await page.locator('h1').first().waitFor();
  await expect(page.locator('[data-state="loading"]')).toHaveCount(0, {
    timeout: 10_000,
  });
}

for (const t of THEMES) {
  for (const s of reviewScreens()) {
    test(`${s.name}, ${t.name}`, async ({ page }) => {
      await open(page, s.hash, t.theme, t.mode);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(s.h1);
      await expect(page.getByText('Review build with fake data')).toBeVisible();
      await expectDomLayout(page, `review ${s.name} (${t.name})`, {
        spaceVar: '--ds-space-',
        ready: async () => {
          await page.waitForTimeout(150);
        },
      });
    });
  }
}

for (const a of OTHER_AREAS) {
  test(`the ${a.name} area opens in the review build`, async ({ page }) => {
    await open(page, a.hash, 'phosphor', 'dark');
    await expect(page.getByText('Review build with fake data')).toBeVisible();
    await expect(page.locator('[data-state="failed"]')).toHaveCount(0);
  });
}
