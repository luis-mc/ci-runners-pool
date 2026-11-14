// R6.6: every console screen, in the dark and the light theme, has no serious or critical axe violation, one h1,
// a main landmark and a visible focus. The screens come from the route table (routes.ts), so a new screen is covered
// without editing this file. No known-issues list: a violation is fixed.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { failure, signedIn } from './fixtures';
import { consoleRoutes, NOT_FOUND_URL } from './routes';

const screens = [
  ...consoleRoutes().map((r) => ({
    name: r.pattern,
    url: r.url,
    signedOut: r.signedOut,
  })),
  { name: 'not found', url: NOT_FOUND_URL, signedOut: false },
];

for (const theme of ['dark', 'light'] as const) {
  for (const screen of screens) {
    test(`a11y ${theme}: ${screen.name}`, async ({ page }) => {
      const mock = signedIn();
      mock.on('GET', '/api/v1/me/preferences', { theme });
      if (screen.signedOut)
        mock.on('GET', '/api/v1/me', failure(401, 'unauthenticated', 'Sign in.'));
      await mock.install(page);
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(screen.url);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      // Sign-in and first run have no stored theme: set it the way the appearance setting does (UX-60).
      await page.evaluate(
        (t) => document.documentElement.setAttribute('data-theme', t),
        theme,
      );
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      await expect(page.getByRole('main')).toHaveCount(1);

      const result = await new AxeBuilder({ page }).analyze();
      const bad = result.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        bad.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes
            .slice(0, 5)
            .map((n) => ({ html: n.html, why: n.failureSummary })),
        })),
      ).toEqual([]);

      // A visible focus: the first Tab lands on a control that draws an outline or a ring (UX-17, UX-59).
      // A screen with nothing to press (the first-run page when every step is done) has no focus to see.
      const tabbable = await page
        .locator(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        .count();
      if (tabbable === 0) return;
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return {
          tag: el.tagName,
          outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
          ring: s.boxShadow !== 'none',
        };
      });
      expect(focus, 'the first Tab must land on a control').not.toBeNull();
      expect(focus?.outline || focus?.ring, `focus ring on ${focus?.tag}`).toBe(true);
    });
  }
}
