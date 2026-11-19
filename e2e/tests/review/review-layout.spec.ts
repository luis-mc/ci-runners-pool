import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectDomLayout } from '../../../scripts/design/dom-layout';
import {
  OTHER_AREAS,
  THEMES,
  expandFirstRun,
  hasApp,
  reviewScreens,
  serveApp,
} from './review-app';

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
      if (s.expand) await expandFirstRun(page);
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

// UX-72: table rows of the Jobs screens are one line, rows of a table have one height, a button in a table does
// not wrap, and a row action uses only the words of the Row action words table in content.md.
function allowedLabels(): Set<string> {
  const text = readFileSync('docs/design-system/next-version/content.md', 'utf8');
  const at = text.indexOf('### Row action words');
  if (at < 0) throw new Error('content.md has no Row action words section');
  const words = new Set<string>();
  for (const line of text.slice(at).split('\n').slice(4)) {
    if (!line.startsWith('|')) break;
    for (const w of (line.split('|')[1] ?? '').split(',')) words.add(w.trim());
  }
  return words;
}

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

const ROW_SCREENS = reviewScreens().filter((s) => !s.expand);

for (const s of ROW_SCREENS) {
  test(`rows of ${s.name} at 1220 px are one line, no fit cell cut, no sideways scroll`, async ({
    page,
  }) => {
    await open(page, s.hash, 'phosphor', 'dark');
    await page.setViewportSize({ width: 1220, height: 900 });
    await page.waitForTimeout(150);
    expect(await page.evaluate<string[]>(ROW_SOURCE([...allowedLabels()]))).toEqual([]);
  });
}

for (const s of ROW_SCREENS) {
  test(`rows of ${s.name} are one line with one set of words`, async ({ page }) => {
    await open(page, s.hash, 'phosphor', 'dark');
    expect(await page.evaluate<string[]>(ROW_SOURCE([...allowedLabels()]))).toEqual([]);
  });
}

for (const s of ROW_SCREENS) {
  test(`cards of ${s.name} at 393 px have the action in the same place`, async ({
    page,
  }) => {
    await open(page, s.hash, 'phosphor', 'dark');
    await page.setViewportSize({ width: 393, height: 852 });
    await page.waitForTimeout(150);
    const spots = await page.evaluate<string[][]>(CARD_SOURCE);
    for (const seen of spots) expect(seen.length).toBeLessThanOrEqual(1);
  });
}
