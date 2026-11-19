// CRSP164 (design system UX-4, UX-12, UX-15, UX-16, UX-17, UX-49; look Option B): every route of the console, at
// 360, 393 and 1300 px, in the dark and the light mode, passes the layout checks and the new DOM checks. The routes
// come from routes.ts, so a new screen is covered without editing this file. A case that today's main fails is a
// test.fixme naming its owner in ux-fixme.ts; there is no known list to add to.
import { expect, test } from '@playwright/test';
import { judgeLayout, measureDomLayout } from '../../../scripts/design/dom-layout';
import { consoleRoutes, NOT_FOUND_URL } from './routes';
import { fixmeFor } from './ux-fixme';
import {
  MODES,
  measureEverywhere,
  openRoute,
  type Measure,
  type ScreenState,
} from './ux-guards';

// A tab is a state of a route, not a route of its own: the Registry tab (REG5) is checked like a screen.
const TABS = [
  {
    pattern: '/pool/images?tab=registry',
    url: '/pool/images?tab=registry',
    signedOut: false,
  },
];

const routes = [
  ...consoleRoutes(),
  ...TABS,
  { pattern: 'not found', url: NOT_FOUND_URL, signedOut: false },
];

const CHECKS: { id: Measure; states: ScreenState[] }[] = [
  { id: 'touch', states: ['data'] },
  { id: 'primary', states: ['data'] },
  { id: 'h1', states: ['data', 'empty', 'failed'] },
  { id: 'selectAll', states: ['data'] },
  { id: 'navScroll', states: ['data'] },
  { id: 'noScrollbar', states: ['data'] },
  { id: 'pane', states: ['data'] },
  { id: 'frameEdges', states: ['data'] },
  { id: 'pageEdges', states: ['data'] },
  { id: 'navBox', states: ['data'] },
  { id: 'tableHead', states: ['data'] },
  { id: 'paneButtons', states: ['data'] },
  { id: 'titleOverlap', states: ['data'] },
  { id: 'hintKeys', states: ['data'] },
];

for (const route of routes) {
  test(`ux layout: ${route.pattern}`, async ({ page }) => {
    const why = fixmeFor('layout', route.pattern, 'data');
    test.fixme(why !== undefined, why ?? '');
    const found: string[] = [];
    for (const mode of MODES) {
      await openRoute(page, route, { mode });
      const problems = await measureDomLayout(page, {
        known: [],
        spaceVar: '--ds-space-',
        ready: async () => {
          await page.waitForTimeout(30);
        },
      });
      const { unknown } = judgeLayout(`${route.pattern} ${mode}`, problems, []);
      found.push(...unknown);
    }
    expect(found).toEqual([]);
  });

  for (const check of CHECKS) {
    for (const state of check.states) {
      test(`ux ${check.id}: ${route.pattern} (${state})`, async ({ page }) => {
        const why = fixmeFor(check.id, route.pattern, state);
        test.fixme(why !== undefined, why ?? '');
        expect(await measureEverywhere(page, route, check.id, state)).toEqual([]);
      });
    }
  }
}
