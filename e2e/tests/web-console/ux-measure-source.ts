// LOOK35 (RES21 T8): the measures that read text lines and boxes. Each is a function body run in the page that
// returns a list of problem lines; ux-guards.ts runs them with `measure`. They come from the RES21 audit spec
// (docs/review/RES21/ds-audit.spec.ts on origin/RES21-design-system-audit) and are the permanent guards of the
// classes every older guard missed: a button label on two lines, a word broken inside, text over text, text over a
// pane border, words glued, rows of one table with different heights, a row action word that content.md does not list.
import { readFileSync } from 'node:fs';

export const VISIBLE = `const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
const label = (e) => e.tagName.toLowerCase() + (e.getAttribute('aria-label') ? '[' + e.getAttribute('aria-label') + ']' : '') + ':' + (e.textContent || e.getAttribute('name') || '').trim().replace(/\\s+/g, ' ').slice(0, 30);`;

/** The words a table row action may use: the first column of the Row action words table of content.md (UX-72). */
export function rowActionWords(): string[] {
  const text = readFileSync('docs/design-system/next-version/content.md', 'utf8');
  const at = text.indexOf('### Row action words');
  if (at < 0) throw new Error('content.md has no Row action words section');
  const words = new Set<string>();
  const lines = text.slice(at).split('\n');
  const head = lines.findIndex((l) => l.startsWith('| Word'));
  for (const line of lines.slice(head + 2)) {
    if (!line.startsWith('|')) break;
    for (const w of (line.split('|')[1] ?? '').split(',')) words.add(w.trim());
  }
  return [...words];
}

/** Collects the visible text boxes of the page, one per text node line, clipped to their scrolling parents. */
const TEXT_BOXES = String.raw`${VISIBLE}
  const floating = (e) => { for (let x = e; x; x = x.parentElement) { const p = getComputedStyle(x).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  const hiddenText = (e) => !!e.closest('.ds-visually-hidden, .sr-only, .ds-short');
  const clipTo = (r, el) => {
    let left = r.left, right = r.right, top = r.top, bottom = r.bottom;
    for (let x = el; x && x !== document.body; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const b = x.getBoundingClientRect();
      if (s.overflowX !== 'visible') { left = Math.max(left, b.left); right = Math.min(right, b.right); }
      if (s.overflowY !== 'visible') { top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); }
    }
    return right - left > 2 && bottom - top > 2 ? { left, right, top, bottom, width: right - left, height: bottom - top } : null;
  };
  const boxes = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.textContent || '';
    if (!t.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('script, style, noscript, option, svg') || !visible(el) || hiddenText(el) || floating(el)) continue;
    if (getComputedStyle(el).opacity === '0') continue;
    const rg = document.createRange();
    rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) {
      const c = clipTo(r, el);
      if (c) boxes.push({ el, r: c, text: t.trim().slice(0, 30), raw: t });
    }
  }
  const inter = (a, b) => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? { w, h } : null;
  };`;

/** The element kinds whose label must stay on one line: buttons, links drawn as buttons, tabs, chips, badges. */
const LABELLED = `'button, a[data-button], [role=tab], .ds-chip, .ds-badge, .ds-tag'`;

export const TEXT_MEASURES = {
  /** UX-72, component 7, component 12: a button or chip label is on one line. */
  wrapped: String.raw`${VISIBLE}
    const bad = [];
    const block = (e) => ['block', 'flex', 'grid', 'table', 'list-item', 'flow-root'].includes(getComputedStyle(e).display);
    for (const b of document.querySelectorAll(${LABELLED})) {
      if (!visible(b) || b.closest('thead')?.getBoundingClientRect().width <= 2) continue;
      if (Array.from(b.querySelectorAll('*')).some(block)) continue; // a button that holds a card is not a label
      const rects = [];
      const walk = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!(n.textContent || '').trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        for (const r of rg.getClientRects()) if (r.width > 1) rects.push(r);
      }
      rects.sort((x, y) => x.top - y.top);
      let lines = 0, end = -Infinity;
      for (const r of rects) { if (r.top >= end - 2) { lines++; end = r.bottom; } else end = Math.max(end, r.bottom); }
      if (lines > 1) bad.push(label(b) + ' wraps onto ' + lines + ' lines');
    }
    return bad;`,
  /** UX-3, UX-72: no word is broken inside, in a button or chip (any run of 3 characters) or in text (a run of 4 letters). */
  wordBroken: String.raw`${TEXT_BOXES}
    const bad = [];
    const seen = new Set();
    const lines = (rg) => new Set(Array.from(rg.getClientRects()).filter((r) => r.width > 1).map((r) => Math.round(r.top / 4))).size;
    const labelled = Array.from(document.querySelectorAll(${LABELLED})).filter(visible);
    let checked = 0;
    for (const b of labelled) {
      const walk = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const t = n.textContent || '';
        const rg = document.createRange();
        for (const m of t.matchAll(/\S{3,}/g)) {
          rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
          if (lines(rg) > 1) { bad.push('"' + m[0] + '" in ' + label(b) + ' is broken over lines'); seen.add(n); }
        }
      }
    }
    for (const tb of boxes) {
      if (tb.el.closest(${LABELLED}) || checked > 3000) continue;
      const n = Array.from(tb.el.childNodes).find((c) => c.nodeType === 3 && (c.textContent || '').trim().startsWith(tb.text));
      if (!n || seen.has(n)) continue;
      seen.add(n);
      const rg = document.createRange();
      for (const m of (n.textContent || '').matchAll(/[A-Za-z]{4,}/g)) {
        checked++;
        rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
        if (lines(rg) > 1) { bad.push('"' + m[0] + '" in ' + label(tb.el) + ' is broken over lines'); break; }
      }
    }
    return bad;`,
  /** CORE-7, UX-10, UX-51: no text box covers another text box. The bars that float over the page and the middle-cut ShortText are not judged. */
  textOverText: String.raw`${TEXT_BOXES}
    const bad = [];
    const seen = new Set();
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const x = inter(a.r, b.r);
      if (!x) continue;
      if (x.w < 0.3 * Math.min(a.r.width, b.r.width) || x.h < 0.4 * Math.min(a.r.height, b.r.height)) continue;
      const key = a.text + '|' + b.text;
      if (seen.has(key)) continue;
      seen.add(key);
      bad.push('"' + a.text + '" (' + label(a.el) + ') overlaps "' + b.text + '" (' + label(b.el) + ')');
    }
    return bad;`,
  /** CORE-7, UX-51: no text crosses the border of a pane (the pane's own title and actions sit in the border by design). */
  textOverBorder: String.raw`${TEXT_BOXES}
    const bad = [];
    const seen = new Set();
    for (const p of document.querySelectorAll('.ds-pane')) {
      if (!visible(p)) continue;
      const r = p.getBoundingClientRect();
      const lines = [
        { left: r.left, right: r.right, top: r.top - 1, bottom: r.top + 1 },
        { left: r.left, right: r.right, top: r.bottom - 1, bottom: r.bottom + 1 },
        { left: r.left - 1, right: r.left + 1, top: r.top, bottom: r.bottom },
        { left: r.right - 1, right: r.right + 1, top: r.top, bottom: r.bottom },
      ];
      for (const t of boxes) {
        if (t.r.height < 4 || !p.contains(t.el) && !lines.some((l) => inter(t.r, l))) continue;
        const own = t.el.closest('.ds-pane__title, .ds-pane__actions, .ds-pane__count, .ds-pane__head');
        if (own && own.closest('.ds-pane') === p) continue;
        for (const l of lines) {
          const x = inter(t.r, l);
          if (x && x.h > 0.4 * Math.min(t.r.height, l.bottom - l.top) && x.w > 0.3 * Math.min(t.r.width, l.right - l.left)) {
            const key = t.text + '|' + (p.getAttribute('aria-label') || '');
            if (!seen.has(key)) { seen.add(key); bad.push('"' + t.text + '" crosses the border of pane ' + (p.getAttribute('aria-label') || label(p))); }
            break;
          }
        }
      }
    }
    return bad;`,
  /** UX-3, CORE-3: two inline texts on one line with under 1.2 px between them and letters on both sides are glued words. */
  wordsGlued: String.raw`${TEXT_BOXES}
    const bad = [];
    const ordered = boxes.filter((t) => !t.el.closest('.ds-caret, [aria-hidden=true], pre, code, kbd'));
    for (let i = 0; i + 1 < ordered.length; i++) {
      const a = ordered[i], b = ordered[i + 1];
      if (a.el === b.el) continue;
      const sameLine = Math.abs(a.r.top - b.r.top) < 4 && Math.abs(a.r.height - b.r.height) < 8;
      const gap = b.r.left - a.r.right;
      if (!sameLine || gap > 1.2 || gap < -1) continue;
      if (/[A-Za-z0-9]$/.test(a.raw) && /^[A-Za-z0-9]/.test(b.raw) && !getComputedStyle(a.el).display.startsWith('flex'))
        bad.push('"' + a.raw.slice(-14) + '" touches "' + b.raw.slice(0, 14) + '" (gap ' + gap.toFixed(1) + ' px)');
    }
    return bad;`,
  /** UX-72: at desktop width every row of one table has one height. */
  rowHeights: String.raw`${VISIBLE}
    if (window.innerWidth < 1000) return [];
    const bad = [];
    let n = 0;
    for (const t of document.querySelectorAll('main table')) {
      n++;
      if (!visible(t) || t.closest('.ds-table__expanded')) continue;
      const rows = Array.from(t.tBodies[0] ? t.tBodies[0].rows : []).filter((r) => visible(r) && !r.classList.contains('ds-table__expanded'));
      if (rows.length < 2) continue;
      const heights = rows.map((r) => Math.round(r.getBoundingClientRect().height));
      if (Math.max(...heights) - Math.min(...heights) > 2)
        bad.push('table #' + n + ' (' + ((t.querySelector('caption') || {}).textContent || 'no caption').trim().slice(0, 30) + ') rows are ' + heights.join('/') + ' px high');
    }
    return bad;`,
};

/** UX-72: the buttons in the last column of every table row use a word of content.md Row action words. */
export function rowActionWordsMeasure(allowed: readonly string[]): string {
  return String.raw`${VISIBLE}
    const allowed = ${JSON.stringify(allowed)};
    const bad = [];
    const seen = new Set();
    let n = 0;
    for (const t of document.querySelectorAll('main table')) {
      n++;
      if (!visible(t) || t.closest('.ds-table__expanded')) continue;
      for (const r of (t.tBodies[0] ? t.tBodies[0].rows : [])) {
        if (!visible(r) || r.classList.contains('ds-table__expanded')) continue;
        const last = Array.from(r.cells).filter(visible).pop();
        for (const b of last ? last.querySelectorAll('button, a[data-button]') : []) {
          const word = (b.textContent || '').trim();
          if (!word || allowed.includes(word) || seen.has(n + word)) continue;
          seen.add(n + word);
          bad.push('table #' + n + ' last-column button "' + word + '" is not a Row action word of content.md');
        }
      }
    }
    return bad;`;
}
