// RES21 design-system audit (REPORT ONLY, never a gate). Renders every console route in its states, at 360, 393 and
// 1300 px, in the Phosphor dark and light themes (and a theme sweep), and writes one JSON line per breach to
// $AUDIT_OUT with a cropped screenshot in $AUDIT_SHOTS. The checks are the ones the existing guards do not make:
// overlap, wrap, glued words, sticky bars, contrast, focus, rows, status words, raw controls, unknown classes.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Page } from '@playwright/test';
import { failure, machine, runner, signedIn, type Mock } from './fixtures';
import { jobsAndDoctor } from './jobs-doctor-fixtures';
import { consoleRoutes, NOT_FOUND_URL } from './routes';
import { measure, type Measure } from './ux-guards';

const OUT = process.env.AUDIT_OUT ?? 'ds-audit.jsonl';
const SHOTS = process.env.AUDIT_SHOTS ?? 'ds-audit-shots';
mkdirSync(SHOTS, { recursive: true });

const W = [
  { width: 360, height: 780 },
  { width: 393, height: 852 },
  { width: 1300, height: 900 },
];
type State = 'data' | 'empty' | 'failed' | 'loading';
interface Hit {
  kind: string;
  detail: string;
  rect?: [number, number, number, number];
  scroll?: number;
}

/* ---------- richer data than the guard fixtures: a real pool has many machines and runners ---------- */
const machines = [
  machine(),
  machine({
    id: 'm2',
    name: 'GameRoomPC',
    os: 'windows',
    container_os: 'linux',
    slots_used: 3,
    load: { memory_pct: 91, cpu_pct: 88, memory_known: true, cpu_known: true, sampled_at: '2026-11-14T10:00:00Z', stale: false },
  }),
  machine({ id: 'm3', name: 'mac-studio-ci-runner-with-a-very-long-hostname-01.local', os: 'darwin', arch: 'arm64', state: 'drained', accepting: false, taking: { taking_jobs: false, reason: 'stopped' } }),
  machine({ id: 'm4', name: 'offline-box', online: false, state: 'offline', last_seen_at: '2026-11-10T10:00:00Z' }),
  machine({ id: 'm5', name: 'controller-nuc', is_controller: true }),
  machine({ id: 'm6', name: 'old-agent', recovery: { state: 'needs_recovery', reason: 'old_protocol', has: '0.1.0', needs: '0.3.0', since: '2026-11-14T08:00:00Z', armed: false } }),
];
const longReason =
  'no usable backend: docker is not running (cannot connect to the Docker daemon at unix:///var/run/docker.sock) and persistent is not allowed on this machine';
const runners = [
  runner(),
  runner({ id: 'r2', name: 'crsp-linux-2', state: 'busy', current_job: { id: 9, repository: 'octo/app', run_id: 1, run_attempt: 1, github_job_id: 1, job_name: 'e2e', labels: [], state: 'running' } }),
  runner({ id: 'r3', name: 'crsp-linux-3', state: 'failed', failed_reason: longReason, reason: longReason }),
  runner({ id: 'r4', name: 'crsp-win-1', os: 'windows', state: 'offline' }),
  runner({ id: 'r5', name: 'crsp-eph-5', kind: 'ephemeral', backend: 'docker', isolation: 'container', keeps_state: false, state: 'idle', managed: false }),
  runner({ id: 'r6', name: 'crsp-mac-6', os: 'darwin', arch: 'arm64', state: 'idle', unclean_reason: 'The clean-up of the work folder failed: the folder is in use.' }),
  runner({ id: 'r7', name: 'crsp-a-very-long-runner-name-for-the-wrapping-check-7', state: 'not_registered' }),
];

function rich(mock: Mock, state: State): Mock {
  if (state === 'empty') return mock;
  mock.on('GET', '/api/v1/machines', { items: machines });
  mock.on('GET', '/api/v1/runners', { items: runners });
  mock.on('GET', '/api/v1/runners/:id', (_c, p) => runners.find((r) => r.id === p.id) ?? runners[0]);
  mock.on('GET', '/api/v1/machines/:id', (_c, p) => machines.find((m) => m.id === p.id) ?? machines[0]);
  mock.on('GET', '/api/v1/overview', { machines, queued_count: 4, running: [], last_event_id: '1' });
  return mock;
}

const SESSION = ['/api/v1/me', '/api/v1/me/preferences', '/api/v1/events'];
const LISTS = ['/api/v1/machines', '/api/v1/runners', '/api/v1/images', '/api/v1/caches', '/api/v1/users', '/api/v1/jobs', '/api/v1/runs', '/api/v1/jobs/groups', '/api/v1/github/repositories', '/api/v1/doctor/findings'];

async function open(
  page: Page,
  url: string,
  o: { mode: 'dark' | 'light'; state: State; theme?: string; width: number; signedOut?: boolean; extra?: (m: Mock) => void },
): Promise<Mock> {
  const mock = rich(jobsAndDoctor(signedIn()), o.state);
  mock.on('GET', '/api/v1/me/preferences', { theme: o.mode });
  if (o.signedOut) mock.on('GET', '/api/v1/me', failure(401, 'unauthenticated', 'Sign in.'));
  if (o.state === 'empty') {
    for (const p of LISTS) mock.on('GET', p, { items: [], stale: { stale: false } });
    mock.on('GET', '/api/v1/overview', { machines: [], queued_count: 0, running: [], last_event_id: '1' });
    for (const p of ['/api/v1/machines/:id', '/api/v1/repositories/:id', '/api/v1/jobs/:id', '/api/v1/runs/:id', '/api/v1/runners/:id'])
      mock.on('GET', p, failure(404, 'not_found', 'Not found.'));
  }
  o.extra?.(mock);
  await mock.install(page);
  if (o.state === 'failed' || o.state === 'loading')
    await page.route('**/api/v1/**', (r) => {
      const path = new URL(r.request().url()).pathname;
      if (SESSION.includes(path)) return r.fallback();
      if (o.state === 'loading') return; // never answered: the loading state stays
      return r.fulfill({ status: 500, json: { error: { code: 'internal', message: 'The controller could not answer.' } } });
    });
  await page.emulateMedia({ colorScheme: o.mode });
  await page.addInitScript(
    ([name, m]) => {
      try {
        if (name) window.localStorage.setItem('crsp.theme-name', name);
        window.localStorage.setItem('crsp.theme-mode', m as string);
      } catch {
        /* blocked */
      }
    },
    [o.theme ?? '', o.mode],
  );
  await page.setViewportSize({ width: o.width, height: W.find((w) => w.width === o.width)?.height ?? 900 });
  await page.goto(url);
  if (o.state !== 'loading') {
    await page.locator('main').first().waitFor();
    await page.waitForLoadState('networkidle');
  } else await page.waitForTimeout(700);
  await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), o.mode);
  await page.waitForTimeout(80);
  return mock;
}

/* ---------- the in-page audit: returns breaches, each with a rect in page coordinates ---------- */
const auditInPage = (): Hit[] => {
  const hits: Hit[] = [];
  const sx = window.scrollX;
  const sy = window.scrollY;
  const add = (kind: string, detail: string, e?: Element | DOMRect | null) => {
    let rect: Hit['rect'];
    if (e) {
      const r = e instanceof Element ? e.getBoundingClientRect() : e;
      rect = [r.left + sx, r.top + sy, r.width, r.height];
    }
    hits.push({ kind, detail, ...(rect ? { rect } : {}) });
  };
  const vis = (e: Element) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const lab = (e: Element) =>
    e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') + ':' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const vw = document.documentElement.clientWidth;
  /** A bar that is fixed or sticky overlays content by design (its cover is judged by the sticky checks). */
  const floating = (e: Element) => {
    for (let x: Element | null = e; x; x = x.parentElement) {
      const p = getComputedStyle(x).position;
      if (p === 'fixed' || p === 'sticky') return true;
    }
    return false;
  };
  const hidden = (e: Element) => {
    for (let x: Element | null = e; x; x = x.parentElement) {
      if (x.matches('.ds-visually-hidden, .sr-only')) return true;
    }
    return false;
  };

  // text boxes: one per text node line
  interface TB { el: Element; r: DOMRect; text: string }
  const tbs: TB[] = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.textContent ?? '';
    if (!t.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('script, style, noscript, option, svg') || !vis(el) || hidden(el) || floating(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width > 2 && r.height > 2) tbs.push({ el, r, text: t.trim().slice(0, 30) });
  }

  // 1 sideways overflow
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth) add('overflow-x', `page is ${de.scrollWidth}px wide in ${de.clientWidth}px`);
  for (const e of document.querySelectorAll('main *, header *, nav *')) {
    if (e.closest('svg') || !vis(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.right > vw + 1 && !e.closest('[aria-hidden=true]') && getComputedStyle(e).position !== 'fixed') {
      add('overflow-x', `${lab(e)} ends at ${Math.round(r.right)} in ${vw}px`, e);
      break;
    }
  }

  // 2 overlaps: text over text, text over a pane border, text over a control, control over control
  const panes = Array.from(document.querySelectorAll('.ds-pane')).filter(vis);
  const inter = (a: DOMRect, b: DOMRect) => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? { w, h } : null;
  };
  const seen = new Set<string>();
  for (let i = 0; i < tbs.length; i++)
    for (let j = i + 1; j < tbs.length; j++) {
      const a = tbs[i]!;
      const b = tbs[j]!;
      if (a.el === b.el) continue;
      const x = inter(a.r, b.r);
      if (!x) continue;
      if (x.w < 0.3 * Math.min(a.r.width, b.r.width) || x.h < 0.4 * Math.min(a.r.height, b.r.height)) continue;
      const key = a.text + '|' + b.text;
      if (seen.has(key)) continue;
      seen.add(key);
      add('text-over-text', `"${a.text}" (${lab(a.el)}) overlaps "${b.text}" (${lab(b.el)})`, new DOMRect(Math.min(a.r.left, b.r.left), Math.min(a.r.top, b.r.top), Math.max(a.r.right, b.r.right) - Math.min(a.r.left, b.r.left), Math.max(a.r.bottom, b.r.bottom) - Math.min(a.r.top, b.r.top)));
    }
  for (const p of panes) {
    const r = p.getBoundingClientRect();
    const lines = [new DOMRect(r.left, r.top - 1, r.width, 2), new DOMRect(r.left, r.bottom - 1, r.width, 2), new DOMRect(r.left - 1, r.top, 2, r.height), new DOMRect(r.right - 1, r.top, 2, r.height)];
    const own = p.querySelector(':scope > .ds-pane__title');
    for (const t of tbs) {
      if (own && own.contains(t.el)) continue;
      if (t.el.closest('.ds-pane__title') && !p.contains(t.el)) {
        // another pane's title on this pane's border or inside it
      }
      if (t.r.height < 4) continue;
      for (const l of lines) {
        const x = inter(t.r, l);
        if (x && x.h > 0.4 * Math.min(t.r.height, l.height) && x.w > 0.3 * Math.min(t.r.width, l.width)) {
          const key = 'b' + t.text + lab(p).slice(0, 25);
          if (seen.has(key)) break;
          seen.add(key);
          add('text-over-border', `"${t.text}" crosses the border of pane ${lab(p).slice(0, 30)}`, t.r);
          break;
        }
      }
    }
  }
  const ctl = Array.from(document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]')).filter((e) => vis(e) && e.getBoundingClientRect().width > 4 && !floating(e) && !hidden(e));
  for (let i = 0; i < ctl.length; i++)
    for (let j = i + 1; j < ctl.length; j++) {
      const a = ctl[i]!;
      const b = ctl[j]!;
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x = inter(ra, rb);
      if (x && x.w > 3 && x.h > 3 && x.w * x.h > 0.15 * Math.min(ra.width * ra.height, rb.width * rb.height))
        add('control-over-control', `${lab(a)} overlaps ${lab(b)}`, new DOMRect(Math.min(ra.left, rb.left), Math.min(ra.top, rb.top), Math.max(ra.right, rb.right) - Math.min(ra.left, rb.left), Math.max(ra.bottom, rb.bottom) - Math.min(ra.top, rb.top)));
    }

  // 3 buttons whose text wraps, breaks mid-word or is clipped
  for (const b of document.querySelectorAll('button, a[data-button], [role=tab], .ds-chip, .ds-badge, .ds-tag')) {
    if (!vis(b)) continue;
    const tops = new Set<number>();
    const w2 = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    let broken = false;
    for (let n = w2.nextNode(); n; n = w2.nextNode()) {
      const t = n.textContent ?? '';
      if (!t.trim()) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      const nt = new Set(Array.from(rg.getClientRects()).filter((r) => r.width > 1).map((r) => Math.round(r.top / 4)));
      if (nt.size > 1) nt.forEach((v) => tops.add(v));
      for (const m of t.matchAll(/\S{3,}/g)) {
        rg.setStart(n, m.index!);
        rg.setEnd(n, m.index! + m[0].length);
        const tt = new Set(Array.from(rg.getClientRects()).filter((r) => r.width > 1).map((r) => Math.round(r.top / 4)));
        if (tt.size > 1) broken = true;
      }
    }
    if (broken) add('word-broken', `${lab(b)} breaks a word over lines`, b);
    else if (tops.size > 1) add('button-wraps', `${lab(b)} wraps onto ${tops.size} lines`, b);
    if (b.scrollWidth > b.clientWidth + 1 && getComputedStyle(b).overflowX !== 'visible') add('button-clipped', `${lab(b)} text is clipped (${b.scrollWidth} in ${b.clientWidth})`, b);
  }
  // any text word broken mid-word in table cells, status, headings, labels
  let words = 0;
  for (const tb of tbs) {
    if (tb.el.closest('button, a[data-button], [role=tab]') || words > 2500) continue;
    const n = Array.from(tb.el.childNodes).find((c) => c.nodeType === 3 && (c.textContent ?? '').includes(tb.text.slice(0, 5)));
    if (!n) continue;
    const t = n.textContent ?? '';
    const rg = document.createRange();
    for (const m of t.matchAll(/[A-Za-z]{4,}/g)) {
      words++;
      rg.setStart(n, m.index!);
      rg.setEnd(n, m.index! + m[0].length);
      const tt = new Set(Array.from(rg.getClientRects()).filter((r) => r.width > 1).map((r) => Math.round(r.top / 4)));
      if (tt.size > 1) {
        add('word-broken', `"${m[0]}" in ${lab(tb.el)} is broken over lines`, rg.getBoundingClientRect());
        break;
      }
    }
  }

  // 4 words glued: two text nodes on one line, no gap, letters on both sides
  const ordered = tbs.filter((t) => !t.el.closest('.ds-caret, [aria-hidden=true], pre, code, kbd'));
  for (let i = 0; i + 1 < ordered.length; i++) {
    const a = ordered[i]!;
    const b = ordered[i + 1]!;
    if (a.el === b.el) continue;
    const sameLine = Math.abs(a.r.top - b.r.top) < 4 && Math.abs(a.r.height - b.r.height) < 8;
    const gap = b.r.left - a.r.right;
    if (!sameLine || gap > 1.2 || gap < -1) continue;
    const ta = (a.el.textContent ?? '').trim();
    const tb2 = (b.el.textContent ?? '').trim();
    if (/[A-Za-z0-9]$/.test(ta) && /^[A-Za-z0-9]/.test(tb2) && !getComputedStyle(a.el).display.startsWith('flex'))
      add('words-glued', `"${ta.slice(-14)}" touches "${tb2.slice(0, 14)}" (gap ${gap.toFixed(1)}px)`, new DOMRect(a.r.right - 20, a.r.top, 40, a.r.height));
  }

  // 5 sticky bars: in view at the top and at the middle of a long page; do not cover the last row
  const bars = Array.from(document.querySelectorAll('.ds-action-bar, .ds-keyhints')).filter((e) => e.getBoundingClientRect().height > 0);
  const maxY = de.scrollHeight - window.innerHeight;
  if (maxY > 40)
    for (const bar of bars) {
      const pos = getComputedStyle(bar).position;
      const r = bar.getBoundingClientRect();
      if (sy === 0 && (r.top < -1 || r.bottom > window.innerHeight + 1))
        add('sticky-bar-not-in-view', `${lab(bar)} (position ${pos}) is at ${Math.round(r.top)}..${Math.round(r.bottom)} of a ${window.innerHeight}px window at the top of a ${de.scrollHeight}px page`, bar);
    }

  // 6 status: word + glyph + colour
  for (const s of document.querySelectorAll('.ds-status')) {
    if (!vis(s)) continue;
    const g = s.querySelector('.ds-status__glyph')?.textContent?.trim();
    const w = s.querySelector('.ds-status__word')?.textContent?.trim();
    if (!g || !w || w.length < 2) add('status-incomplete', `${lab(s)}: glyph "${g}" word "${w}"`, s);
  }

  // 7 raw controls and unknown classes, inline styles
  const known = new Set<string>();
  for (const sh of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sh.cssRules)) for (const m of rule.cssText.matchAll(/\.([A-Za-z_][\w-]*)/g)) known.add(m[1]!);
    } catch {
      /* cross-origin */
    }
  }
  const unk = new Map<string, Element>();
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('svg')) continue;
    if (e.matches('button, input, select, textarea') && !Array.from(e.classList).some((c) => c.startsWith('ds-')) && vis(e) && !e.closest('[class*="ds-"]'))
      add('raw-control', `${lab(e)} has no shared-part class`, e);
    for (const c of Array.from(e.classList)) if (!known.has(c) && !unk.has(c) && !c.startsWith('ds-')) unk.set(c, e);
    const st = e.getAttribute('style');
    if (st && /(^|;)\s*(width|height|margin|padding|position|top|left|right|bottom|color|background|display|flex|grid|font|border|min-|max-|overflow|z-index)/.test(st) && !e.closest('svg') && vis(e))
      add('inline-style', `${lab(e)} style="${st.slice(0, 80)}"`, e);
  }
  for (const [c, e] of unk) add('unknown-class', `class "${c}" is not defined by the shared stylesheet (${lab(e)})`, e);

  // 8 garbage text
  const mainText = document.querySelector('main')?.innerText ?? '';
  const g = /\b(undefined|NaN|null|Invalid Date|\[object [A-Za-z]+\])\b|\{\{|\$\{/.exec(mainText);
  if (g) add('garbage-text', `the page shows "${g[0]}"`);

  // 9 contrast of every text node
  const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const rgba = (c: string): [number, number, number, number] => {
    cv.clearRect(0, 0, 1, 1);
    cv.fillStyle = '#000';
    cv.fillStyle = c;
    cv.fillRect(0, 0, 1, 1);
    const d = cv.getImageData(0, 0, 1, 1).data;
    // canvas premultiplies: read alpha by drawing on a white and a black base
    cv.clearRect(0, 0, 1, 1);
    cv.fillStyle = '#fff';
    cv.fillRect(0, 0, 1, 1);
    cv.fillStyle = c;
    cv.fillRect(0, 0, 1, 1);
    const w = cv.getImageData(0, 0, 1, 1).data;
    cv.clearRect(0, 0, 1, 1);
    cv.fillStyle = '#000';
    cv.fillRect(0, 0, 1, 1);
    cv.fillStyle = c;
    cv.fillRect(0, 0, 1, 1);
    const k = cv.getImageData(0, 0, 1, 1).data;
    const a = 1 - (w[0]! - k[0]!) / 255;
    void d;
    return a > 0.001 ? [k[0]! / a, k[1]! / a, k[2]! / a, a] : [0, 0, 0, 0];
  };
  const lum = (c: number[]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
  };
  const over = (top: number[], bot: number[]) => {
    const a = top[3]!;
    return [top[0]! * a + bot[0]! * (1 - a), top[1]! * a + bot[1]! * (1 - a), top[2]! * a + bot[2]! * (1 - a), 1];
  };
  const bgOf = (el: Element): number[] | null => {
    const stack: number[][] = [];
    for (let e: Element | null = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage !== 'none') return null;
      const c = rgba(s.backgroundColor);
      if (c[3]! > 0) stack.push(c);
      if (c[3]! >= 0.999) break;
    }
    let acc = [255, 255, 255, 1];
    for (const c of stack.reverse()) acc = over(c, acc);
    return acc;
  };
  const cseen = new Set<string>();
  let judged = 0;
  for (const t of tbs) {
    const el = t.el;
    if (el.closest('[disabled], [aria-disabled=true], .ds-caret, [aria-hidden=true]')) continue;
    const s = getComputedStyle(el);
    if (s.visibility !== 'visible') continue;
    const bg = bgOf(el);
    if (!bg) continue;
    let op = 1;
    for (let e: Element | null = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    const fgRaw = rgba(s.color);
    fgRaw[3] = fgRaw[3]! * op;
    const fg = over(fgRaw, bg);
    const l1 = lum(fg);
    const l2 = lum(bg);
    judged++;
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(s.fontSize);
    const large = px >= 24 || (px >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      const key = s.color + bg.join(',') + (el.className || el.tagName);
      if (cseen.has(key)) continue;
      cseen.add(key);
      add('low-contrast', `"${t.text}" ${ratio.toFixed(2)}:1 (needs ${need}) colour ${s.color} on ${bg.map((v) => Math.round(v)).join(',')} in ${lab(el)}`, t.r);
    }
  }

  add('meta-contrast-judged', `${judged} of ${tbs.length} text boxes judged`);

  // 10 tables: one row height, last column action words
  for (const tbl of document.querySelectorAll('main table')) {
    if (!vis(tbl) || tbl.getBoundingClientRect().height < 4) continue;
    const rows = Array.from(tbl.querySelectorAll('tbody tr')).filter((r) => vis(r));
    if (rows.length < 2) continue;
    const hs = rows.map((r) => Math.round(r.getBoundingClientRect().height));
    if (vw >= 1000 && Math.max(...hs) - Math.min(...hs) > 3) add('rows-uneven', `table rows are ${hs.join('/')} px high`, tbl);
    if (vw >= 1000) {
      const tall = hs.filter((h) => h > 1.7 * Math.min(...hs)).length;
      if (tall > 0 && Math.min(...hs) < 80) add('rows-multiline', `${tall} of ${rows.length} rows are more than one line (${hs.join('/')} px)`, tbl);
    }
    for (const c of tbl.querySelectorAll('td')) {
      if (!vis(c)) continue;
      if (c.scrollWidth > c.clientWidth + 1 && getComputedStyle(c).overflow !== 'visible' && !c.querySelector('.ds-table__clip, .ds-shorttext')) add('cell-clipped', `cell ${lab(c)} cut (${c.scrollWidth} in ${c.clientWidth})`, c);
    }
    const words = new Set<string>();
    for (const r of rows) {
      const last = Array.from(r.querySelectorAll('td')).filter(vis).pop();
      for (const bt of last?.querySelectorAll('button, a[data-button]') ?? []) words.add((bt.textContent ?? '').trim());
    }
    const ok = new Set(['Open run', 'Open', 'Open job', '']);
    for (const w of words) if (!ok.has(w)) add('row-action-word', `last-column button "${w}" is not one of Open run / Open / Open job (UX-72); lists its own word`, tbl);
  }

  return hits;
};

/** Focus walk: Tab through up to 60 controls; each must show something that changes when focused. */
async function focusWalk(page: Page): Promise<Hit[]> {
  const hits: Hit[] = [];
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Tab');
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const r = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e || e === document.body) return null;
      const s = getComputedStyle(e);
      const b = e.getBoundingClientRect();
      const pane = e.closest('.ds-pane');
      const focusC = getComputedStyle(document.documentElement).getPropertyValue('--ds-color-focus').trim();
      const out = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const sh = s.boxShadow !== 'none';
      const wrap = e.closest('label, .ds-field, .ds-input, .ds-control, .ds-button-wrap');
      const ws = wrap ? getComputedStyle(wrap) : null;
      const wOut = !!ws && ((ws.outlineStyle !== 'none' && parseFloat(ws.outlineWidth) > 0) || ws.boxShadow !== 'none');
      const paneRing = !!pane && focusC !== '' && getComputedStyle(pane).borderColor !== '' && pane.matches(':focus-within');
      const bg = s.backgroundColor + s.color + s.textDecorationLine;
      return {
        id: e.tagName + (e.textContent ?? '').trim().slice(0, 20) + b.top,
        label: e.tagName.toLowerCase() + ':' + ((e.getAttribute('aria-label') || e.textContent || e.getAttribute('name') || '') as string).trim().slice(0, 30),
        ok: out || sh || wOut,
        paneRing,
        bg,
        visible: b.width > 0 && b.height > 0,
        rect: [b.left + scrollX, b.top + scrollY, b.width, b.height] as [number, number, number, number],
        matches: e.matches(':focus-visible'),
      };
    });
    if (!r) break;
    if (seen.has(r.id)) break;
    seen.add(r.id);
    if (r.visible && !r.ok && r.matches) hits.push({ kind: 'focus-not-visible', detail: `${r.label} shows no outline or shadow when focused${r.paneRing ? ' (only its pane border changes)' : ''}`, rect: r.rect });
    await page.keyboard.press('Tab');
  }
  return hits;
}

/** Scrolls a long page: the action bar must stay in view, and the last row must end above it. */
async function stickyWalk(page: Page): Promise<Hit[]> {
  const out: Hit[] = [];
  const info = await page.evaluate(() => ({ max: document.documentElement.scrollHeight - window.innerHeight, has: !!document.querySelector('.ds-action-bar') }));
  if (!info.has || info.max < 40) return out;
  for (const frac of [0.5, 1]) {
    const res = await page.evaluate((f) => {
      window.scrollTo(0, Math.round((document.documentElement.scrollHeight - window.innerHeight) * f));
      return Array.from(document.querySelectorAll('.ds-action-bar')).map((bar) => {
        const r = bar.getBoundingClientRect();
        return { label: (bar.getAttribute('aria-label') ?? 'bar') + ':' + (bar.textContent ?? '').trim().slice(0, 40), top: r.top, bottom: r.bottom, h: r.height, w: r.width, left: r.left, pos: getComputedStyle(bar).position, vh: window.innerHeight, y: window.scrollY, sticky: bar.getAttribute('data-sticky') };
      });
    }, frac);
    for (const r of res)
      if (r.h > 0 && r.sticky !== 'false' && (r.top < -1 || r.bottom > r.vh + 1))
        out.push({ kind: 'sticky-bar-scrolls-away', detail: `${r.label} (position ${r.pos}) is at ${Math.round(r.top)}..${Math.round(r.bottom)} in a ${r.vh}px window at scroll ${Math.round(r.y)} (${Math.round(frac * 100)}% of the page)`, scroll: r.y });
  }
  // at the bottom: the last text must end above the bar and above the key-hint bar
  const cover = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const bars = Array.from(document.querySelectorAll('.ds-action-bar, .ds-keyhints')).map((b) => b.getBoundingClientRect()).filter((r) => r.height > 0 && r.top < window.innerHeight);
    const tw = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT);
    const bad: string[] = [];
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!(n.textContent ?? '').trim()) continue;
      const el = n.parentElement!;
      if (el.closest('.ds-action-bar, .ds-keyhints')) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      for (const r of rg.getClientRects())
        for (const b of bars) if (r.width > 2 && r.bottom > b.top + 3 && r.top < b.bottom - 3 && r.right > b.left && r.left < b.right) bad.push((n.textContent ?? '').trim().slice(0, 30));
    }
    return { bad: bad.slice(0, 3), y: window.scrollY };
  });
  if (cover.bad.length) out.push({ kind: 'sticky-bar-covers-content', detail: `at the bottom of the page the bar covers "${cover.bad.join('", "')}"`, scroll: cover.y });
  await page.evaluate(() => window.scrollTo(0, 0));
  return out;
}

const counts = new Map<string, number>();
async function record(page: Page, base: Record<string, unknown>, hits: Hit[]) {
  for (const h of hits) {
    const key = `${h.kind}|${base.route}|${h.detail.slice(0, 40)}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    let shot: string | undefined;
    if (n === 1 && (counts.get('shots|' + h.kind + '|' + base.route) ?? 0) < 2) {
      counts.set('shots|' + h.kind + '|' + base.route, (counts.get('shots|' + h.kind + '|' + base.route) ?? 0) + 1);
      shot = `${h.kind}-${String(base.route).replace(/[^\w]+/g, '_')}-${base.width}-${base.mode}-${base.theme ?? 'phosphor'}-${base.state}-${(counts.size % 1000)}.png`;
      try {
        if (h.scroll !== undefined) {
          await page.evaluate((y) => window.scrollTo(0, y), h.scroll);
          await page.screenshot({ path: join(SHOTS, shot) });
        } else if (h.rect) {
          const [x, y, w, hh] = h.rect;
          const pad = 60;
          const vp = page.viewportSize()!;
          const top = Math.max(0, y - Math.round((vp.height - Math.min(hh, 300)) / 2));
          await page.evaluate((t) => window.scrollTo(0, t), top);
          const sy = await page.evaluate(() => window.scrollY);
          const cx = Math.max(0, x - pad);
          const cy = Math.max(0, y - sy - pad);
          await page.screenshot({ path: join(SHOTS, shot), clip: { x: cx, y: cy, width: Math.max(40, Math.min(vp.width - cx, Math.max(w, 30) + 2 * pad)), height: Math.max(40, Math.min(vp.height - cy, Math.min(Math.max(hh, 20), 400) + 2 * pad)) } });
        } else await page.screenshot({ path: join(SHOTS, shot) });
      } catch {
        shot = undefined;
      }
    }
    appendFileSync(OUT, JSON.stringify({ ...base, ...h, count: n, shot }) + '\n');
  }
}

const EXISTING: Measure[] = ['touch', 'primary', 'h1', 'selectAll', 'navScroll', 'noScrollbar', 'pane', 'frameEdges', 'pageEdges', 'navBox', 'tableHead', 'paneButtons', 'hintKeys'];

async function auditPage(page: Page, base: Record<string, unknown>, o: { focus?: boolean; sticky?: boolean } = {}) {
  const w = base.width as number;
  const hits = await page.evaluate(auditInPage);
  for (const m of EXISTING) {
    if (m === 'touch' && w !== 393) continue;
    if (base.state !== 'data' && m !== 'h1' && m !== 'noScrollbar') continue;
    try {
      for (const line of await measure(page, m)) hits.push({ kind: `guard-${m}`, detail: line });
    } catch {
      /* page changed */
    }
  }
  // UX-71: the primary is in the action bar
  const prim = await page.evaluate(() => {
    const ps = Array.from(document.querySelectorAll('main [data-primary], main button[data-kind=primary], main a[data-button][data-kind=primary]')).filter((e) => e.getBoundingClientRect().width > 0);
    return ps.filter((p) => !p.closest('.ds-action-bar, [role=dialog], .ds-state, .ds-wizard, .ds-page-header')).map((p) => (p.textContent ?? '').trim().slice(0, 30));
  });
  for (const p of prim) hits.push({ kind: 'primary-outside-bar', detail: `primary "${p}" is not inside the action bar (UX-71)` });
  if (o.sticky !== false) hits.push(...(await stickyWalk(page)));
  if (o.focus) hits.push(...(await focusWalk(page)));
  await page.evaluate(() => window.scrollTo(0, 0));
  await record(page, base, hits);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/* ---------- scenarios ---------- */
const routes = [...consoleRoutes(), { pattern: 'not found', url: NOT_FOUND_URL, signedOut: false }];
const visited = new Set<string>();
const modes = ['dark', 'light'] as const;

for (const route of routes) {
  test(`audit ${route.pattern}`, async ({ page }) => {
    test.setTimeout(240_000);
    for (const state of ['data', 'empty', 'failed', 'loading'] as State[]) {
      const sets =
        state === 'data'
          ? modes.flatMap((mode) => W.map((w) => ({ mode, w })))
          : state === 'loading'
            ? [{ mode: 'dark' as const, w: W[1]! }, { mode: 'dark' as const, w: W[2]! }]
            : W.map((w) => ({ mode: 'dark' as const, w }));
      let prev = '';
      for (const { mode, w } of sets) {
        const key = `${mode}`;
        if (key !== prev) {
          await page.unrouteAll({ behavior: 'ignoreErrors' });
          await open(page, route.url, { mode, state, width: w.width, signedOut: route.signedOut });
          prev = key;
        } else {
          await page.setViewportSize(w);
          await page.waitForTimeout(80);
        }
        if (state === 'data' && mode === 'dark' && w.width === 360) {
          const final = new URL(page.url()).pathname;
          if (visited.has(final) && final !== route.url) return; // a redirect to a screen already audited
          visited.add(final);
        }
        await auditPage(page, { route: route.pattern, scenario: 'route', state, width: w.width, mode }, { focus: state === 'data' && mode === 'dark' && w.width !== 360, sticky: state === 'data' });
      }
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });
}

/* theme sweep: five more themes, dark and light, on screens that show every kind of part */
const SWEEP = ['/', '/pool/runners', '/pool/machines/m1', '/jobs', '/settings/console', '/doctor'];
for (const theme of ['tokyo-night', 'catppuccin', 'gruvbox', 'solarized', 'nord']) {
  test(`audit theme ${theme}`, async ({ page }) => {
    test.setTimeout(240_000);
    for (const mode of modes)
      for (const url of SWEEP) {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await open(page, url, { mode, state: 'data', theme, width: 1300 });
        const hits = (await page.evaluate(auditInPage)).filter((h) => h.kind === 'low-contrast' || h.kind === 'text-over-text');
        await record(page, { route: url, scenario: 'theme', state: 'data', width: 1300, mode, theme }, hits);
      }
  });
}

/* the interactive states: edit bars, wizards at each state */
const pickEdit = async (page: Page) => {
  const f = page.locator('main input[type=text], main input[type=number], main input:not([type]), main textarea').first();
  if (await f.count()) {
    await f.fill(((await f.inputValue()) || '1') + '7').catch(() => undefined);
    await page.waitForTimeout(150);
  }
};
const EDITS = ['/pool/machines/m1', '/pool/runners/r1', '/pool/runners/r3', '/repositories/octo/app', '/pool/images/img_m1_linux', '/settings/access', '/settings/repositories', '/settings/console', '/settings/data', '/settings/audit', '/pool/size'];
for (const url of EDITS) {
  test(`audit edit ${url}`, async ({ page }) => {
    test.setTimeout(120_000);
    for (const mode of modes)
      for (const w of W) {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await open(page, url, { mode, state: 'data', width: w.width });
        await pickEdit(page);
        await auditPage(page, { route: url, scenario: 'edit', state: 'data', width: w.width, mode }, { focus: false });
      }
  });
}

const plan = (state: string, stepState: string, error?: string) => ({
  id: 'rp1',
  area: 'runners',
  state,
  created_at: '2026-11-18T10:00:00Z',
  created_by: 'octo',
  steps: [
    { id: 's1', action: 'add_runner', text: 'Add ephemeral runner crsp-pool-1 on machine GameRoomPC', needs_yes: false, state: stepState === 'failed' ? 'done' : stepState },
    { id: 's2', action: 'add_runner', text: 'Add ephemeral runner crsp-pool-2 on machine GameRoomPC', needs_yes: false, state: stepState, ...(error ? { error } : {}) },
  ],
});
const WSTATES: { id: string; plan: string; step: string; err?: string }[] = [
  { id: 'running', plan: 'applying', step: 'running' },
  { id: 'stopped', plan: 'stopped', step: 'planned' },
  { id: 'failed', plan: 'failed', step: 'failed', err: 'The machine did not answer within 60 seconds. Check that its agent is running, then try again.' },
  { id: 'done', plan: 'done', step: 'done' },
];
for (const ws of [{ id: 'review', plan: 'planned', step: 'planned' }, ...WSTATES]) {
  test(`audit wizard add-runners ${ws.id}`, async ({ page }) => {
    test.setTimeout(180_000);
    for (const mode of modes)
      for (const w of W) {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        let applied = false;
        await open(page, '/pool/runners/add', {
          mode,
          state: 'data',
          width: w.width,
          extra: (m) =>
            m
              .on('POST', '/api/v1/runner-plans', plan('planned', 'planned'))
              .on('POST', '/api/v1/runner-plans/:id/apply', () => {
                applied = true;
                return plan('applying', 'running');
              })
              .on('POST', '/api/v1/runner-plans/:id/stop', plan('stopped', 'planned'))
              .on('GET', '/api/v1/runner-plans/:id', () => (applied ? plan(ws.plan, ws.step, ws.err) : plan('planned', 'planned'))),
        });
        const base = { route: '/pool/runners/add', scenario: `wizard-${ws.id}`, state: 'data', width: w.width, mode };
        if (ws.id === 'review') {
          await page.getByRole('button', { name: 'Next' }).click().catch(() => undefined);
        } else {
          await page.getByRole('button', { name: 'Next' }).click().catch(() => undefined);
          await page.getByRole('button', { name: /^(Add|Allow) \d+/ }).first().click().catch(() => undefined);
          await page.waitForTimeout(1500);
        }
        await auditPage(page, base, { focus: false });
        if (ws.id === 'done') {
          await page.reload();
          await page.waitForLoadState('networkidle');
          await auditPage(page, { ...base, scenario: 'wizard-done-after-reload' }, { focus: false });
        }
      }
  });
}
// the first step before anything is chosen, every other wizard at step 1 and step 2
for (const url of ['/pool/machines/add', '/repositories/turn-on', '/setup', '/settings/updates/review', '/pool/size']) {
  test(`audit wizard ${url}`, async ({ page }) => {
    test.setTimeout(120_000);
    for (const mode of modes)
      for (const w of W) {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await open(page, url, { mode, state: 'data', width: w.width });
        await auditPage(page, { route: url, scenario: 'wizard-step1', state: 'data', width: w.width, mode }, { focus: false });
        const next = page.getByRole('button', { name: /^(Next|Continue|Start)/ }).first();
        if (await next.isEnabled({ timeout: 1500 }).catch(() => false)) {
          await next.click({ timeout: 3000 }).catch(() => undefined);
          await page.waitForTimeout(400);
          await auditPage(page, { route: url, scenario: 'wizard-step2', state: 'data', width: w.width, mode }, { focus: false });
        }
      }
  });
}
