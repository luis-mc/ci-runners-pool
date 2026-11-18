// LOOK19 capture: the real console (vite dev server), the mocked API (e2e fixtures), Phosphor dark.
// Usage: node docs/review/LOOK19/capture.mjs <outDir> [baseUrl]   (start `pnpm --dir apps/web exec vite --port 5199` first)
import { chromium } from '@playwright/test';
import { signedIn, runner } from '../../../e2e/tests/web-console/fixtures.ts';
import {
  jobsAndDoctor,
  finding,
  queuedJob,
} from '../../../e2e/tests/web-console/jobs-doctor-fixtures.ts';

const [outDir, base = 'http://127.0.0.1:5199'] = process.argv.slice(2);
const ERROR =
  'x failed  reset folder owner and access (set owner crsp-crsp-light-9433): icacls exited 1332: No mapping between account names and security IDs was done. Successfully processed 0 files; Failed processing 0 files. Cleaned up: account crsp-crsp-light-9433, folder C:\\ProgramData\\crsp\\runners\\crsp-light-comics-organizer-windows';
const mock = jobsAndDoctor(signedIn())
  .on('GET', '/api/v1/runners', {
    items: [
      runner({
        id: 'r9', name: 'crsp-light-comics-organizer-windows', machine_id: 'm2', machine_name: 'win-build-2',
        os: 'windows', arch: 'x64', backend: 'persistent', isolation: 'persistent', keeps_state: true,
        labels: ['self-hosted', 'windows', 'x64', 'crsp-light', 'comics-organizer'], state: 'failed',
        reason: ERROR, failed_reason: ERROR, created_at: '2026-11-16T09:00:00Z',
      }),
      runner({ id: 'r1', name: 'crsp-linux-1', state: 'idle', created_at: '2026-11-10T09:00:00Z' }),
    ],
  })
  .on('GET', '/api/v1/doctor/findings', {
    items: [
      finding({
        detail:
          '.github/workflows/ci.yml:12 needs [self-hosted, linux, arm64] but the pool has no online runner with the label arm64: add a runner on an arm64 machine, or change runs-on in the workflow',
      }),
      finding({ check: 'machine.online', severity: 'warn', title: 'build-2 is offline', detail: undefined,
        subject: { kind: 'machine', id: 'm2', name: 'build-2' }, fix: { text: 'Start the agent.', command: 'crsp agent start' } }),
    ],
    last_run_at: '2026-11-14T10:00:12Z',
  })
  .on('GET', '/api/v1/jobs', (call) =>
    call.query.get('state') === 'queued'
      ? { items: [{ ...queuedJob, wait_text: 'waits for a free slot on any Linux machine that carries the labels self-hosted, linux and arm64, none is free now' }], stale: { stale: false } }
      : { items: [], stale: { stale: false } },
  );
const screens = [
  ['runners', '/pool/runners', { level: 1, name: 'Runners' }, 'Full error'],
  ['doctor', '/doctor', { level: 1, name: 'Doctor' }, 'Details'],
  ['jobs', '/jobs', { level: 1, name: 'Jobs' }, 'Details'],
];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
for (const [w, h, tag] of [[1300, 900, '1300'], [393, 1500, '393']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: 'dark' });
  await ctx.addInitScript(() => {
    localStorage.setItem('crsp.theme-name', 'phosphor');
    localStorage.setItem('crsp.theme-mode', 'dark');
  });
  const page = await ctx.newPage();
  await mock.install(page);
  for (const [name, path, heading, button] of screens) {
    await page.goto(`${base}${path}`);
    await page.getByRole('heading', heading).first().waitFor();
    await page.waitForLoadState('networkidle');
    const hs = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    await page.screenshot({ path: `${outDir}/${name}-${tag}.png` });
    const closed = await hs();
    await page.getByRole('button', { name: button }).first().click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${outDir}/${name}-${tag}-open.png` });
    console.log(name, tag, 'hscroll closed/open', closed, await hs());
  }
  await ctx.close();
}
await b.close();
