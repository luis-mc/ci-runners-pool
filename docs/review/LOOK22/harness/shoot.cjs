// Takes every LOOK22 screenshot. Run from the repo root: NODE_PATH=<global node_modules> node docs/review/LOOK22/harness/shoot.cjs
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const out = path.resolve(__dirname, '..');
const cfg = path.resolve(__dirname, 'vite.config.ts');
const VPS = { desktop: { width: 1300, height: 900 }, phone: { width: 393, height: 852 } };

async function num(p, label, keys) {
  await p.getByRole('button', { name: label }).first().click();
  const d = p.getByRole('dialog');
  for (const k of keys) await d.getByRole('button', { name: k, exact: true }).click();
  await d.getByRole('button', { name: 'Done' }).click();
  await p.getByRole('dialog').waitFor({ state: 'detached' });
}
const digits = (n) => String(n).split('');
const settle = (p) => p.waitForTimeout(700);

// Each option: list of [state, async (p) => void] run in order on one page (states build on each other).
const A = (isC) => [
  ['clean', async (p) => {}],
  ['recommended', async (p) => { await p.getByRole('radio', { name: /Recommended/ }).check(); }],
  ['editing-ok', async (p) => { await p.getByRole('radio', { name: /Custom/ }).check(); await num(p, /Pool memory/, digits(6)); await num(p, /Pool CPUs/, digits(4)); }],
  ['editing-warning', async (p) => { await num(p, /Pool memory/, digits(9)); }],
  ['editing-error', async (p) => { await num(p, /Pool memory/, digits(12)); }],
  ['back-to-ok', async (p) => { await num(p, /Pool memory/, digits(6)); }],
  ['saving', async (p, pane) => { await pane.getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForTimeout(150); }],
];
const B = [
  ['clean', async () => {}],
  ['recommended', async (p, pane) => { await pane.getByRole('button', { name: /Use recommended/ }).click(); }],
  ['editing-ok', async (p, pane) => { await pane.locator('input[type=range]').nth(0).fill('6'); await pane.locator('input[type=range]').nth(1).fill('4'); }],
  ['editing-warning', async (p, pane) => { await pane.locator('input[type=range]').nth(0).fill('9'); }],
  ['editing-error', async (p, pane) => { await pane.locator('input[type=range]').nth(0).fill('12'); }],
  ['back-to-ok', async (p, pane) => { await pane.locator('input[type=range]').nth(0).fill('6'); }],
  ['saving', async (p, pane) => { await pane.getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForTimeout(150); }],
];
const BASE = [
  ['first-run', async () => {}],
  ['review', async (p, pane) => { await num(p, /Pool memory/, digits(6)); await num(p, /Pool CPUs/, digits(4)); await pane.locator('.ds-action-bar').getByRole('button', { name: 'Review' }).click(); await p.getByText(/fits the budget/).waitFor(); }],
  ['done', async (p, pane) => { await pane.getByRole('button', { name: /^Save 6 GiB/ }).click(); await p.getByText(/The pool size is/).waitFor(); }],
];
// Second pass on a fresh page: the saved state (the save is not held).
const SAVED = {
  A: async (p, pane) => { await num(p, /Pool memory/, digits(6)); await num(p, /Pool CPUs/, digits(4)); await settle(p); await pane.getByRole('button', { name: 'Save', exact: true }).click(); await pane.getByText(/The pool size is/).waitFor(); },
  B: async (p, pane) => { await pane.locator('input[type=range]').nth(0).fill('6'); await pane.locator('input[type=range]').nth(1).fill('4'); await settle(p); await pane.getByRole('button', { name: 'Save', exact: true }).click(); await pane.getByText(/The pool size is/).waitFor(); },
  C: async (p, pane) => { await pane.getByRole('button', { name: 'Edit' }).click(); await num(p, /Pool memory/, digits(6)); await num(p, /Pool CPUs/, digits(4)); await settle(p); await pane.getByRole('button', { name: 'Save', exact: true }).click(); await pane.getByText(/The pool size is/).waitFor(); },
};
const C = [
  ['clean', async () => {}],
  ['editing-clean', async (p, pane) => { await pane.getByRole('button', { name: 'Edit' }).click(); }],
  ['recommended', async (p) => { await p.getByRole('radio', { name: /Recommended/ }).check(); }],
  ...A().slice(2),
];

(async () => {
  const b = await chromium.launch();
  let port = 5210;
  for (const [opt, plan] of [['baseline', BASE], ['A', A()], ['B', B], ['C', C]].filter(([o]) => !(process.env.ONLY && o === 'baseline'))) {
    const p0 = port++;
    const vite = spawn('pnpm', ['-C', 'apps/web', 'exec', 'vite', '--config', cfg, '--port', String(p0), '--strictPort'], { env: { ...process.env, OPTION: opt === 'baseline' ? '' : opt }, stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 5000));
    const passes = opt === 'baseline' ? [['', plan]] : [['hold=1', plan], ['', null]];
    for (const [vp, size] of Object.entries(VPS)) {
      for (const [query, steps] of passes) {
        const ctx = await b.newContext({ viewport: size, deviceScaleFactor: vp === 'phone' ? 2 : 1 });
        const p = await ctx.newPage();
        p.on('pageerror', (e) => console.log(opt, vp, 'PAGEERR', e.message.slice(0, 200)));
        await p.goto(`http://localhost:${p0}/?${query}`);
        const pane = p.locator('.ds-pane').filter({ has: p.getByRole('heading', { name: 'Pool size', exact: true }) });
        await pane.waitFor();
        await p.waitForTimeout(1200);
        const shot = async (state) => { if (process.env.ONLY && !process.env.ONLY.split(',').includes(state)) return; await settle(p); await pane.scrollIntoViewIfNeeded(); await pane.screenshot({ path: path.join(out, `${opt}-${state}-${vp}.png`) }); };
        if (steps) for (const [state, run] of steps) { await run(p, pane); await shot(state); }
        else if (SAVED[opt]) { await SAVED[opt](p, pane); await shot('saved'); }
        await ctx.close();
      }
    }
    vite.kill();
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
