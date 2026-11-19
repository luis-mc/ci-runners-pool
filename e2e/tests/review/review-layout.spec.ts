import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectDomLayout } from '../../../scripts/design/dom-layout';
import {
  OTHER_AREAS,
  THEMES,
  hasApp,
  reviewScreens,
  serveApp,
} from './review-app';

// The review build (RES19) at 360, 393 and 1300 px, dark and light, with the shared DOM layout checker. The
// review build holds fake data and lives in docs/review/RES19/app; it is served here by a small static server.
// The known list stays untouched: a breach is fixed, never listed.
test.skip(
  !hasApp(),
  'docs/review/RES19/app is not built (pnpm --filter web build:review)',
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

// UX-72: table rows of the Images and caches screens are one line, rows of a table have one height, a button in a table does
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

const ROW_SCREENS = reviewScreens();

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

// UX-16, UX-49: no page of the section scrolls sideways at 360, 393 and 1300 px, and nothing with its own scroll box
// is wider than it shows.
const SIDEWAYS = `(() => {
  const out = [];
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    out.push('the page scrolls sideways: ' + document.documentElement.scrollWidth + ' px in ' + document.documentElement.clientWidth + ' px');
  document.querySelectorAll('*').forEach((e) => {
    const o = getComputedStyle(e).overflowX;
    if ((o === 'auto' || o === 'scroll') && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0)
      out.push('<' + e.tagName + ' class=' + e.getAttribute('class') + '> scrolls sideways');
  });
  return out;
})()`;

for (const width of [360, 393, 1300]) {
  for (const s of reviewScreens()) {
    test(`${s.name} has no sideways scroll at ${width} px`, async ({ page }) => {
      await open(page, s.hash, 'phosphor', 'dark');
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      expect(await page.evaluate<string[]>(SIDEWAYS)).toEqual([]);
    });
  }
}

// UX-5, UX-30, UX-54: in every state of a wizard the steps stand as the part draws them. Later steps are greyed and
// cannot be pressed. Stop is there while the work runs. The primary says it is busy while it runs. Done shows the
// result. A button that starts work is disabled while it runs (UX-13).
const WIZARD_SCREENS = reviewScreens().filter((s) => s.phase !== undefined);

for (const s of WIZARD_SCREENS) {
  test(`wizard state ${s.name}: steps, Stop, busy and Done`, async ({ page }) => {
    await open(page, s.hash, 'phosphor', 'dark');
    const phase = s.phase ?? '';
    const wizard = page.locator('.ds-wizard');
    await expect(wizard).toHaveAttribute('data-phase', phase);
    const later = wizard.locator('.ds-steps__item[data-standing="later"] button');
    for (let i = 0; i < (await later.count()); i++) await expect(later.nth(i)).toBeDisabled();
    const stop = wizard.getByRole('button', { name: /^Stop/ });
    if (phase === 'running') await expect(stop).toBeVisible();
    else await expect(stop).toHaveCount(0);
    if (phase === 'running') {
      await expect(wizard.locator('[aria-busy="true"], [data-busy="true"]').first()).toBeVisible();
      await expect(wizard.locator('.ds-steps__item[data-standing="done"] button:not([disabled])')).toHaveCount(0);
    }
    if (phase === 'done' || phase === 'done-after-reload') {
      await expect(wizard.locator('.ds-message[data-tone="done"]')).toBeVisible();
      await expect(wizard.getByRole('button', { name: /Start again|Open/ }).first()).toBeVisible();
    }
    if (phase === 'ready-to-review') await expect(wizard.getByText('Nothing has changed yet.')).toBeVisible();
    if (phase === 'failed') await expect(wizard.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
}

// The build state of the screen is in words, never a colour only (UX-58).
test('every status shows a word', async ({ page }) => {
  for (const s of reviewScreens().slice(0, 8)) {
    await open(page, s.hash, 'phosphor', 'dark');
    const empty = await page.locator('.ds-status .ds-status__word:empty').count();
    expect(empty).toBe(0);
  }
});
