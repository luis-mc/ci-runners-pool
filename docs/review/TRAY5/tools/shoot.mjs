// TRAY5 review harness: screenshots of the real web app (vite dev server) with the service API mocked.
// usage: node shoot.mjs <baseUrl> <optionId> <outDir> [widthxheight|auto]
// The window frame (title bar) is drawn later by the review page; these are the page contents only.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [base, opt, out, sizeArg = 'auto'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const iso = () => new Date().toISOString();
const base0 = {
  current_version: '0.1.11', latest_version: '0.1.12', update_available: true, state: 'idle',
  auto_update: false, drain_timeout_minutes: 60,
  running_jobs: [{ repository: 'octo/app', workflow: 'ci', run_id: 7, job: 'test' }],
};
const stage = (name, extra = {}) => ({ stage: { name, at: iso(), version: '0.1.12', ...extra } });
export const UPDATER = {
  'u1-offered': () => base0,
  'u2-downloading': () => ({ ...base0, state: 'downloading', ...stage('downloading', { percent: 42 }) }),
  'u3-waiting': () => ({ ...base0, state: 'waiting_for_jobs', ...stage('waiting_for_jobs') }),
  'u4-installing': () => ({ ...base0, state: 'installing', ...stage('installing', { percent: 25 }) }),
  'u5-restarting': () => ({ ...base0, state: 'restarting', ...stage('restarting') }),
  'u6-done': () => ({ ...base0, current_version: '0.1.12', update_available: false, ...stage('done') }),
  'u7-failed': () => ({ ...base0, state: 'failed', error: 'The installer stopped with code 1603.',
    ...stage('failed', { failed_at: 'installing', error: 'The installer stopped with code 1603.',
      log_path: 'C:\\ProgramData\\crsp\\logs\\msi-update.log' }) }),
};
export const INSTALLER = ['i1-welcome', 'i2-choices', 'i3-installing', 'i4-done', 'i5-failed'];

const browser = await chromium.launch();
const sizes = {
  baseline: [1100, 880], 'baseline-small': [520, 420],
  A: [560, 420], B: [560, 440], C: [500, 370],
};
for (const theme of ['dark', 'light'])
  for (const scale of [1, 1.5])
    for (const [id, fn] of [...Object.entries(UPDATER), ...(opt === 'baseline' ? [] : INSTALLER.map((i) => [i, null]))]) {
      const [w, h] = sizeArg === 'auto' ? sizes[opt] : sizeArg.split('x').map(Number);
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
      await ctx.addInitScript((t) => {
        localStorage.setItem('crsp.theme-name', 'phosphor');
        localStorage.setItem('crsp.theme-mode', t);
      }, theme);
      const page = await ctx.newPage();
      await page.route('**/api/v1/**', (route) => {
        const u = new URL(route.request().url());
        const j = (o) => route.fulfill({ json: o });
        if (u.pathname === '/api/v1/me') return j({ user: { id: 1, login: 'octo', role: 'owner', added_at: iso() }, csrf: 't', github_signin: { state: 'active', expires_at: iso() } });
        if (u.pathname === '/api/v1/me/preferences') return j({ theme: theme });
        if (u.pathname === '/api/v1/update') return j(fn ? fn() : base0);
        return j({});
      });
      const url = fn ? `${base}/update` : `${base}/installer?state=${id.split('-')[1]}`;
      await page.goto(url);
      await page.waitForTimeout(900);
      const file = `${out}/${id}-${theme}-${scale === 1 ? '100' : '150'}.png`;
      await page.screenshot({ path: file });
      const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      console.log(JSON.stringify({ opt, id, theme, scale, ...m }));
      await ctx.close();
    }
await browser.close();
