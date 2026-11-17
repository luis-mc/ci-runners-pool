// LOOK21: real-app screenshots with a mocked API. Run with the prototype patch applied and the dev server up:
//   (cd apps/web && pnpm exec vite --port 5199) ; node docs/review/LOOK21/capture.ts
import { chromium, type Page } from '@playwright/test';
import { repository, signedIn } from '../../../e2e/tests/web-console/fixtures.ts';

const base = process.env.BASE ?? 'http://127.0.0.1:5199';
const out = new URL('./', import.meta.url).pathname;
const VARIANTS = ['base', 'a', 'b', 'c'] as const;
const SIZES = { desktop: { width: 1300, height: 800 }, phone: { width: 393, height: 852 } };

function mock() {
  let repo = repository({ pool_on: true });
  let pool = {
    budget_memory_pct: 80, budget_cpu_pct: 80, size_slots_from_machine: true,
    default_job_slots: 2, drain_timeout_minutes: 30,
  };
  let queue = {
    order: ['priority', 'event_class', 'fair_share', 'queued_at'],
    fair_share: true, no_runner_wait_minutes: 2,
  };
  return signedIn()
    .on('GET', '/api/v1/repositories/:id', () => repo)
    .on('GET', '/api/v1/github/repositories', () => ({ items: [repo], stale: { stale: false } }))
    .on('PATCH', '/api/v1/repositories/:id/policy', (c: { body: Record<string, unknown> }) => {
      repo = { ...repo, policy: { ...repo.policy, ...c.body } };
      return repo.policy;
    })
    .on('PUT', '/api/v1/repositories/:id/extra-packages', (c: { body: { text: string } }) => ({ text: c.body.text }))
    .on('GET', '/api/v1/settings/pool', () => pool)
    .on('GET', '/api/v1/settings/queue', () => queue)
    .on('PUT', '/api/v1/settings/pool', (c: { body: typeof pool }) => (pool = c.body))
    .on('PUT', '/api/v1/settings/queue', (c: { body: typeof queue }) => (queue = c.body));
}

async function setNumber(p: Page, label: string, digits: string) {
  await p.getByLabel(label, { exact: true }).click();
  const pad = p.getByRole('group').filter({ has: p.getByRole('button', { name: 'Clear' }) }).last();
  await pad.getByRole('button', { name: 'Clear', exact: true }).click();
  for (const d of digits) await pad.getByRole('button', { name: d, exact: true }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
}

interface Screen {
  id: string; path: string; ready: string; anchor: string;
  change: (p: Page) => Promise<void>;
}
const SCREENS: Screen[] = [
  {
    id: 'repository', path: '/repositories/octo/app', ready: 'octo/app', anchor: 'Policy',
    change: async (p) => {
      await p.getByLabel('Labels', { exact: true }).fill('self-hosted, linux, gpu');
      await setNumber(p, 'Maximum parallel jobs', '6');
      await p.getByRole('checkbox', { name: 'Keep a light runner for short jobs' }).uncheck();
    },
  },
  {
    id: 'settings-budgets', path: '/settings/repositories', ready: 'Settings', anchor: 'New machines',
    change: async (p) => {
      await setNumber(p, 'Memory budget', '60');
      await setNumber(p, 'Job slots', '4');
      await p.getByRole('checkbox', { name: 'Fair share' }).uncheck();
    },
  },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
for (const s of SCREENS)
  for (const v of VARIANTS)
    for (const [size, vp] of Object.entries(SIZES)) {
      if (size === 'phone' && false) continue;
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await mock().install(page);
      await page.addInitScript(() => localStorage.setItem('theme', 'phosphor'));
      await page.goto(`${base}${s.path}${v === 'base' ? '' : `?v=${v}`}`);
      await page.getByRole('heading', { level: 1, name: s.ready }).waitFor();
      await page.getByText(s.anchor, { exact: true }).first().waitFor();
      await page.waitForLoadState('networkidle');
      const top = async () => {
        await page.evaluate(
          ([a, bar]) => {
            // C: the top bar is the first thing of the form, so the form starts at the viewport top.
            const el = bar
              ? [...document.querySelectorAll('button')].find((e) => e.textContent?.trim() === 'Save')
              : [...document.querySelectorAll('h2,h3')].find((e) => e.textContent?.trim() === a);
            el?.scrollIntoView({ block: 'start' });
            if (bar) window.scrollBy(0, -16);
          },
          [s.anchor, v === 'c'] as const,
        );
        await page.waitForTimeout(200);
      };
      await top();
      await page.screenshot({ path: `${out}${s.id}-${v}-${size}-clean.png` });
      await s.change(page);
      await page.waitForTimeout(v === 'b' ? 3300 : 300);
      await top();
      await page.screenshot({ path: `${out}${s.id}-${v}-${size}-changed.png` });
      if (v === 'c' && size === 'desktop') {
        await page.getByRole('link', { name: /Machines/ }).first().click();
        await page.getByRole('dialog').waitFor();
        await page.screenshot({ path: `${out}${s.id}-c-${size}-leave.png` });
      }
      await ctx.close();
    }
await browser.close();
