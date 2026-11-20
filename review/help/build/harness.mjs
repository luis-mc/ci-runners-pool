// LOOK42 review harness: serves the real apps/web build, answers /api/v1/** from fixtures, injects a proposal into <main>.
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');
const DIST = resolve('apps/web/dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
export function serve() {
  const srv = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    let f = join(DIST, p);
    if (!p.startsWith('/assets') && !existsSync(f) || p === '/') f = join(DIST, 'index.html');
    if (!existsSync(f)) f = join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'text/html' });
    res.end(readFileSync(f));
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, url: `http://127.0.0.1:${srv.address().port}` })));
}
export const fx = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
export async function openConsole(browser, url, { width, mode = 'light', theme = 'phosphor', fresh = false }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([m, t, f]) => { localStorage.setItem('crsp.theme-mode', m); localStorage.setItem('crsp.theme-name', t); if (!f) localStorage.setItem('crsp.howItWorks.dismissed', '1'); }, [mode, theme, fresh]);
  const page = await ctx.newPage();
  await page.route('**/api/v1/events', (r) => r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: `event: snapshot\nid: 1\ndata: ${JSON.stringify({ id: '1', type: 'snapshot', at: '2026-11-20T10:00:00Z', snapshot: fresh ? { ...fx.overview, machines: [], queued_count: 0 } : fx.overview })}\n\n` }));
  await page.route('**/api/v1/**', (r) => {
    const p = new URL(r.request().url()).pathname;
    const empty = ['/api/v1/machines', '/api/v1/runners', '/api/v1/github/repositories'];
    const body = p === '/api/v1/me/preferences' ? { theme: mode } : fresh && p === '/api/v1/overview' ? { ...fx.overview, machines: [], queued_count: 0 } : fresh && empty.includes(p) ? { items: [] } : fx.routes[p];
    if (body === undefined) return r.fulfill({ status: 200, json: { items: [] } });
    return r.fulfill({ status: 200, json: body });
  });
  await page.goto(url + '/');
  await page.waitForSelector('main.ds-main, .ds-main', { timeout: 15000 });
  await page.waitForTimeout(800);
  return { ctx, page };
}
