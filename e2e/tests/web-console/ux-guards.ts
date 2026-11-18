// Shared parts of the UX guard specs (CRSP164): open any console route in a state, theme and width, and measure
// the DOM facts the design-system rules name. Every measure runs in the page and returns plain problem lines;
// a spec asserts the list is empty. No screenshots.
import type { Page } from '@playwright/test';
import { failure, signedIn, type Mock } from './fixtures';
import { jobsAndDoctor } from './jobs-doctor-fixtures';
import type { ConsoleRoute } from './routes';

export const WIDTHS = [
  { width: 360, height: 780 },
  { width: 393, height: 852 },
  { width: 1300, height: 900 },
  { width: 1800, height: 1000 },
] as const;
export const MODES = ['dark', 'light'] as const;
export type Mode = (typeof MODES)[number];
export type ScreenState = 'data' | 'empty' | 'failed';

const SESSION = ['/api/v1/me', '/api/v1/me/preferences', '/api/v1/events'];

/** The collections a list screen reads; "empty" answers them with no rows. */
const LISTS = [
  '/api/v1/machines',
  '/api/v1/runners',
  '/api/v1/images',
  '/api/v1/caches',
  '/api/v1/users',
  '/api/v1/jobs',
  '/api/v1/github/repositories',
  '/api/v1/doctor/findings',
];

/** Opens a route with the mocked controller. `failed` answers every data call with a 500, `empty` has no rows. */
export async function openRoute(
  page: Page,
  route: Pick<ConsoleRoute, 'url' | 'signedOut'>,
  opts: { mode?: Mode; state?: ScreenState; themeName?: string; width?: number } = {},
): Promise<Mock> {
  const mode = opts.mode ?? 'dark';
  const state = opts.state ?? 'data';
  const mock = jobsAndDoctor(signedIn());
  mock.on('GET', '/api/v1/me/preferences', { theme: mode });
  if (route.signedOut)
    mock.on('GET', '/api/v1/me', failure(401, 'unauthenticated', 'Sign in.'));
  if (state === 'empty') {
    for (const p of LISTS) mock.on('GET', p, { items: [], stale: { stale: false } });
    mock.on('GET', '/api/v1/machines/:id', failure(404, 'not_found', 'No such machine.'));
    mock.on(
      'GET',
      '/api/v1/repositories/:id',
      failure(404, 'not_found', 'No such repository.'),
    );
    mock.on('GET', '/api/v1/jobs/:id', failure(404, 'not_found', 'No such job.'));
  }
  await mock.install(page);
  if (state === 'failed')
    await page.route('**/api/v1/**', (r) => {
      const path = new URL(r.request().url()).pathname;
      if (SESSION.includes(path)) return r.fallback();
      return r.fulfill({
        status: 500,
        json: {
          error: { code: 'internal', message: 'The controller could not answer.' },
        },
      });
    });
  await page.emulateMedia({ colorScheme: mode });
  await page.addInitScript(
    ([name, m]) => {
      try {
        if (name) window.localStorage.setItem('crsp.theme-name', name);
        window.localStorage.setItem('crsp.theme-mode', m as string);
      } catch {
        // storage blocked: the page keeps its default
      }
    },
    [opts.themeName ?? '', mode],
  );
  await page.setViewportSize({
    width: opts.width ?? 1300,
    height: WIDTHS.find((w) => w.width === (opts.width ?? 1300))?.height ?? 900,
  });
  await page.goto(route.url);
  await settle(page, mode);
  return mock;
}

/** Waits for the page to be at rest, and puts the mode on pages that have no stored one (sign-in, first run). */
export async function settle(page: Page, mode: Mode): Promise<void> {
  await page.locator('main').first().waitFor();
  await page.waitForLoadState('networkidle');
  await page.evaluate(
    (m) => document.documentElement.setAttribute('data-theme', m),
    mode,
  );
  await page.waitForTimeout(50);
}

/** The measures. Each is a function body run in the page; it returns a list of problem lines. */
const VISIBLE = `const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
const label = (e) => e.tagName.toLowerCase() + (e.getAttribute('aria-label') ? '[' + e.getAttribute('aria-label') + ']' : '') + ':' + (e.textContent || e.getAttribute('name') || '').trim().replace(/\\s+/g, ' ').slice(0, 30);`;

const MEASURES = {
  /** UX-16: every control has a hit area of at least 44 by 44 px. */
  touch: `${VISIBLE}
    const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=menuitem], [role=checkbox], [role=switch], [role=radio], [role=option]';
    const bad = [];
    for (const e of document.querySelectorAll(sel)) {
      if (!visible(e)) continue;
      let box = e;
      if (e.matches('input[type=checkbox], input[type=radio]')) { const l = e.closest('label'); if (l && visible(l)) box = l; }
      const r = box.getBoundingClientRect();
      if (r.width <= 2 && r.height <= 2) continue; // a skip link or a hidden control
      if (r.width < 43.5 || r.height < 43.5) bad.push(label(e) + ' is ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' px');
    }
    return bad;`,
  /** UX-4: one primary button on the screen (a screen that offers an action has exactly one). */
  primary: `${VISIBLE}
    const all = Array.from(document.querySelectorAll('[data-primary], button[data-kind=primary]')).filter(visible);
    const names = all.map(label);
    const hasActions = Array.from(document.querySelectorAll('main button, main a[data-button]')).some(visible);
    if (names.length > 1) return ['more than one primary: ' + names.join(' | ')];
    if (names.length === 0 && hasActions) return ['no primary button although the screen has actions'];
    return [];`,
  /** UX-17: exactly one visible h1. */
  h1: `${VISIBLE}
    const h = Array.from(document.querySelectorAll('h1')).filter(visible);
    return h.length === 1 ? [] : ['found ' + h.length + ' h1: ' + h.map(label).join(' | ')];`,
  /** UX-12: where rows can be ticked, Select all N and Clear are in the toolbar. */
  selectAll: `${VISIBLE}
    const ticks = Array.from(document.querySelectorAll('main tbody input[type=checkbox], main [role=row] input[type=checkbox], main li input[type=checkbox]')).filter((e) => e.getClientRects().length > 0);
    if (ticks.length === 0) return [];
    const buttons = Array.from(document.querySelectorAll('main button')).filter(visible).map((b) => (b.textContent || '').trim());
    const out = [];
    if (!buttons.some((t) => /^Select all \\d+/.test(t))) out.push('rows can be ticked but there is no "Select all N" button');
    if (!buttons.some((t) => t === 'Clear')) out.push('rows can be ticked but there is no "Clear" button');
    return out;`,
  /** UX-15, UX-49: nothing in a nav, a menu or a tab row scrolls sideways. */
  navScroll: `${VISIBLE}
    const bad = [];
    const roots = document.querySelectorAll('nav, [role=menu], [role=menubar], [role=tablist], .ds-topmenu, .ds-tabs, .ds-popover');
    const seen = new Set();
    for (const root of roots) {
      for (const e of [root, ...root.querySelectorAll('*')]) {
        if (seen.has(e) || !visible(e)) continue;
        seen.add(e);
        if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) bad.push(label(e) + ' scrolls sideways (' + e.scrollWidth + ' px in ' + e.clientWidth + ' px)');
      }
    }
    return bad;`,
  /** UX-49 (LOOK29): nothing shows a horizontal scroll bar: the page does not overflow, and no box that scrolls (overflow auto or scroll) has more width than it shows. */
  noScrollbar: `${VISIBLE}
    const bad = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth) bad.push('the page scrolls sideways (' + de.scrollWidth + ' px in ' + de.clientWidth + ' px)');
    for (const e of document.querySelectorAll('body *')) {
      if (e.matches('input, textarea, select, option, svg, svg *') || !visible(e)) continue;
      const s = getComputedStyle(e);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && e.scrollWidth > e.clientWidth + 1) bad.push(label(e) + ' has a horizontal scroll bar (' + e.scrollWidth + ' px in ' + e.clientWidth + ' px)');
    }
    return bad;`,
  /** UX-69 (A1): header, menu, main, banner and key-hint frames share one left and right edge, within 1 px. */
  frameEdges: `${VISIBLE}
    const bands = Array.from(document.querySelectorAll('[data-frame-band]')).filter(visible);
    if (bands.length === 0) return document.querySelector('header.ds-header') ? ['no frame band found'] : []; // a signed-out page has no frame
    const edge = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return [r.left + parseFloat(s.paddingLeft), r.right - parseFloat(s.paddingRight)]; };
    const [l0, r0] = edge(bands[0]);
    const bad = [];
    for (const b of bands.slice(1)) {
      const [l, r] = edge(b);
      if (Math.abs(l - l0) > 1 || Math.abs(r - r0) > 1) bad.push(label(b) + ' edges ' + Math.round(l) + '-' + Math.round(r) + ' differ from ' + Math.round(l0) + '-' + Math.round(r0));
    }
    return bad;`,
  /** UX-69 (LOOK9): on a signed-in page the title, the first menu item and the page content share the frame's left edge, and the content fills the frame to its right edge, within 1 px. The sign-in frame is narrow and has no header. */
  pageEdges: `${VISIBLE}
    const title = document.querySelector('.ds-header__product');
    const first = document.querySelector('.ds-topmenu__link');
    const main = document.querySelector('main');
    if (!title || !main) return [];
    const content = Array.from(main.children).filter(visible);
    if (content.length === 0) return [];
    const textLeft = (e) => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return b.width > 0 ? b.left : e.getBoundingClientRect().left; };
    const mp = getComputedStyle(main);
    const mr = main.getBoundingClientRect();
    const frameL = mr.left + parseFloat(mp.paddingLeft);
    const frameR = mr.right - parseFloat(mp.paddingRight);
    const bad = [];
    const tl = textLeft(title);
    if (Math.abs(tl - frameL) > 1) bad.push('title starts at ' + Math.round(tl) + ' but the frame at ' + Math.round(frameL));
    if (first) { const fl = first.getBoundingClientRect().left; if (Math.abs(fl - tl) > 1) bad.push('first menu item starts at ' + fl.toFixed(1) + ' but the title at ' + tl.toFixed(1)); }
    for (const c of content) {
      const r = c.getBoundingClientRect();
      if (Math.abs(r.left - frameL) > 1) bad.push(label(c) + ' starts at ' + Math.round(r.left) + ' but the frame at ' + Math.round(frameL));
      if (Math.abs(r.right - frameR) > 1) bad.push(label(c) + ' ends at ' + Math.round(r.right) + ' but the frame at ' + Math.round(frameR));
    }
    return bad;`,
  /** UX-69 (A3): the open menu item has no box: no side border, no outline, no fill. */
  navBox: `${VISIBLE}
    const bad = [];
    for (const e of document.querySelectorAll('.ds-topmenu [aria-current=page]')) {
      const s = getComputedStyle(e);
      for (const side of ['Left', 'Right', 'Top']) if (parseFloat(s['border' + side + 'Width']) > 0 && s['border' + side + 'Style'] !== 'none') bad.push(label(e) + ' has a ' + side.toLowerCase() + ' border');
      if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') bad.push(label(e) + ' has a fill ' + s.backgroundColor);
      if (parseFloat(s.borderBottomWidth) < 3) bad.push(label(e) + ' underline is under 3 px');
    }
    return bad;`,
  /** UX-69 (A6): no table header cell wraps. Phone width hides the header row, so it is judged where it shows. */
  tableHead: `${VISIBLE}
    const bad = [];
    for (const th of document.querySelectorAll('main th')) {
      if (!visible(th)) continue;
      const tops = [];
      const walk = document.createTreeWalker(th, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!(n.textContent || '').trim()) continue;
        const r = document.createRange(); r.selectNodeContents(n);
        for (const x of r.getClientRects()) tops.push(Math.round(x.top));
      }
      const lines = new Set(tops);
      if (lines.size > 1) bad.push(label(th) + ' wraps onto ' + lines.size + ' lines');
    }
    return bad;`,
  /** UX-69 (A7): no button sits on a pane border. */
  paneButtons: `${VISIBLE}
    const bad = [];
    for (const pane of document.querySelectorAll('.ds-pane')) {
      const p = pane.getBoundingClientRect();
      for (const b of pane.querySelectorAll('button, a[data-button]')) {
        if (!visible(b)) continue;
        const head = b.closest('thead');
        if (head && head.getBoundingClientRect().width <= 2) continue; // a table head folded away at phone width
        const r = b.getBoundingClientRect();
        const cross = (edge, lo, hi) => lo < edge - 0.5 && hi > edge + 0.5;
        if (cross(p.top, r.top, r.bottom) || cross(p.bottom, r.top, r.bottom)) bad.push(label(b) + ' overlaps the border of pane ' + (pane.getAttribute('aria-label') || ''));
      }
    }
    return bad;`,
  /** UX-69 (A8): each footer hint key appears once. */
  hintKeys: `${VISIBLE}
    const keys = Array.from(document.querySelectorAll('.ds-keyhints kbd')).map((k) => (k.textContent || '').toLowerCase().replace(/[\\s\\/,]+/g, ''));
    return keys.filter((k, i) => keys.indexOf(k) !== i).map((k) => 'key hint ' + k + ' is listed twice');`,
  /** Look Option B: every page section, list and table of the main area sits inside a Pane. */
  pane: `${VISIBLE}
    const main = document.querySelector('main');
    if (!main) return ['no main'];
    const inPane = (e) => !!e.closest('.ds-pane');
    const ignore = (e) => !!e.closest('nav, header, footer, .ds-pane, .ds-list-toolbar, .ds-segmented, .ds-chips, .ds-pager, [role=tablist], [role=listbox], [role=dialog], .ds-wizard, .ds-grant, .ds-strip, .ds-page-header, .ds-breadcrumbs, details, .ds-state');
    const bad = [];
    for (const e of main.querySelectorAll('section, table, ul, ol, [role=table], [role=list], h2')) {
      if (!visible(e) || inPane(e)) continue;
      if (e.matches('ul, ol') && ignore(e)) continue;
      if (e.matches('section, table, [role=table], h2') && ignore(e)) continue;
      if (e.matches('ul, ol') && e.children.length === 0) continue;
      bad.push(label(e) + ' is outside a pane');
    }
    return bad;`,
};
export type Measure = keyof typeof MEASURES;

export async function measure(page: Page, what: Measure): Promise<string[]> {
  return page.evaluate<string[]>(`(() => { ${MEASURES[what]} })()`);
}

/** Opens the route at each width and mode and returns the problem lines of one measure, prefixed with where. */
export async function measureEverywhere(
  page: Page,
  route: Pick<ConsoleRoute, 'pattern' | 'url' | 'signedOut'>,
  what: Measure,
  state: ScreenState = 'data',
): Promise<string[]> {
  const out: string[] = [];
  for (const mode of MODES) {
    await openRoute(page, route, { mode, state });
    for (const w of WIDTHS) {
      await page.setViewportSize(w);
      await page.waitForTimeout(30);
      for (const line of await measure(page, what))
        out.push(`${route.pattern} ${state} ${mode} ${w.width}px: ${line}`);
    }
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
  return out;
}
