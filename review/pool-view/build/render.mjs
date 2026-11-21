// LOOK51: renders every option as a real console screen (real build, real ui package) and writes shots/.
import { serve, openConsole, chromium } from './harness.mjs';
import { OPTIONS } from './options.mjs';
import { CSS } from './parts2.mjs';
const only = process.argv[2]?.split(',');
const { srv, url } = await serve();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const report = [];
async function shoot(name, html, nav, width, mode) {
  const { ctx, page } = await openConsole(browser, url, { width, mode });
  await page.evaluate(([html, css, nav]) => {
    const st = document.createElement('style'); st.setAttribute('data-look51', 'scoped proposal styles'); st.textContent = css + ' main > :not([data-look51-page]){display:none !important} .ds-keyhints,.ds-bar-slot{display:none !important}';
    document.head.append(st);
    const main = document.querySelector('main'); const host = document.createElement('div'); host.setAttribute('data-look51-page', ''); host.innerHTML = html; main.append(host);
    const list = document.querySelector('.ds-topmenu__list');
    const links = [...document.querySelectorAll('.ds-topmenu__link')];
    links.forEach((a) => a.removeAttribute('aria-current'));
    let label = nav.tab ?? nav.add;
    if (nav.add && list) { const li = list.lastElementChild.cloneNode(true); const a = li.querySelector('a'); a.textContent = nav.add; a.setAttribute('aria-current', 'page'); list.insertBefore(li, list.children[1] ?? null); }
    else { let a = links.find((l) => l.textContent.trim() === nav.tab); if (!a && list) { const li = list.lastElementChild.cloneNode(true); a = li.querySelector('a'); a.textContent = nav.tab; list.append(li); } if (a) a.setAttribute('aria-current', 'page'); }
    const tg = document.querySelector('[data-menu-toggle] button'); if (tg) tg.textContent = 'Menu: ' + label;
  }, [html, CSS, nav]);
  await page.waitForTimeout(250);
  const m = await page.evaluate(() => {
    const out = { sx: document.documentElement.scrollWidth > innerWidth + 1, sw: document.documentElement.scrollWidth, bad: [] };
    document.querySelectorAll('[data-look51-page] *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 1 || r.left < -1) && !e.closest('.ds-table-frame')) out.bad.push(e.tagName + '.' + String(e.className.baseVal ?? e.className).slice(0, 30) + ' ' + Math.round(r.left) + '-' + Math.round(r.right)); });
    out.bad = out.bad.slice(0, 4); return out;
  });
  await page.screenshot({ path: `review/pool-view/shots/${name}.png`, fullPage: true });
  report.push(name + ' ' + JSON.stringify(m)); await ctx.close();
}
for (const o of OPTIONS) {
  if (only && !only.includes(o.id)) continue;
  const [main, ...rest] = o.screens;
  for (const [w, mo] of [[1300, 'dark'], [1300, 'light'], [393, 'dark']]) await shoot(`${o.id}-${main.key}-${w}-${mo}`, main.html, main.nav, w, mo);
  for (const s of rest) for (const [w, mo] of [[1300, 'light'], [393, 'dark']]) await shoot(`${o.id}-${s.key}-${w}-${mo}`, s.html, s.nav, w, mo);
  for (const [w, mo] of [[1300, 'light'], [393, 'dark']]) await shoot(`${o.id}-help-${w}-${mo}`, o.help(), { tab: 'Help' }, w, mo);
}
console.log(report.join('\n'));
await browser.close(); srv.close();
