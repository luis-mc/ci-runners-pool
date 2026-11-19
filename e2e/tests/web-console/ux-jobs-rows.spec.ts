// UX-72 (OPS34, RES17): table rows of the Jobs screens are one line high on desktop, the rows of one table have one
// height, a button in a table does not wrap, and a row action uses only the words of the Row action words table in
// content.md (Open run, Open, Open job). At phone width the action of every card sits in the same place. The guard
// runs over every Jobs list the console has, with the mocked Jobs API; a breach is fixed, never listed.
import { expect, test } from '@playwright/test';
import { openRoute } from './ux-guards';
import { rowActionWords } from './ux-measure-source';

const SCREENS = [
  { name: 'Queue', url: '/jobs' },
  { name: 'Queue, jobs', url: '/jobs?view=jobs' },
  { name: 'Running', url: '/jobs/running' },
  { name: 'Running, jobs', url: '/jobs/running?view=jobs' },
  { name: 'Done', url: '/jobs/done' },
  { name: 'Done, jobs', url: '/jobs/done?view=jobs' },
  { name: 'By repository', url: '/jobs/repository' },
  { name: 'By machine', url: '/jobs/machine' },
  { name: 'By runner', url: '/jobs/runner' },
  { name: 'By runner type', url: '/jobs/runner-type' },
  { name: 'By job type', url: '/jobs/job-type' },
];

/** Runs in the page: the breaches of UX-72 in every visible table, as `{ table, what }`. */
const ROW_SOURCE = (labels: string[]) => `(() => {
  const labels = ${JSON.stringify(labels)};
  const px = (v) => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;inline-size:' + v;
    document.body.append(probe);
    const n = probe.getBoundingClientRect().width;
    probe.remove();
    return n;
  };
  // One line plus padding: the control height, the cell padding above and below, and the 1 px line.
  const control = px('var(--ds-control-height)');
  const oneLine = control + 2 * px('var(--ds-space-3)') + 2;
  const out = new Set();
  document.querySelectorAll('table.ds-table').forEach((t, n) => {
    if (!t.getClientRects().length || t.closest('.ds-table__expanded')) return;
    const cap = t.querySelector('caption');
    const name = (cap ? cap.textContent : 'table') + ' #' + n;
    const rows = [...(t.tBodies[0] ? t.tBodies[0].rows : [])].filter((r) => !r.classList.contains('ds-table__expanded'));
    const heights = rows.map((r) => Math.round(r.getBoundingClientRect().height));
    const tall = Math.max(0, ...heights);
    if (tall > oneLine) out.add(name + ': a row is ' + tall + ' px high, more than one line (' + oneLine + ' px)');
    if (new Set(heights).size > 1) out.add(name + ': rows differ in height: ' + [...new Set(heights)].join(', ') + ' px');
    // RES18: a table needs no sideways scroll, and a fit cell is never cut (its text is whole).
    const frame = t.closest('.ds-table-frame') || t.parentElement;
    const box = t.closest('.ds-pane') || document.documentElement;
    const room = box === document.documentElement ? box.clientWidth : box.getBoundingClientRect().right;
    if (t.getBoundingClientRect().right > room + 1 || frame.scrollWidth > frame.clientWidth + 1)
      out.add(name + ': the table needs sideways scroll (it ends at ' + Math.round(t.getBoundingClientRect().right) + ' px, its pane at ' + Math.round(room) + ' px)');
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
      out.add(name + ': the page scrolls sideways');
    t.querySelectorAll('tbody td[data-kind="fit"], thead th[data-kind="fit"]').forEach((c) => {
      const cut = [c, ...c.querySelectorAll('*')].find((e) => getComputedStyle(e).overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0);
      if (cut) out.add(name + ': a fit cell is cut: "' + (c.textContent || '').trim() + '" in <' + cut.tagName + ' class=' + cut.getAttribute('class') + '> (' + cut.scrollWidth + ' px in ' + cut.clientWidth + ' px)');
    });
    t.querySelectorAll('thead th').forEach((th) => {
      const h = th.getBoundingClientRect().height;
      if (h > oneLine) out.add(name + ': the head "' + (th.textContent || '').trim() + '" wraps (' + Math.round(h) + ' px high)');
    });
    t.querySelectorAll('tbody .ds-button, tbody a[data-button]').forEach((b) => {
      const label = (b.textContent || '').trim();
      const h = b.getBoundingClientRect().height;
      if (h > control + 1) out.add(name + ': the button "' + label + '" wraps (' + Math.round(h) + ' px high)');
      if (!labels.includes(label)) out.add(name + ': the button "' + label + '" is not a word of Row action words');
    });
  });
  return [...out];
})()`;

/** Runs in the page at phone width: where the button of each card sits, per table. */
const CARD_SOURCE = `(() => [...document.querySelectorAll('table.ds-table')]
  .filter((t) => t.getClientRects().length)
  .map((t) => {
    const rows = [...(t.tBodies[0] ? t.tBodies[0].rows : [])].filter((r) => !r.classList.contains('ds-table__expanded'));
    const seen = new Set();
    for (const r of rows) {
      const b = r.querySelector('.ds-table__action .ds-button');
      if (!b) continue;
      const rr = r.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      seen.add(Math.round(br.left - rr.left) + '/' + Math.round(rr.bottom - br.bottom) + '/' + Math.round(br.width));
    }
    return [...seen];
  }))()`;

/** Runs in the page: where a Repository or Workflow column is narrower than the Branch column of its table (D102). */
const WEIGHT_SOURCE = `(() => {
  const out = [];
  document.querySelectorAll('table.ds-table').forEach((t, n) => {
    if (!t.getClientRects().length || t.closest('.ds-table__expanded')) return;
    const width = (text) => {
      const th = [...t.querySelectorAll('thead th')].find((h) => (h.textContent || '').trim() === text);
      return th ? th.getBoundingClientRect().width : 0;
    };
    const branch = width('Branch');
    if (!branch) return;
    for (const head of ['Repository', 'Workflow', 'Workflow and job']) {
      const w = width(head);
      if (w && w < branch - 1) out.push('table #' + n + ': ' + head + ' (' + Math.round(w) + ' px) is narrower than Branch (' + Math.round(branch) + ' px)');
    }
  });
  return out;
})()`;

for (const s of SCREENS) {
  test(`rows of ${s.name} are one line with one set of words`, async ({ page }) => {
    await openRoute(page, { url: s.url, signedOut: false }, { width: 1300 });
    expect(await page.evaluate<string[]>(ROW_SOURCE([...rowActionWords()]))).toEqual([]);
  });

  test(`rows of ${s.name} at 1220 px have no fit cell cut and no sideways scroll`, async ({
    page,
  }) => {
    await openRoute(page, { url: s.url, signedOut: false }, { width: 1220 });
    expect(await page.evaluate<string[]>(ROW_SOURCE([...rowActionWords()]))).toEqual([]);
  });

  for (const width of [1300, 1220]) {
    test(`Repository and Workflow of ${s.name} at ${width} px are not narrower than Branch`, async ({
      page,
    }) => {
      await openRoute(page, { url: s.url, signedOut: false }, { width });
      expect(await page.evaluate<string[]>(WEIGHT_SOURCE)).toEqual([]);
    });
  }

  test(`cards of ${s.name} at 393 px have the action in the same place`, async ({
    page,
  }) => {
    await openRoute(page, { url: s.url, signedOut: false }, { width: 393 });
    const spots = await page.evaluate<string[][]>(CARD_SOURCE);
    for (const seen of spots) expect(seen.length).toBeLessThanOrEqual(1);
  });
}

test('Open run lands on the Run page and the page does not scroll sideways at 1300 px', async ({
  page,
}) => {
  await openRoute(page, { url: '/jobs/done', signedOut: false }, { width: 1300 });
  await page
    .getByRole('button', { name: /^Open run/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/jobs\/run\/\d+\?attempt=\d+/);
  await expect(page.getByRole('region', { name: 'Job graph' })).toBeVisible();
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(wide).toBe(false);
});
