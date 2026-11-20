import { serve, openConsole, chromium } from './harness.mjs';
import { PROPOSALS, HP_CSS } from './proposals.mjs';
const only = process.argv[2]?.split(',');
const { srv, url } = await serve();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const jobs = [];
for (const k of Object.keys(PROPOSALS)) if (!only || only.includes(k)) for (const w of [1300, 393]) jobs.push([k, w, 'light']);
if (!only || only.includes('A')) jobs.push(['A', 1300, 'dark']);
for (const [k, width, mode] of jobs) {
  const { ctx, page } = await openConsole(browser, url, { width, mode });
  const html = PROPOSALS[k].fn();
  await page.evaluate(([html, css]) => {
    const st = document.createElement('style'); st.setAttribute('data-look42', 'scoped proposal styles'); st.textContent = css; document.head.append(st);
    st.textContent += ' .ds-banner-slot,.ds-message:not(main .ds-message){display:none !important} main > :not([data-look42-page]){display:none !important} .ds-keyhints,.ds-bar-slot{display:none !important}';
    const main = document.querySelector('main'); const host = document.createElement('div'); host.setAttribute('data-look42-page', ''); host.innerHTML = html; main.append(host);
    document.querySelectorAll('.ds-topmenu__link[aria-current]').forEach((a) => a.removeAttribute('aria-current'));
    const list = document.querySelector('.ds-topmenu__list');
    if (list && list.lastElementChild) { const li = list.lastElementChild.cloneNode(true); const a = li.querySelector('a'); a.textContent = 'Help'; a.setAttribute('href', '/help'); a.setAttribute('aria-current', 'page'); list.append(li); }
    const tg = document.querySelector('[data-menu-toggle] button'); if (tg) tg.textContent = 'Help';
  }, [html, HP_CSS]);
  if (k === 'A') await page.evaluate(() => document.querySelectorAll('.hp-svg a[data-term="slot"]').forEach((a) => a.classList.add('on')));
  if (k === 'D') await page.evaluate(() => { const b = document.querySelector('.hp-anchor .hp-ask'); b.setAttribute('aria-expanded', 'true'); });
  await page.waitForTimeout(300); if (process.env.DBG) console.log(await page.evaluate(() => { const o=[]; document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect(); if(r.right>innerWidth+1) o.push(e.tagName+'.'+String(e.className.baseVal??e.className).slice(0,50)+' '+Math.round(r.right));}); return o.slice(0,8).join('\n'); }));
  const m = await page.evaluate(() => {
    const out = { sx: document.documentElement.scrollWidth > innerWidth + 1, clipped: [] };
    out.sw = document.documentElement.scrollWidth; out.iw = innerWidth;
    document.querySelectorAll('main *').forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width && (r.right > innerWidth + 1 || r.left < -1)) out.clipped.push('offscreen:' + e.tagName + '.' + (e.className.baseVal ?? e.className) + ' ' + Math.round(r.left) + '-' + Math.round(r.right));
    });
    document.querySelectorAll('main *').forEach((e) => { if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible' && !(e instanceof SVGElement)) out.clipped.push('clip:' + e.tagName + '.' + e.className); });
    out.clipped = out.clipped.slice(0, 6);
    return out;
  });
  const name = `${k}-${width}${mode === 'dark' ? '-dark' : ''}.png`;
  await page.screenshot({ path: `review/help/shots/${name}`, fullPage: true });
  console.log(name, JSON.stringify(m));
  await ctx.close();
}
await browser.close(); srv.close();
