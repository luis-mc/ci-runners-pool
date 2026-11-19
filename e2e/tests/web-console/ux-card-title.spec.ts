// OPS48 (UX-10, UX-51): the title of a Card never covers the title of the Section it sits in. Overview is opened in
// each of the six themes, dark and light, at 360, 393 and 1300 px; the bounding boxes of the two titles must not meet.
// Every other route is covered by the `titleOverlap` check of ux-routes.spec.ts.
import { expect, test } from '@playwright/test';
import { measure, MODES, openRoute } from './ux-guards';

const THEMES = ['phosphor', 'tokyo-night', 'catppuccin', 'gruvbox', 'solarized', 'nord'];
const overview = { pattern: '/', url: '/', signedOut: false };

for (const themeName of THEMES) {
  test(`card title clears its section title: Overview in ${themeName}`, async ({
    page,
  }) => {
    const found: string[] = [];
    for (const mode of MODES) {
      for (const width of [360, 393, 1300]) {
        await openRoute(page, overview, { mode, themeName, width });
        // Overview must hold a titled card in a titled section, or the guard proves nothing.
        expect(
          await page.locator('.ds-card-grid .ds-pane__title').count(),
        ).toBeGreaterThan(0);
        for (const line of await measure(page, 'titleOverlap'))
          found.push(`${themeName} ${mode} ${width}px: ${line}`);
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      }
    }
    expect(found).toEqual([]);
  });
}
