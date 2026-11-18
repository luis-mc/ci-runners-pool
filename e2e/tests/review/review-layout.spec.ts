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

interface Breach {
  table: string;
  what: string;
}

async function rowBreaches(page: Page, allowed: string[]): Promise<Breach[]> {
  return page.evaluate((labels) => {
    const px = (v: string) => {
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${v}`;
      document.body.append(probe);
      const n = probe.getBoundingClientRect().width;
      probe.remove();
      return n;
    };
    // One line plus padding: the control height and the cell padding above and below (and the 1 px line).
    const oneLine = px('var(--ds-control-height)') + 2 * px('var(--ds-space-3)') + 2;
    const control = px('var(--ds-control-height)') + 1;
    const out: { table: string; what: string }[] = [];
    document.querySelectorAll<HTMLTableElement>('table.ds-table').forEach((t, n) => {
      if (!t.getClientRects().length || t.closest('.ds-table__expanded')) return;
      const name = `${t.querySelector('caption')?.textContent ?? 'table'} #${n}`;
      const rows = [...(t.tBodies[0]?.rows ?? [])].filter(
        (r) => !r.classList.contains('ds-table__expanded'),
      );
      const heights = rows.map((r) => Math.round(r.getBoundingClientRect().height));
      const tall = Math.max(0, ...heights);
      if (tall > oneLine)
        out.push({ table: name, what: `a row is ${tall} px, more than one line (${oneLine} px)` });
      if (new Set(heights).size > 1)
        out.push({ table: name, what: `rows differ in height: ${[...new Set(heights)].join(', ')} px` });
      t.querySelectorAll<HTMLElement>('tbody .ds-button, tbody a[data-button]').forEach((b) => {
        const label = (b.textContent ?? '').trim();
        const h = b.getBoundingClientRect().height;
        if (h > control) out.push({ table: name, what: `button "${label}" wraps (${Math.round(h)} px)` });
        if (!labels.includes(label))
          out.push({ table: name, what: `button "${label}" is not a word of Row action words` });
      });
    });
    return out;
  }, allowed);
}

const ROW_SCREENS = reviewScreens().filter(
  (s) => /^jobs-/.test(s.name) && !s.expand && s.name !== 'jobs-charts',
);

for (const s of ROW_SCREENS) {
  test(`rows of ${s.name} are one line with one set of words`, async ({ page }) => {
    await open(page, s.hash, 'phosphor', 'dark');
    expect(await rowBreaches(page, [...allowedLabels()])).toEqual([]);
  });
}

for (const s of ROW_SCREENS) {
  test(`cards of ${s.name} at 393 px have the action in the same place`, async ({ page }) => {
    await open(page, s.hash, 'phosphor', 'dark');
    await page.setViewportSize({ width: 393, height: 852 });
    await page.waitForTimeout(150);
    const spots = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLTableElement>('table.ds-table')]
        .filter((t) => t.getClientRects().length)
        .map((t) => {
          const rows = [...(t.tBodies[0]?.rows ?? [])].filter(
            (r) => !r.classList.contains('ds-table__expanded'),
          );
          const seen = new Set<string>();
          for (const r of rows) {
            const b = r.querySelector<HTMLElement>('.ds-button');
            if (!b) continue;
            const rr = r.getBoundingClientRect();
            const br = b.getBoundingClientRect();
            seen.add(
              `${Math.round(br.left - rr.left)}/${Math.round(rr.bottom - br.bottom)}/${Math.round(br.width)}`,
            );
          }
          return [...seen];
        }),
    );
    for (const seen of spots) expect(seen.length).toBeLessThanOrEqual(1);
  });
}
