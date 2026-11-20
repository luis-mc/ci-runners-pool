// LOOK42 follow-up: renders G to K: Help page, Overview first-run strip, "?" popover. 1300 and 393 px, dark then light.
import { serve, openConsole, chromium } from './harness.mjs';
import { HQ_CSS, G, H, I, J, K, STRIPS, popHtml } from './proposals2.mjs';
const FN = { G, H, I, J, K };
const only = process.argv[2]?.split(',');
const { srv, url } = await serve();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const HIDE = '.ds-keyhints,.ds-bar-slot,.ds-banner-slot{display:none !important}';
const addCss = (page) => page.evaluate(([css]) => { const st = document.createElement('style'); st.setAttribute('data-look42', 'scoped proposal styles'); st.textContent = css; document.head.append(st); }, [HQ_CSS + HIDE]);
const metrics = (page) => page.evaluate(() => { const o = []; document.querySelectorAll('main *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 1 || r.left < -1)) o.push(e.tagName + '.' + String(e.className.baseVal ?? e.className).slice(0, 30) + ' ' + Math.round(r.left) + '-' + Math.round(r.right)); }); return { sx: document.documentElement.scrollWidth > innerWidth + 1, off: o.slice(0, 4) }; });
for (const k of Object.keys(FN)) {
  if (only && !only.includes(k)) continue;
  for (const mode of ['dark', 'light']) for (const width of [1300, 393]) {
    const tag = `${k}-${width}-${mode}`;
    // 1. Help page
    let { ctx, page } = await openConsole(browser, url, { width, mode });
    await addCss(page);
    await page.evaluate(([html]) => {
      document.head.querySelector('style[data-look42]').textContent += ' .ds-banner-slot,.ds-message:not(main .ds-message){display:none !important} main > :not([data-look42-page]){display:none !important}';
      const main = document.querySelector('main'); const host = document.createElement('div'); host.setAttribute('data-look42-page', ''); host.innerHTML = html; main.append(host);
      document.querySelectorAll('.ds-topmenu__link[aria-current]').forEach((a) => a.removeAttribute('aria-current'));
      const list = document.querySelector('.ds-topmenu__list');
      if (list && list.lastElementChild) { const li = list.lastElementChild.cloneNode(true); const a = li.querySelector('a'); a.textContent = 'Help'; a.setAttribute('href', '/help'); a.setAttribute('aria-current', 'page'); list.append(li); }
      const tg = document.querySelector('[data-menu-toggle] button'); if (tg) tg.textContent = 'Help';
    }, [FN[k]()]);
    await page.waitForTimeout(250);
    const m = await metrics(page);
    await page.screenshot({ path: `review/help/shots/${tag}-help.png`, fullPage: true });
    console.log(tag, 'help', JSON.stringify(m));
    await ctx.close();
    // 2. first-run strip on the Overview of a new pool
    ({ ctx, page } = await openConsole(browser, url, { width, mode, fresh: true }));
    await addCss(page);
    const ok = await page.evaluate(([html]) => {
      const msg = [...document.querySelectorAll('main .ds-message')].find((e) => /How crsp works/i.test(e.textContent));
      if (!msg) return false;
      [...document.querySelectorAll('main .ds-message')].filter((e) => /Live updates paused/.test(e.textContent)).forEach((e) => e.remove());
      msg.querySelector('.ds-message__label').innerHTML = '<span aria-hidden="true">ⓘ</span> Help';
      msg.querySelector('.ds-message__body').innerHTML = html;
      msg.querySelector('.ds-message__action')?.remove();
      return true;
    }, [STRIPS[k]()]);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `review/help/shots/${tag}-first.png`, fullPage: true });
    console.log(tag, 'first-run strip replaced:', ok, JSON.stringify(await metrics(page)));
    await ctx.close();
    // 3. D popover open next to Slots on a console screen
    ({ ctx, page } = await openConsole(browser, url, { width, mode }));
    await addCss(page);
    await page.evaluate(([html]) => { const n = document.querySelector('.ds-level__name:not(:empty)'); const el = [...document.querySelectorAll('.ds-level__name')].find((e) => e.textContent.trim() === 'Slots'); el.insertAdjacentHTML('beforeend', html); }, [popHtml(k)]);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `review/help/shots/${tag}-pop.png`, fullPage: width > 600 ? false : false });
    console.log(tag, 'pop', JSON.stringify(await metrics(page)));
    await ctx.close();
  }
}
await browser.close(); srv.close();
