// Screenshots of the review build (RES15): every screen at 1300 and 393 px, Phosphor dark and Phosphor light,
// with a frozen clock, into docs/review/RES15/shots/<screen>-<width>-<theme>.png. It is a spec only so that
// Playwright's runner compiles it; it does nothing unless REVIEW_SHOTS=1:
//
//   pnpm --filter web build:review
//   REVIEW_SHOTS=1 pnpm exec playwright test e2e/tests/review/shots.spec.ts -c <config with a Chromium>
import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  SHOTS_DIR,
  THEMES,
  expandFirstRun,
  hasApp,
  reviewScreens,
  serveApp,
} from './review-app';

const WIDTHS = [
  { width: 1300, height: 900 },
  { width: 393, height: 852 },
] as const;

test.skip(
  !process.env['REVIEW_SHOTS'] || !hasApp(),
  'set REVIEW_SHOTS=1 with a built review app',
);

test('screenshots of every review screen', async ({ browser }) => {
  test.setTimeout(600_000);
  mkdirSync(SHOTS_DIR, { recursive: true });
  const { url, server } = await serveApp();
  for (const theme of THEMES) {
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    await context.addInitScript(
      ([t, m]) => {
        window.localStorage.setItem('crsp.theme-name', t as string);
        window.localStorage.setItem('crsp.theme-mode', m as string);
      },
      [theme.theme, theme.mode],
    );
    for (const size of WIDTHS) {
      const page = await context.newPage();
      await page.setViewportSize(size);
      for (const s of reviewScreens()) {
        await page.goto(`${url}?freeze${s.hash}`);
        await page.reload();
        await page.locator('h1').first().waitFor();
        await page.waitForFunction(
          () => document.querySelectorAll('[data-state="loading"]').length === 0,
        );
        if (s.expand) await expandFirstRun(page);
        await page.waitForTimeout(250);
        await page.screenshot({
          path: join(SHOTS_DIR, `${s.name}-${size.width}-${theme.name}.png`),
          fullPage: true,
        });
      }
      await page.close();
    }
    await context.close();
  }
  server.close();
});
