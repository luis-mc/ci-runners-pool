const { chromium } = require('playwright');
const OUT = '/home/user/ci-runners-shared-pool/docs/review/LOOK23/';
const now = '2026-11-18T09:00:00Z';
function mach(state) {
  if (state === 'first') return [];
  const m = (id, name, os) => ({ id, name, os, arch: 'x64', state: 'active', online: true, is_controller: false,
    backends: [{ name: 'docker', present: true, usable: true, allowed: true, version: '27' }],
    settings: { budget_memory_pct: 80, budget_cpu_pct: 80, job_slots: 4, light_slots: 2, heavy_slots: 2, allowed_backends: ['docker'], drain_timeout_minutes: 30, windows_symlink_right: false, mode: 'automatic', pause_on_battery: true, cpu_cap_pct: 100 },
    accepting: true, load: { memory_pct: 40, cpu_pct: 20, memory_known: true, cpu_known: true, sampled_at: now, stale: false }, slots_used: 1, last_seen_at: now });
  return [m('m1', 'build-1', 'linux'), m('m2', 'win-1', 'windows')];
}
function setup(state) {
  return { has_app: true, has_owner: true, setup_link_redeemed: true, steps: {
    connect_github: 'done', first_machine: state === 'first' ? 'todo' : 'done', first_repository: state === 'running' ? 'done' : 'todo' } };
}
async function open(browser, w, h, state, path, extra) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route('**/api/v1/**', (route) => {
    const u = new URL(route.request().url()); const p = u.pathname;
    const j = (b) => route.fulfill({ json: b });
    if (p.endsWith('/me')) return j({ user: { id: 1, login: 'octo', role: 'owner', added_at: now }, csrf: 't', github_signin: { state: 'active', expires_at: '2026-11-19T18:30:00Z' } });
    if (p.endsWith('/me/preferences')) return j({ theme: 'dark' });
    if (p.endsWith('/overview')) return j({ machines: mach(state), queued_count: state === 'running' ? 2 : 0, running: [], last_event_id: '1' });
    if (p.endsWith('/machines')) return j({ items: mach(state) });
    if (p.endsWith('/setup')) return j(setup(state));
    if (p.endsWith('/settings/public-repositories')) return j({ enabled: false, public_on_pool: 0 });
    if (p.endsWith('/github/installations')) return j({ items: [{ id: 1, account_login: 'octo', account_type: 'User', suspended: false, repository_selection: 'all' }], stale: { stale: false } });
    if (p.includes('/events')) return route.abort();
    return j({ items: [] });
  });
  await page.goto(`http://localhost:5199${path}${path.includes('?') ? '&' : '?'}state=${state}`);
  await page.waitForSelector('h1');
  await page.waitForTimeout(600);
  if (extra) await extra(page);
  return { page, ctx };
}
const shots = [];
const S = (name, state, path, extra) => shots.push({ name, state, path, extra });
for (const st of ['first', 'ready', 'running']) {
  S(`D-${st}-pool`, st, '/pool');
  S(`D-${st}-runners`, st, '/pool/runners');
  S(`D-${st}-repositories`, st, '/repositories', async (p) => {
    if (st !== 'first') { await p.getByLabel('Select octo/docs').check().catch(() => {}); await p.getByLabel('Select octo/infra').check().catch(() => {}); }
  });
  S(`D-${st}-jobs`, st, '/jobs');
}
S('D-ready-add-runners', 'ready', '/pool/runners/add');
S('D-ready-machines', 'ready', '/pool/machines');
S('D-ready-images', 'ready', '/pool/images');
S('D-ready-size', 'ready', '/pool/size');
S('D-running-jobs-repo', 'running', '/jobs/repository');
S('D-running-jobs-machine', 'running', '/jobs/machine');
S('D-running-jobs-runner', 'running', '/jobs/runner-type');
S('D-running-jobs-type', 'running', '/jobs/job-type');
S('D-running-jobs-trends', 'running', '/jobs/trends');
S('D-running-overview', 'running', '/');
(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[1300, 900], [393, 852]]) {
    for (const s of shots) {
      const { page, ctx } = await open(browser, w, h, s.state, s.path, s.extra);
      await page.screenshot({ path: `${OUT}${s.name}-${w}.png`, fullPage: w === 393 || true });
      await ctx.close();
    }
  }
  // phone nav: menu open
  const { page, ctx } = await open(browser, 393, 852, 'ready', '/pool');
  await page.getByRole('button', { name: /^Menu/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}D-phone-menu-393.png` });
  await ctx.close();
  await browser.close();
})();
