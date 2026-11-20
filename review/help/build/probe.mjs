import { serve, openConsole, chromium } from './harness.mjs';
const { srv, url } = await serve();
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const { page } = await openConsole(browser, url, { width: 393 });
await page.waitForTimeout(1500);
console.log(await page.evaluate(() => { const o=[]; document.querySelectorAll('body *').forEach(e=>{ const r=e.getBoundingClientRect(); if(r.right>400||e.scrollWidth>400) o.push(e.tagName+'.'+String(e.className.baseVal??e.className).slice(0,50)+' r'+Math.round(r.right)+' sw'+e.scrollWidth);}); return document.documentElement.scrollWidth+'\n'+o.slice(0,8).join('\n'); }));
await page.screenshot({path:'review/help/shots/probe.png'});
await browser.close(); srv.close();
