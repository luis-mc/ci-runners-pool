// UX-41, UX-72, UX-49 (OPS42): the run page has one Jobs table that the graph and the timeline point to; its rows are
// one line high on a desktop, and the page never scrolls sideways at phone and desktop width.
import { expect, test } from '@playwright/test';
import { RUN } from './run-page-fixture';
import { openRoute } from './ux-guards';

for (const width of [393, 1300]) {
  for (const mode of ['dark', 'light'] as const) {
    test(`run page at ${width} px, ${mode}: one Jobs table, no sideways scroll`, async ({
      page,
    }) => {
      const mock = await openRoute(
        page,
        { url: '/jobs/run/100', signedOut: false },
        { width, mode },
      );
      mock.on('GET', '/api/v1/runs/:id', RUN);
      await page.reload();
      await page.getByRole('heading', { name: 'Jobs', level: 2 }).waitFor();
      // one table for the jobs: the graph and the timeline fold none of their own
      await expect(page.locator('table.ds-table')).toHaveCount(1);
      await expect(page.getByText('Show as table')).toHaveCount(0);
      const described = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[aria-describedby]')).map((e) =>
          e.getAttribute('aria-describedby'),
        ),
      );
      expect(described).toEqual(['run-jobs-table', 'run-jobs-table']);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false);
      const frame = await page.evaluate(() => {
        const f = document.querySelector('.ds-table-frame');
        return f ? f.scrollWidth > f.clientWidth + 1 : false;
      });
      expect(frame).toBe(false);
      if (width >= 1300) {
        const heights = await page.evaluate(() => {
          const rows = Array.from(
            document.querySelectorAll<HTMLElement>('table.ds-table tbody tr'),
          );
          const button = document.querySelector('table.ds-table tbody .ds-button');
          return {
            button: button ? button.getBoundingClientRect().height : 0,
            heights: [
              ...new Set(rows.map((r) => Math.round(r.getBoundingClientRect().height))),
            ],
            count: rows.length,
          };
        });
        expect(heights.count).toBe(4);
        expect(heights.heights).toHaveLength(1); // one height for every row
        expect(heights.heights[0]).toBeLessThan(heights.button * 2); // and it is one line
      }
    });
  }
}
