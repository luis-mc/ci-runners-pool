/// <reference lib="dom.iterable" />
// RES21: design-system audit of the whole console. REPORT ONLY: it measures every route in its states, at 360, 393 and
// 1300 px, in the dark and light mode (and one sweep of the other themes at 1300 px), and writes one JSON line per
// breach plus a cropped screenshot. It never fails. It is skipped unless AUDIT_OUT names a folder:
//   AUDIT_OUT=/some/dir pnpm exec playwright test e2e/tests/web-console/ds-audit.spec.ts --fully-parallel
// Output: <AUDIT_OUT>/findings.jsonl and <AUDIT_OUT>/shots/*.png. A later task can turn a class of breach into a guard.
import { appendFileSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test, type Page } from '@playwright/test';
import { consoleRoutes, NOT_FOUND_URL } from './routes';
import { machine, runner } from './fixtures';
import { MODES, openRoute, settle, type Mode, type ScreenState } from './ux-guards';

const OUT = process.env.AUDIT_OUT;
const THEMES = ['tokyo-night', 'catppuccin', 'gruvbox', 'solarized', 'nord'];
const WIDTHS = [360, 393, 1300] as const;
const STATES: ScreenState[] = ['data', 'empty', 'failed'];

/** Every class the shared UI package defines in a stylesheet: a class outside it is an app class. */
function definedClasses(): string[] {
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.css')) {
        for (const m of readFileSync(p, 'utf8').matchAll(/\.([A-Za-z_][\w-]*)/g))
          out.add(m[1] as string);
      }
    }
  };
  walk(resolve('packages/ui/src'));
  return [...out];
}

interface Finding {
  kind: string;
  rule: string;
  msg: string;
  sev: 'high' | 'medium' | 'low';
  rect?: { x: number; y: number; w: number; h: number } | undefined;
  shot?: string;
}

/** The page-side measures. Runs in the browser: no imports, no outer variables. */
function measurePage(defined: string[]): Finding[] {
  const out: Finding[] = [];
  const add = (f: Finding) => {
    if (out.filter((o) => o.kind === f.kind).length < 12) out.push(f);
  };
  const vis = (e: Element) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return (
      r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
    );
  };
  const rectOf = (e: Element | Range) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
  };
  const name = (e: Element) =>
    e.tagName.toLowerCase() +
    (e.getAttribute('aria-label') ? `[${e.getAttribute('aria-label')}]` : '') +
    ':' +
    (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const inter = (a: DOMRect, b: DOMRect) => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return { w, h };
  };
  const main = document.querySelector('main') ?? document.body;

  // 1. sideways overflow
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth)
    add({
      kind: 'overflow',
      rule: 'UX-16, UX-49',
      sev: 'high',
      msg: `page scrolls sideways (${de.scrollWidth} px in ${de.clientWidth} px)`,
    });
  for (const e of main.querySelectorAll('*')) {
    if (!vis(e) || e.closest('svg')) continue;
    const r = e.getBoundingClientRect();
    if (r.right > innerWidth + 1 && r.width < innerWidth * 3)
      add({
        kind: 'overflow',
        rule: 'UX-16',
        sev: 'high',
        msg: `${name(e)} reaches ${Math.round(r.right)} px, window ${innerWidth} px`,
        rect: rectOf(e),
      });
  }

  // 2. overlapping titles, a pane covering a title, a child sticking out of its pane
  const panes = Array.from(document.querySelectorAll('.ds-pane')).filter(vis);
  const titles = panes
    .map((p) => ({ p, t: p.querySelector(':scope > .ds-pane__title') }))
    .filter((x): x is { p: Element; t: Element } => !!x.t && vis(x.t));
  for (let i = 0; i < titles.length; i++) {
    const a = titles[i] as { p: Element; t: Element };
    for (let j = i + 1; j < titles.length; j++) {
      const b = titles[j] as { p: Element; t: Element };
      const o = inter(a.t.getBoundingClientRect(), b.t.getBoundingClientRect());
      if (o.w > 2 && o.h > 2)
        add({
          kind: 'title-overlap',
          rule: 'CORE-7, UX-10, component 8',
          sev: 'high',
          msg: `titles "${name(a.t)}" and "${name(b.t)}" overlap`,
          rect: rectOf(a.t),
        });
    }
    for (const q of panes) {
      if (q === a.p || q.contains(a.p)) continue;
      const o = inter(a.t.getBoundingClientRect(), q.getBoundingClientRect());
      if (o.w > 2 && o.h > 2)
        add({
          kind: 'pane-covers-title',
          rule: 'CORE-7, UX-10, component 8',
          sev: 'high',
          msg: `${name(q)} covers the title of ${name(a.p)}`,
          rect: rectOf(a.t),
        });
    }
  }
  for (const p of panes) {
    const pr = p.getBoundingClientRect();
    const body = p.querySelector(':scope > .ds-pane__body');
    if (!body) continue;
    for (const c of body.querySelectorAll('*')) {
      if (!vis(c) || c.closest('svg') || getComputedStyle(c).position === 'fixed')
        continue;
      const r = c.getBoundingClientRect();
      if (r.right > pr.right + 1.5 || r.left < pr.left - 1.5)
        add({
          kind: 'pane-overflow',
          rule: 'UX-69, CORE-7',
          sev: 'medium',
          msg: `${name(c)} sticks out of pane "${p.getAttribute('aria-label')}" (${Math.round(r.left)}-${Math.round(r.right)} vs ${Math.round(pr.left)}-${Math.round(pr.right)})`,
          rect: rectOf(c),
        });
    }
  }

  // 3. text over text (line boxes of different text nodes that intersect), words broken inside, words glued
  type Piece = { n: Text; r: DOMRect; el: Element };
  const pieces: Piece[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (
    let n = walker.nextNode() as Text | null;
    n;
    n = walker.nextNode() as Text | null
  ) {
    const el = n.parentElement;
    if (
      !el ||
      !(n.textContent || '').trim() ||
      !vis(el) ||
      el.closest('script, style, svg, .ds-visually-hidden, option')
    )
      continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    pieces.push({ n, r, el });
  }
  for (let i = 0; i < pieces.length; i++) {
    const a = pieces[i] as Piece;
    for (let j = i + 1; j < pieces.length && j < i + 40; j++) {
      const b = pieces[j] as Piece;
      if (a.el === b.el) continue;
      if (
        a.el.closest('.ds-action-bar, .ds-keyhints, .ds-header') ||
        b.el.closest('.ds-action-bar, .ds-keyhints, .ds-header')
      )
        continue;
      const rangeA = document.createRange();
      rangeA.selectNodeContents(a.n);
      const rangeB = document.createRange();
      rangeB.selectNodeContents(b.n);
      for (const ra of rangeA.getClientRects()) {
        for (const rb of rangeB.getClientRects()) {
          const o = inter(ra, rb);
          if (o.w > 3 && o.h > Math.min(ra.height, rb.height) * 0.4)
            add({
              kind: 'text-over-text',
              rule: 'CORE-3, CORE-7',
              sev: 'high',
              msg: `"${(a.n.textContent || '').trim().slice(0, 30)}" is drawn over "${(b.n.textContent || '').trim().slice(0, 30)}"`,
              rect: rectOf(a.el),
            });
        }
      }
    }
  }
  // word broken inside (Re/mo/ve): one word with two line boxes at different tops
  for (const p of pieces) {
    const text = p.n.textContent || '';
    if (p.el.closest('textarea, pre, code, [data-short-text], .ds-short')) continue;
    for (const m of text.matchAll(/\S{3,}/g)) {
      const range = document.createRange();
      range.setStart(p.n, m.index ?? 0);
      range.setEnd(p.n, (m.index ?? 0) + m[0].length);
      const tops = new Set(
        Array.from(range.getClientRects()).map((x) => Math.round(x.top / 4)),
      );
      if (tops.size > 1)
        add({
          kind: 'word-broken',
          rule: 'CORE-3, UX-72',
          sev: 'high',
          msg: `the word "${m[0].slice(0, 30)}" is broken over ${tops.size} lines in ${name(p.el)}`,
          rect: rectOf(p.el),
        });
    }
  }
  // glued: two text pieces of different elements on one line with no gap, neither side a space
  for (let i = 0; i + 1 < pieces.length; i++) {
    const a = pieces[i] as Piece;
    const b = pieces[i + 1] as Piece;
    if (a.el === b.el) continue;
    const ta = a.n.textContent || '';
    const tb = b.n.textContent || '';
    if (!/[\p{L}\p{N}]$/u.test(ta) || !/^[\p{L}\p{N}]/u.test(tb)) continue;
    const sameLine = Math.abs(a.r.top - b.r.top) < a.r.height * 0.5;
    const gap = b.r.left - a.r.right;
    if (sameLine && gap < 3 && gap > -2)
      add({
        kind: 'glued',
        rule: 'CORE-3',
        sev: 'high',
        msg: `"${ta.trim().slice(-20)}" runs into "${tb.trim().slice(0, 20)}" with no space (${name(a.el)} | ${name(b.el)})`,
        rect: rectOf(a.el),
      });
  }

  // 4. buttons: text wraps or clipped
  for (const b of document.querySelectorAll(
    'button, a[data-button], .ds-button, [role=tab]',
  )) {
    if (!vis(b)) continue;
    const cs = getComputedStyle(b);
    const tops = new Set<number>();
    const w2 = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let n = w2.nextNode(); n; n = w2.nextNode()) {
      if (!(n.textContent || '').trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      for (const x of r.getClientRects()) tops.add(Math.round(x.top / 4));
    }
    const isTab = b.getAttribute('role') === 'tab';
    if (tops.size > 1 && !isTab)
      add({
        kind: 'button-wraps',
        rule: 'UX-72, component 7',
        sev: 'high',
        msg: `button ${name(b)} wraps onto ${tops.size} lines`,
        rect: rectOf(b),
      });
    if (b.scrollWidth > b.clientWidth + 1 && cs.overflowX !== 'visible')
      add({
        kind: 'button-clipped',
        rule: 'component 7',
        sev: 'high',
        msg: `button ${name(b)} clips its text (${b.scrollWidth} in ${b.clientWidth} px)`,
        rect: rectOf(b),
      });
  }
  // clipped text anywhere (overflow hidden, no ellipsis)
  for (const e of main.querySelectorAll('*')) {
    if (!vis(e) || e.closest('svg, input, textarea, select')) continue;
    const s = getComputedStyle(e);
    if (
      (s.overflowX === 'hidden' || s.overflowX === 'clip') &&
      e.clientWidth > 4 &&
      e.scrollWidth > e.clientWidth + 1 &&
      s.textOverflow !== 'ellipsis' &&
      (e.textContent || '').trim() &&
      !e.matches('button')
    )
      add({
        kind: 'text-clipped',
        rule: 'CORE-3, UX-49',
        sev: 'medium',
        msg: `${name(e)} cuts its content (${e.scrollWidth} in ${e.clientWidth} px) without an ellipsis`,
        rect: rectOf(e),
      });
  }

  // 5. one primary (UX-4), primary in the action bar (UX-71)
  const primaries = Array.from(
    document.querySelectorAll(
      '[data-primary], button[data-kind=primary], a[data-button][data-kind=primary]',
    ),
  ).filter((e) => vis(e) && !e.closest('[role=dialog]'));
  if (primaries.length > 1)
    add({
      kind: 'primary-count',
      rule: 'UX-4, CORE-5',
      sev: 'medium',
      msg: `${primaries.length} primary buttons: ${primaries.map(name).join(' | ')}`,
      rect: rectOf(primaries[1] as Element),
    });
  for (const p of primaries)
    if (!p.closest('.ds-action-bar'))
      add({
        kind: 'primary-outside-bar',
        rule: 'UX-71, component 48',
        sev: 'low',
        msg: `primary ${name(p)} is not in the action bar`,
        rect: rectOf(p),
      });

  // 6. tables: rows of one height (desktop), row-action words, sideways scroll, status as glyph + word
  const ALLOWED = ['Open run', 'Open', 'Open job', 'Why', 'Details'];
  for (const t of main.querySelectorAll('table')) {
    if (!vis(t)) continue;
    const rows = Array.from(t.querySelectorAll('tbody > tr')).filter(vis);
    if (innerWidth >= 1000 && rows.length > 1) {
      const hs = rows.map((r) => Math.round(r.getBoundingClientRect().height));
      if (Math.max(...hs) - Math.min(...hs) > 2)
        add({
          kind: 'row-heights',
          rule: 'UX-72',
          sev: 'medium',
          msg: `rows of ${name(t.closest('.ds-pane') ?? t)} are ${Math.min(...hs)}-${Math.max(...hs)} px high`,
          rect: rectOf(t),
        });
    }
    if (innerWidth >= 1000)
      for (const r of rows) {
        const last = r.lastElementChild;
        const btn = last?.querySelector('button, a[data-button]');
        const word = (btn?.textContent || '').trim();
        if (btn && word && !ALLOWED.includes(word))
          add({
            kind: 'row-action-word',
            rule: 'UX-72, component 57',
            sev: 'low',
            msg: `row action "${word}" is not in the Row action words (${ALLOWED.join(', ')})`,
            rect: rectOf(btn),
          });
      }
  }
  // status words without a glyph
  const STATUS =
    /^(ok|failed|failing|error|running|waiting|online|offline|active|stopped|paused|pending|queued|done|success|draining|healthy|stale|unknown)$/i;
  for (const e of main.querySelectorAll('td, span, li, dd, p, strong, b, div')) {
    if (
      !vis(e) ||
      e.children.length > 0 ||
      e.closest(
        '.ds-status, button, a, h1, h2, h3, label, option, .ds-chip, .ds-tab, .ds-segmented',
      )
    )
      continue;
    const t = (e.textContent || '').trim();
    if (STATUS.test(t))
      add({
        kind: 'status-no-glyph',
        rule: 'UX-58',
        sev: 'medium',
        msg: `status word "${t}" in ${name(e)} has no glyph or tone`,
        rect: rectOf(e),
      });
  }
  for (const s of document.querySelectorAll('.ds-status')) {
    if (!vis(s)) continue;
    if (
      !s.querySelector('.ds-status__glyph') ||
      !(s.querySelector('.ds-status__word')?.textContent || '').trim()
    )
      add({
        kind: 'status-incomplete',
        rule: 'UX-58',
        sev: 'medium',
        msg: `status ${name(s)} lacks its glyph or word`,
        rect: rectOf(s),
      });
  }

  // 7. cards of one grid: same size, a gap, no lone narrow column
  for (const g of main.querySelectorAll('.ds-card-grid')) {
    const kids = Array.from(g.children).filter(vis);
    if (kids.length < 2) continue;
    const rs = kids.map((k) => k.getBoundingClientRect());
    const w0 = rs[0]?.width ?? 0;
    const h0 = rs[0]?.height ?? 0;
    if (rs.some((r) => Math.abs(r.width - w0) > 1.5))
      add({
        kind: 'cards-unequal',
        rule: 'CORE-7, UX-10',
        sev: 'medium',
        msg: `cards of grid "${name(g.closest('.ds-pane') ?? g)}" have different widths`,
        rect: rectOf(g),
      });
    const rowTops = new Map<number, number[]>();
    rs.forEach((r) =>
      rowTops.set(Math.round(r.top / 8), [
        ...(rowTops.get(Math.round(r.top / 8)) ?? []),
        r.height,
      ]),
    );
    for (const hs of rowTops.values())
      if (Math.max(...hs) - Math.min(...hs) > 2)
        add({
          kind: 'cards-unequal',
          rule: 'CORE-7, UX-51',
          sev: 'medium',
          msg: `cards on one row of grid "${name(g.closest('.ds-pane') ?? g)}" have different heights ${Math.min(...hs)}-${Math.max(...hs)} px`,
          rect: rectOf(g),
        });
    for (let i = 0; i < rs.length; i++)
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i] as DOMRect;
        const b = rs[j] as DOMRect;
        const o = inter(a, b);
        if (o.w > 0 && o.h > 0)
          add({
            kind: 'cards-overlap',
            rule: 'CORE-7',
            sev: 'high',
            msg: `two cards of a grid overlap`,
            rect: rectOf(g),
          });
      }
    void h0;
  }

  // 8. raw controls, inline styles, classes not in packages/ui
  const known = new Set(defined);
  for (const e of main.querySelectorAll('button, input, select, textarea')) {
    if (!vis(e) || e.closest('.ds-pane, .ds-button-wrap, [class*="ds-"]') === null) {
      if (!vis(e)) continue;
    }
    const own = Array.from(e.classList).some((c) => c.startsWith('ds-'));
    const wrapped = !!e.closest('[class*="ds-"]') && own;
    if (!own && !wrapped && !(e as HTMLInputElement).type?.match(/hidden/))
      add({
        kind: 'raw-control',
        rule: 'CORE-2, UX-2',
        sev: 'medium',
        msg: `${e.tagName.toLowerCase()} with no shared class: ${name(e)}`,
        rect: rectOf(e),
      });
  }
  for (const e of document.body.querySelectorAll('[style]')) {
    const st = (e.getAttribute('style') || '').trim();
    // the shared parts set a meter fill or a computed size; a layout or colour value from a page is the breach
    if (
      /^(--[\w-]+:[^;]+;?\s*)+$/.test(st) ||
      /^(inline-size|block-size|width|height|min-block-size|grid-template-columns):[^;]+;?$/.test(
        st,
      )
    )
      continue;
    if (
      /(margin|padding|color|background|display|position|flex|gap|font|border|top|left|right|bottom|z-index)/.test(
        st,
      )
    )
      add({
        kind: 'inline-style',
        rule: 'CORE-2, no-app-CSS',
        sev: 'medium',
        msg: `${name(e)} has style="${st.slice(0, 80)}"`,
        rect: vis(e) ? rectOf(e) : undefined,
      });
  }
  const unknownClasses = new Set<string>();
  for (const e of document.body.querySelectorAll('[class]'))
    for (const c of Array.from(e.classList))
      if (!c.startsWith('ds-') && !known.has(c) && !/^(is-|has-)/.test(c))
        unknownClasses.add(c);
  if (unknownClasses.size > 0)
    add({
      kind: 'undefined-class',
      rule: 'CORE-2, no-app-CSS',
      sev: 'low',
      msg: `classes not defined by packages/ui: ${[...unknownClasses].slice(0, 12).join(', ')}`,
    });

  // 9. contrast (WCAG AA): text colour against the first solid background up the tree
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;
  const rgba = (c: string): [number, number, number, number] => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#000';
    cx.fillStyle = c;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    // the canvas premultiplies: read alpha apart
    return [d[0] as number, d[1] as number, d[2] as number, (d[3] as number) / 255];
  };
  const lum = (c: number[]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return (
      0.2126 * f(c[0] as number) + 0.7152 * f(c[1] as number) + 0.0722 * f(c[2] as number)
    );
  };
  const bgOf = (el: Element): number[] => {
    let base: number[] = [0, 0, 0];
    const stack: [number, number, number, number][] = [];
    for (let e: Element | null = el; e; e = e.parentElement) {
      const c = rgba(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) stack.push(c);
      if (c[3] >= 1) break;
    }
    if (stack.length === 0 || ((stack[stack.length - 1] as number[])[3] as number) < 1)
      base = rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3);
    for (const c of stack.reverse())
      base = [0, 1, 2].map(
        (i) => (c[i] as number) * c[3] + (base[i] as number) * (1 - c[3]),
      );
    return base;
  };
  const seen = new Set<string>();
  for (const p of pieces) {
    const el = p.el;
    if (
      el.closest('[disabled], [aria-disabled=true], .ds-visually-hidden, [data-inactive]')
    )
      continue;
    const s = getComputedStyle(el);
    const fg = rgba(s.color);
    const bg = bgOf(el);
    let op = 1;
    for (let e: Element | null = el; e; e = e.parentElement)
      op *= parseFloat(getComputedStyle(e).opacity);
    const a = fg[3] * op;
    const mix = [0, 1, 2].map((i) => (fg[i] as number) * a + (bg[i] as number) * (1 - a));
    const l1 = lum(mix);
    const l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(s.fontSize);
    const large = size >= 24 || (size >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      const key = `${s.color}|${bg.map(Math.round).join(',')}|${el.className}`;
      if (seen.has(key)) continue;
      seen.add(key);
      add({
        kind: 'contrast',
        rule: 'UX-17, tokens',
        sev: ratio < 3 ? 'medium' : 'low',
        msg: `${name(el)} contrast ${ratio.toFixed(2)}:1 (needs ${need}:1), ${s.color} on rgb(${bg.map(Math.round).join(',')})`,
        rect: rectOf(el),
      });
    }
  }
  return out;
}

/** UX-42 / components 44 and 48: the action bar stays in view while the page scrolls, in a short window. */
async function stickyBar(
  page: Page,
  snap: (tag: string) => Promise<string>,
): Promise<Finding[]> {
  const out: Finding[] = [];
  const has = await page.evaluate(() => !!document.querySelector('.ds-action-bar'));
  if (!has) return out;
  const width = page.viewportSize()?.width ?? 1300;
  await page.setViewportSize({ width, height: 640 });
  await page.waitForTimeout(40);
  const probe = () =>
    page.evaluate(() => {
      const bar = document.querySelector('.ds-action-bar') as HTMLElement;
      const r = bar.getBoundingClientRect();
      const par = bar.parentElement as HTMLElement;
      const pr = par.getBoundingClientRect();
      const main = (
        document.querySelector('main') as HTMLElement
      ).getBoundingClientRect();
      const cs = getComputedStyle(bar);
      const doc = document.documentElement;
      return {
        top: r.top,
        bottom: r.bottom,
        h: innerHeight,
        position: cs.position,
        sticky: bar.dataset.sticky,
        inset: cs.insetBlockEnd,
        scrollable: doc.scrollHeight > innerHeight + 80,
        moreBelow: main.bottom > innerHeight + 4,
        parentTop: pr.top,
        parentBottom: pr.bottom,
        mainBottom: main.bottom,
        barH: r.height,
        parent:
          par.tagName.toLowerCase() +
          '.' +
          String(par.className).split(' ')[0] +
          ' ' +
          Math.round(pr.height) +
          ' px high',
        rect: { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height },
      };
    });
  await page.evaluate(() => scrollTo(0, 0));
  const top = await probe();
  const why = (p: typeof top) =>
    `position ${p.position}, inset-block-end ${p.inset}, data-sticky ${p.sticky}, parent ${p.parent}`;
  // the box the bar sticks inside is shorter than the page: it can only stick inside that box
  if (top.scrollable && top.parentBottom < top.mainBottom - 8)
    out.push({
      kind: 'bar-in-short-parent',
      rule: 'UX-42, UX-71, components 44 and 48',
      sev: 'high',
      msg: `the action bar sticks only inside its parent (${why(top)}), which ends ${Math.round(top.mainBottom - top.parentBottom)} px above the end of the page, so it scrolls away`,
      rect: top.rect,
      shot: await snap('parent'),
    });
  if (top.scrollable && top.parentTop + top.barH <= top.h && top.bottom > top.h + 1)
    out.push({
      kind: 'bar-scrolls-away',
      rule: 'UX-42, UX-71, components 44 and 48',
      sev: 'high',
      msg: `the action bar is below the window at scroll 0 (bottom ${Math.round(top.bottom)} > ${top.h}; ${why(top)})`,
      rect: top.rect,
      shot: await snap('top'),
    });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight / 2));
  await page.waitForTimeout(30);
  const mid = await probe();
  if (
    mid.scrollable &&
    mid.moreBelow &&
    (mid.bottom > mid.h + 1 || mid.top < 0) &&
    !(top.parentBottom < top.mainBottom - 8)
  )
    out.push({
      kind: 'bar-scrolls-away',
      rule: 'UX-42, UX-71, components 44 and 48',
      sev: 'high',
      msg: `the action bar leaves the window when the page is scrolled to the middle (top ${Math.round(mid.top)}, bottom ${Math.round(mid.bottom)}, window ${mid.h}; ${why(mid)})`,
      rect: mid.rect,
      shot: await snap('mid'),
    });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(30);
  const end = await probe();
  if (end.bottom > end.h + 1)
    out.push({
      kind: 'bar-scrolls-away',
      rule: 'UX-42, UX-71',
      sev: 'high',
      msg: `the action bar is below the window at the end of the page (bottom ${Math.round(end.bottom)} > ${end.h}; ${why(end)})`,
      shot: await snap('end'),
    });
  // sticky foot covers the last content?
  const covered = await page.evaluate(() => {
    const bar = document.querySelector('.ds-action-bar') as HTMLElement;
    const br = bar.getBoundingClientRect();
    const hits: string[] = [];
    for (const e of document.querySelectorAll('main *')) {
      if (bar.contains(e) || e.contains(bar) || e.children.length > 0) continue;
      const r = e.getBoundingClientRect();
      if (
        r.width < 6 ||
        r.height < 6 ||
        !(e.textContent || '').trim() ||
        getComputedStyle(e).visibility === 'hidden'
      )
        continue;
      const w = Math.min(r.right, br.right) - Math.max(r.left, br.left);
      const h = Math.min(r.bottom, br.bottom) - Math.max(r.top, br.top);
      if (w > 2 && h > 3) hits.push((e.textContent || '').trim().slice(0, 30));
    }
    return hits.slice(0, 3);
  });
  if (covered.length > 0)
    out.push({
      kind: 'bar-covers-content',
      rule: 'UX-42',
      sev: 'high',
      msg: `the action bar covers the last content: ${covered.join(' | ')}`,
      rect: end.rect,
      shot: await snap('covers'),
    });
  return out;
}

/** UX-17: focus is visible. Tabs through the first controls and judges the focused one. */
async function focusRing(page: Page): Promise<Finding[]> {
  const out: Finding[] = [];
  await page.evaluate(() => scrollTo(0, 0));
  await page.mouse.move(0, 0);
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e || e === document.body) return null;
      const s = getComputedStyle(e);
      const b = e.getBoundingClientRect();
      const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const shadow = s.boxShadow !== 'none';
      const pane =
        !!e.closest('.ds-pane') &&
        getComputedStyle(e.closest('.ds-pane') as Element).borderColor !==
          getComputedStyle(document.body).color;
      const label =
        e.tagName.toLowerCase() +
        ':' +
        (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30);
      return {
        ok: outline || shadow || e.matches('input, textarea, select') || pane,
        label,
        rect: { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height },
        visible: b.width > 0 && b.height > 0,
      };
    });
    if (r && r.visible && !r.ok)
      out.push({
        kind: 'focus-invisible',
        rule: 'UX-17, CORE-4',
        sev: 'medium',
        msg: `focus on ${r.label} shows no outline or glow`,
        rect: r.rect,
      });
  }
  return out;
}

/** Touch targets at phone width (UX-16) */
function touchTargets(): Finding[] {
  const out: Finding[] = [];
  const sel =
    'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=menuitem], [role=checkbox], [role=switch], [role=radio]';
  for (const e of document.querySelectorAll(sel)) {
    let box: Element = e;
    if (e.matches('input[type=checkbox], input[type=radio]'))
      box = e.closest('label') ?? e;
    const r = box.getBoundingClientRect();
    const s = getComputedStyle(box);
    if (
      r.width <= 2 ||
      r.height <= 2 ||
      s.visibility === 'hidden' ||
      s.display === 'none'
    )
      continue;
    if (r.width < 43.5 || r.height < 43.5)
      out.push({
        kind: 'touch-target',
        rule: 'UX-16',
        sev: 'medium',
        msg: `${e.tagName.toLowerCase()}:${(e.textContent || '').trim().slice(0, 25)} is ${Math.round(r.width)}x${Math.round(r.height)} px`,
        rect: { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height },
      });
  }
  return out.slice(0, 8);
}

/** What the page says in the empty and failed states (UX-6, UX-28). */
function stateText(): Finding[] {
  const m = document.querySelector('main') as HTMLElement;
  const st = m.querySelector(
    '.ds-state, [role=alert], .ds-message[data-tone=problem], .ds-message[data-tone=note]',
  );
  const text = (st?.textContent || '').trim().replace(/\s+/g, ' ');
  const rows = m.querySelectorAll('tbody tr, li').length;
  const h1 = (m.querySelector('h1')?.textContent || '').trim();
  return [
    {
      kind: 'state-text',
      rule: 'UX-6, UX-28',
      sev: 'low',
      msg: JSON.stringify({
        h1,
        hasState: !!st,
        rows,
        text: text.slice(0, 160),
        main: (m.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
      }),
    },
  ];
}

function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';
}

async function record(
  page: Page,
  ctx: { route: string; state: string; mode: string; width: number; theme: string },
  found: Finding[],
  shots: Map<string, number>,
) {
  if (!OUT) return;
  for (const f of found) {
    let shot = f.shot ?? '';
    const key = `${ctx.route}|${f.kind}`;
    const taken = shots.get(key) ?? 0;
    if (
      !shot &&
      f.rect &&
      f.kind !== 'state-text' &&
      taken < 1 &&
      (ctx.mode === 'dark' || f.kind === 'contrast') &&
      f.rect.w > 0
    ) {
      shots.set(key, taken + 1);
      const name = `${slug(ctx.route)}__${ctx.state}__${ctx.theme}-${ctx.mode}__${ctx.width}__${f.kind}.png`;
      try {
        const pad = 24;
        const x = Math.max(0, f.rect.x - pad);
        const y = Math.max(0, f.rect.y - pad - 30);
        await page.screenshot({
          path: join(OUT, 'shots', name),
          fullPage: true,
          clip: {
            x,
            y,
            width: Math.min(Math.max(f.rect.w + 2 * pad, 220), 900, ctx.width - x),
            height: Math.min(f.rect.h + 2 * pad + 60, 420),
          },
        });
        shot = name;
      } catch {
        shot = '';
      }
    }
    appendFileSync(
      join(OUT, 'findings.jsonl'),
      JSON.stringify({ ...ctx, ...f, shot }) + '\n',
    );
  }
}

/** Rows a real pool has and the small fixture lacks: a failed runner with a long reason, long names, an offline machine. */
const STRESS_ROUTES = [
  '/',
  '/pool',
  '/pool/machines',
  '/pool/machines/:id',
  '/pool/runners',
  '/pool/runners/:id',
  '/pool/images',
  '/jobs',
  '/repositories',
  '/doctor',
];
const STRESS = {
  runners: [
    runner(),
    runner({
      id: 'r2',
      name: 'crsp-windows-hyperv-averyverylongrunnername-2',
      state: 'failed',
      failed_reason:
        'no usable backend: the docker daemon is not reachable on build-1 and wsl2 is not installed',
      reason:
        'no usable backend: the docker daemon is not reachable on build-1 and wsl2 is not installed',
    }),
    runner({
      id: 'r3',
      name: 'crsp-linux-3',
      state: 'offline',
      reason: 'the machine is offline',
    }),
    runner({ id: 'r4', name: 'crsp-linux-4', state: 'draining' }),
  ],
  machines: [
    machine(),
    machine({
      id: 'm2',
      name: 'a-very-long-machine-name-for-the-lab-rack-07-left-side',
      online: false,
      state: 'drained',
      accepting: false,
      pause_reason: 'paused',
      taking: { taking_jobs: false, reason: 'offline' },
    }),
    machine({
      id: 'm3',
      name: 'win-build-3',
      os: 'windows',
      backends: [
        {
          name: 'wsl2',
          present: true,
          usable: false,
          allowed: false,
          reason: 'virtualisation is turned off in the firmware',
        },
      ],
    }),
  ],
};

const routes = [
  ...consoleRoutes(),
  { pattern: 'not found', url: NOT_FOUND_URL, signedOut: false },
];
const defined = OUT ? definedClasses() : [];

test.describe('design-system audit (RES21)', () => {
  test.skip(!OUT, 'report only: set AUDIT_OUT to run');
  test.setTimeout(240_000);
  if (OUT) mkdirSync(join(OUT, 'shots'), { recursive: true });

  for (const route of routes) {
    test(`audit ${route.pattern}`, async ({ page }) => {
      const shots = new Map<string, number>();
      for (const state of STATES) {
        for (const mode of MODES as readonly Mode[]) {
          for (const width of WIDTHS) {
            const ctx = { route: route.pattern, state, mode, width, theme: 'phosphor' };
            try {
              await openRoute(page, route, { mode, state, width });
              const found = await page.evaluate(measurePage, defined);
              if (state !== 'data') found.push(...(await page.evaluate(stateText)));
              if (state === 'data') {
                if (width === 393) found.push(...(await page.evaluate(touchTargets)));
                if (width === 1300) found.push(...(await focusRing(page)));
                await page.setViewportSize({ width, height: 900 });
                const snap = async (tag: string) => {
                  if (!(OUT && mode === 'dark')) return '';
                  const n = `${slug(route.pattern)}__${state}__phosphor-${mode}__${width}__bar-${tag}.png`;
                  await page.screenshot({ path: join(OUT, 'shots', n) });
                  return n;
                };
                found.push(...(await stickyBar(page, snap)));
              }
              await record(page, ctx, found, shots);
            } catch (e) {
              appendFileSync(
                join(OUT as string, 'findings.jsonl'),
                JSON.stringify({
                  ...ctx,
                  kind: 'audit-error',
                  rule: '',
                  sev: 'low',
                  msg: String(e).slice(0, 200),
                  shot: '',
                }) + '\n',
              );
            }
            await page.unrouteAll({ behavior: 'ignoreErrors' });
          }
        }
      }
    });
    if (STRESS_ROUTES.includes(route.pattern))
      test(`audit stress ${route.pattern}`, async ({ page }) => {
        const shots = new Map<string, number>();
        for (const mode of MODES as readonly Mode[]) {
          for (const width of WIDTHS) {
            const ctx = {
              route: route.pattern,
              state: 'stress',
              mode,
              width,
              theme: 'phosphor',
            };
            try {
              const mock = await openRoute(page, route, { mode, state: 'data', width });
              mock.on('GET', '/api/v1/runners', {
                items: STRESS.runners,
                stale: { stale: false },
              });
              mock.on('GET', '/api/v1/machines', {
                items: STRESS.machines,
                stale: { stale: false },
              });
              await page.reload();
              await settle(page, mode);
              const found = await page.evaluate(measurePage, defined);
              await record(page, ctx, found, shots);
            } catch (e) {
              appendFileSync(
                join(OUT as string, 'findings.jsonl'),
                JSON.stringify({
                  ...ctx,
                  kind: 'audit-error',
                  rule: '',
                  sev: 'low',
                  msg: String(e).slice(0, 200),
                  shot: '',
                }) + '\n',
              );
            }
            await page.unrouteAll({ behavior: 'ignoreErrors' });
          }
        }
      });
    test(`audit themes ${route.pattern}`, async ({ page }) => {
      const shots = new Map<string, number>();
      for (const themeName of THEMES) {
        for (const mode of MODES as readonly Mode[]) {
          const ctx = {
            route: route.pattern,
            state: 'data',
            mode,
            width: 1300,
            theme: themeName,
          };
          try {
            await openRoute(page, route, { mode, state: 'data', width: 1300, themeName });
            const found = (await page.evaluate(measurePage, defined)).filter(
              (f) =>
                f.kind === 'contrast' ||
                f.kind === 'title-overlap' ||
                f.kind === 'text-over-text',
            );
            await record(page, ctx, found, shots);
          } catch (e) {
            appendFileSync(
              join(OUT as string, 'findings.jsonl'),
              JSON.stringify({
                ...ctx,
                kind: 'audit-error',
                rule: '',
                sev: 'low',
                msg: String(e).slice(0, 200),
                shot: '',
              }) + '\n',
            );
          }
          await page.unrouteAll({ behavior: 'ignoreErrors' });
        }
      }
    });
  }
});
