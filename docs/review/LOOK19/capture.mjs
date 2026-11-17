// LOOK19 capture: real console (vite dev server), mocked API (e2e fixtures), Phosphor dark.
// Usage: node docs/review/LOOK19/capture.mjs <label> <outDir> [baseUrl]
import { chromium } from '@playwright/test';
import { signedIn, runner } from '../../../e2e/tests/web-console/fixtures.ts';
import { jobsAndDoctor } from '../../../e2e/tests/web-console/jobs-doctor-fixtures.ts';

const [label, outDir, base = 'http://127.0.0.1:5199'] = process.argv.slice(2);
export const ERROR =
  'x failed  reset folder owner and access (set owner crsp-crsp-light-9433): icacls exited 1332: No mapping between account names and security IDs was done. Successfully processed 0 files; Failed processing 0 files. Cleaned up: account crsp-crsp-light-9433, folder C:\\ProgramData\\crsp\\runners\\crsp-light-comics-organizer-windows';
const mock = jobsAndDoctor(signedIn()).on('GET', '/api/v1/runners', {
  items: [
    runner({
      id: 'r9', name: 'crsp-light-comics-organizer-windows', machine_id: 'm2', machine_name: 'win-build-2',
      os: 'windows', arch: 'x64', backend: 'persistent', isolation: 'persistent', keeps_state: true,
      labels: ['self-hosted', 'windows', 'x64', 'crsp-light', 'comics-organizer'], state: 'failed',
      reason: ERROR, failed_reason: ERROR, created_at: '2026-11-16T09:00:00Z',
    }),
    runner({ id: 'r1', name: 'crsp-linux-1', state: 'idle', created_at: '2026-11-10T09:00:00Z' }),
    runner({ id: 'r2', name: 'crsp-lx-2', isolation: 'container', backend: 'docker', keeps_state: false,
      labels: ['linux', 'x64'], state: 'busy', created_at: '2026-11-12T09:00:00Z',
      current_job: { id: 9, repository: 'octo/app', run_id: 1, run_attempt: 1, github_job_id: 1, job_name: 'e2e', labels: [], state: 'running', started_at: '2026-11-17T08:00:00Z' } }),
  ],
});
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
for (const [w, h, tag] of [[1300, 1500, '1300'], [1800, 1500, '1800'], [393, 2200, '393']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await ctx.addInitScript(() => {
    localStorage.setItem('crsp.theme-name', 'phosphor');
    localStorage.setItem('crsp.theme-mode', 'dark');
  });
  const page = await ctx.newPage();
  await mock.install(page);
  await page.goto(`${base}/runners`);
  await page.getByRole('heading', { level: 1, name: 'Runners' }).waitFor();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${outDir}/${label}-${tag}.png`, fullPage: false });
  const m = await page.evaluate(() => ({
    hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    rowH: [...document.querySelectorAll('tbody tr')].map((r) => Math.round(r.getBoundingClientRect().height)),
  }));
  console.log(label, tag, JSON.stringify(m));
  const open = process.env.OPEN; // a button to press for a second shot (option A: Details)
  if (open) {
    await page.getByRole('button', { name: open }).first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outDir}/${label}-${tag}-open.png` });
  }
  await ctx.close();
}
await b.close();
