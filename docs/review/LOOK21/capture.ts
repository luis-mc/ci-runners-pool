// LOOK21, LOOK22, LOOK16: real-app screenshots with the mocked API of the e2e fixtures (Phosphor, dark).
//   (cd apps/web && pnpm exec vite --port 5199) ; CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node docs/review/LOOK21/capture.ts
import { chromium, type Page } from '@playwright/test';
import { machine, repository, signedIn } from '../../../e2e/tests/web-console/fixtures.ts';

const base = process.env.BASE ?? 'http://127.0.0.1:5199';
const out = new URL('./', import.meta.url).pathname;
const SIZES = { desktop: { width: 1300, height: 800 }, phone: { width: 393, height: 852 } };

const check = (mem: number, cpus: number) => {
  const base = {
    known: true, ok: true, needs_shrink_confirm: false, nearest: [] as string[],
    total_gib: 31.7, used_outside_gib: 16.4, memory_budget_gib: 26.9, room_gib: 10.5, cpu_budget: 19,
    decided: 'fits', current_memory_gib: 4, current_cpus: 2,
    recommended_half: { memory_gib: 5, cpus: 3 }, recommended_three_quarters: { memory_gib: 7, cpus: 4 },
  };
  if (mem > 10.5)
    return { ...base, ok: false, short: 'memory', decided: 'memory budget',
      reason: `${mem} GiB is above the memory room`, nearest: ['10 GiB fits 6 CPUs'] };
  return base;
};

function mock() {
  let repo = repository({ pool_on: true });
  const m = machine({ settings: { ...machine().settings, pool_memory_gib: 4, pool_cpus: 2 } });
  return signedIn()
    .on('GET', '/api/v1/repositories/:id', () => repo)
    .on('GET', '/api/v1/github/repositories', () => ({ items: [repo], stale: { stale: false } }))
    .on('PATCH', '/api/v1/repositories/:id/policy', (c: { body: Record<string, unknown> }) => {
      repo = { ...repo, policy: { ...repo.policy, ...c.body } };
      return repo.policy;
    })
    .on('GET', '/api/v1/machines/:id', () => m)
    .on('PATCH', '/api/v1/machines/:id', () => m)
    .on('POST', '/api/v1/machines/:id/pool-size-check',
      (c: { body: { pool_memory_gib: number; pool_cpus: number } }) =>
        check(c.body.pool_memory_gib, c.body.pool_cpus));
}

async function setNumber(p: Page, label: string, digits: string) {
  await p.getByRole('button', { name: new RegExp(label) }).click();
  const dialog = p.getByRole('dialog');
  for (const d of digits) await dialog.getByRole('button', { name: d === '.' ? '.' : d, exact: true }).click();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
}
const choose = async (p: Page, name: RegExp) => {
  await p.waitForFunction((src) => {
    const r = [...document.querySelectorAll<HTMLInputElement>('input[type=radio]')]
      .find((e) => new RegExp(src).test(e.closest('label')?.textContent ?? ''));
    return r && !r.disabled;
  }, name.source);
  await p.getByRole('radio', { name }).click();
};

interface Shot { id: string; path: string; ready: string; anchor: string; steps: [string, (p: Page) => Promise<void>][]; leave?: boolean }
const SHOTS: Shot[] = [
  { id: 'repository', path: '/repositories/octo/app', ready: 'octo/app', anchor: 'Policy', leave: true,
    steps: [['clean', async () => {}], ['changed', async (p) => {
      await p.getByLabel('Labels', { exact: true }).fill('self-hosted, linux, gpu');
      await setNumber(p, 'Maximum parallel jobs', '6');
    }]] },
  { id: 'settings-console', path: '/settings/console', ready: 'Settings', anchor: 'Appearance',
    steps: [['spacing', async () => {}]] },
  { id: 'pool-size', path: '/pool/machines/m1', ready: 'build-1', anchor: 'Pool size',
    steps: [
      ['clean', async () => {}],
      ['half', async (p) => { await choose(p, /half of the free room/); await p.getByText(/This size fits/).waitFor(); }],
      ['three-quarters', async (p) => { await choose(p, /three quarters/); await p.getByText(/This size fits/).waitFor(); }],
      ['custom-warning', async (p) => { await choose(p, /Custom/); await setNumber(p, 'Pool memory', '9'); await p.getByText(/leaves/).waitFor(); }],
      ['too-much', async (p) => { await setNumber(p, 'Pool memory', '12'); await p.getByText(/is too much/).waitFor(); }],
    ] },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
for (const s of SHOTS)
  for (const [size, vp] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await mock().install(page);
    await page.addInitScript(() => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
      localStorage.setItem('crsp.theme-name', 'phosphor');
      localStorage.setItem('crsp.theme-mode', 'dark');
    });
    await page.goto(`${base}${s.path}`);
    await page.getByRole('heading', { level: 1, name: s.ready }).waitFor();
    await page.getByText(s.anchor, { exact: true }).first().waitFor();
    await page.waitForLoadState('networkidle');
    for (const [name, step] of s.steps) {
      await step(page);
      await page.waitForTimeout(500);
      await page.evaluate((a) => {
        [...document.querySelectorAll('h2,h3')].find((e) => e.textContent?.trim() === a)?.scrollIntoView({ block: 'start' });
      }, s.anchor);
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}${s.id}-${name}-${size}.png` });
    }
    if (s.leave && size === 'desktop') {
      await page.getByRole('link', { name: /Shared Pool/ }).first().click();
      await page.getByRole('dialog', { name: 'Discard changes?' }).waitFor();
      await page.screenshot({ path: `${out}${s.id}-leave-${size}.png` });
    }
    await ctx.close();
  }
await browser.close();
