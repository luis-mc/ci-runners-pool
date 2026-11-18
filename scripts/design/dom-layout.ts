/**
 * The DOM layout checker (design system, Enforcement kit). Test-only: Playwright specs import it and it costs
 * nothing at runtime. It checks a rendered page from the DOM (no screenshots, no baseline images) at the three
 * widths every app must work at (360, 393 and 1300 px):
 *  1. no horizontal overflow;
 *  2. consistent gaps between the siblings of one group, each a step of the spacing scale (`--space-0..7`);
 *  3. aligned left edges: the blocks of one column start at the same x;
 *  4. stacked buttons (one under another) share one width;
 *  5. where a rule asks for it, the primary action is in view without scrolling;
 *  6. fields in one visual row share one width class, one box width and one top edge (CORE-7, UX-23);
 *  7. a check box or radio is drawn on the left edge of the field column of its group (CORE-7).
 *
 * Use `expectDomLayout(page, 'library page', { known: KNOWN_LAYOUT_BREACHES, primary: '...' })` in a spec.
 * A screen that breaks a rule today is in `layout.known.json` (loaded as `KNOWN_LAYOUT_BREACHES`) with the task that fixes it. It is a RATCHET:
 * a breach not on the list fails (never weaken a check to pass), and a listed breach that no longer happens
 * fails until its entry is removed, so the list only shrinks.
 *
 * Adjust to the project: the group and button selectors (set `data-layout-group` on a group in the shared UI
 * package, or pass `groups`), and the name of the spacing custom properties (`spaceVar`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LAYOUT_WIDTHS = [
  { width: 360, height: 780 },
  { width: 393, height: 852 },
  { width: 1300, height: 900 },
] as const;

export type LayoutRule =
  | 'overflow'
  | 'gap'
  | 'left-edge'
  | 'button-width'
  | 'primary-in-view'
  | 'field-row'
  | 'check-edge';

/** One known breach: the screen, the width it happens at ('*' for every width), the rule and the task that removes it. */
export interface KnownLayoutBreach {
  readonly screen: string;
  readonly width: number | '*';
  readonly rule: LayoutRule;
  readonly task: string;
}

/** The known list, read from `layout.known.json` (ratchet: remove an entry when its breach is fixed; never add one to pass). */
export const KNOWN_LAYOUT_BREACHES: readonly KnownLayoutBreach[] = (
  JSON.parse(readFileSync(join(import.meta.dirname, 'layout.known.json'), 'utf8')) as {
    entries: KnownLayoutBreach[];
  }
).entries;

export interface DomLayoutOptions {
  /** Selector of the groups whose children are checked. */
  readonly groups?: string;
  /** Selector of the primary action that must be in view without scrolling (where a rule asks for it). */
  readonly primary?: string;
  /** Selector of the buttons (default: buttons and button-like links). */
  readonly buttons?: string;
  /** Prefix of the spacing custom properties; `--space-` means `--space-0` to `--space-7`. */
  readonly spaceVar?: string;
  readonly known?: readonly KnownLayoutBreach[];
  /** Runs before each width is measured (wait for the page to be at rest). */
  readonly ready?: () => Promise<void>;
}

export interface LayoutProblem {
  readonly rule: LayoutRule;
  readonly text: string;
}

const DEFAULT_GROUPS = '[data-layout-group], main > section, main > div';
const DEFAULT_BUTTONS = 'button, [role="button"], a[data-button]';
const DEFAULT_SPACE_VAR = '--space-';

/** The page's own measurement: runs in the browser through `page.evaluate`. Returns the problems found. */
export function domLayoutSource(
  options: Pick<DomLayoutOptions, 'groups' | 'primary' | 'buttons' | 'spaceVar'> = {},
): string {
  return `((cfg) => {
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
    };
    const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
      (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\\s+/).slice(0, 3).join('.') : '');
    const problems = [];
    const add = (rule, text) => problems.push({ rule, text });
    const root = document.documentElement;
    const probe = document.createElement('i');
    probe.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0';
    document.body.appendChild(probe);
    const scale = [];
    for (let n = 0; n <= 7; n++) {
      probe.style.paddingLeft = 'var(' + cfg.spaceVar + n + ')';
      scale.push(parseFloat(getComputedStyle(probe).paddingLeft) || 0);
    }
    probe.remove();
    const onScale = (px) => scale.some((s) => Math.abs(s - px) <= 1);
    const sameRow = (a, b) => a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const heading = (e) => /^H[1-6]$/.test(e.tagName);

    // 1. no horizontal overflow
    if (root.scrollWidth > root.clientWidth) add('overflow', 'the page scrolls sideways (' + root.scrollWidth + ' px in ' + root.clientWidth + ' px)');

    // 2 and 3. gaps and left edges inside each group
    const seen = new Set();
    for (const box of Array.from(document.querySelectorAll(cfg.groups)).filter(visible)) {
      if (seen.has(box)) continue;
      seen.add(box);
      const display = getComputedStyle(box).display;
      if (display === 'inline' || display === 'table-row') continue;
      const kids = Array.from(box.children).filter(visible).filter((k) => getComputedStyle(k).position !== 'absolute' && getComputedStyle(k).position !== 'fixed')
        // The action bar sits at the foot of the window on purpose (UX-71): the free space above it is not a gap.
        .filter((k) => !k.classList.contains('ds-action-bar'));
      // Gaps are measured in the order the eye reads: a flex item with a CSS order (the phone action bar puts the
      // primary above the secondary) sits where its order says, not where the markup has it.
      const order = (k) => parseInt(getComputedStyle(k).order, 10) || 0;
      kids.sort((x, y) => order(x) - order(y));
      if (kids.length < 2) continue;
      const rects = kids.map((k) => k.getBoundingClientRect());
      const vertical = [];
      const horizontal = [];
      for (let i = 1; i < kids.length; i++) {
        const a = rects[i - 1];
        const b = rects[i];
        if (sameRow(a, b)) {
          horizontal.push({ gap: b.left - a.right, at: name(kids[i - 1]) + ' | ' + name(kids[i]) });
        } else if (!heading(kids[i - 1]) && !heading(kids[i])) {
          vertical.push({ gap: b.top - a.bottom, at: name(kids[i - 1]) + ' then ' + name(kids[i]) });
        }
      }
      for (const [axis, list] of [['vertical', vertical], ['horizontal', horizontal]]) {
        const real = list.filter((g) => g.gap >= -1);
        const bad = real.filter((g) => !onScale(g.gap));
        for (const g of bad.slice(0, 3)) add('gap', 'gap ' + Math.round(g.gap) + ' px is not a spacing step in ' + name(box) + ' (' + axis + '): ' + g.at);
        const first = real[0];
        const odd = first ? real.filter((g) => Math.abs(g.gap - first.gap) > 1) : [];
        for (const g of odd.slice(0, 3)) add('gap', 'uneven ' + axis + ' gaps in ' + name(box) + ': ' + Math.round(first.gap) + ' px and ' + Math.round(g.gap) + ' px (' + g.at + ')');
      }
      // blocks of one column: the kids that sit one under the other start at the same x
      const stacked = kids.filter((k, i) => !rects.some((r, j) => j !== i && sameRow(r, rects[i]) && r.width + rects[i].width < box.getBoundingClientRect().width + 1));
      if (stacked.length > 1) {
        const x0 = stacked[0].getBoundingClientRect().left;
        for (const k of stacked.slice(1)) {
          const x = k.getBoundingClientRect().left;
          if (Math.abs(x - x0) > 1 && getComputedStyle(k).display !== 'inline') add('left-edge', name(k) + ' starts ' + Math.round(x - x0) + ' px from the column in ' + name(box));
        }
      }
    }

    // 4. stacked buttons share one width
    const parents = new Map();
    for (const b of Array.from(document.querySelectorAll(cfg.buttons)).filter(visible)) {
      if (b.parentElement && getComputedStyle(b).display !== 'inline') parents.set(b.parentElement, [...(parents.get(b.parentElement) || []), b]);
    }
    for (const [parent, buttons] of parents) {
      if (buttons.length < 2) continue;
      const rs = buttons.map((b) => b.getBoundingClientRect());
      const stacked = buttons.filter((b, i) => rs.every((r, j) => j === i || !sameRow(r, rs[i])));
      if (stacked.length === buttons.length && stacked.length > 1) {
        const w0 = rs[0].width;
        buttons.forEach((b, i) => {
          if (Math.abs(rs[i].width - w0) > 1) add('button-width', 'stacked buttons differ in width in ' + name(parent) + ': ' + name(buttons[0]) + ' ' + Math.round(w0) + ' px, ' + name(b) + ' ' + Math.round(rs[i].width) + ' px');
        });
      }
    }

    // 6 and 7. fields in one row share width class, box width and top line; check boxes share the field column
    const boxOf = (f) => f.querySelector('input:not([type=checkbox]):not([type=radio]), select, textarea, .ds-number');
    const drawnLeft = (c) => {
      const r = c.getBoundingClientRect();
      const w = parseFloat(getComputedStyle(c, '::before').width);
      return Number.isFinite(w) ? r.left + (r.width - w) / 2 : r.left;
    };
    const seenRows = new Set();
    for (const box of Array.from(document.querySelectorAll(cfg.groups)).filter(visible)) {
      if (seenRows.has(box)) continue;
      seenRows.add(box);
      const kids = Array.from(box.children).filter(visible);
      const fields = kids.filter((k) => k.classList.contains('ds-field') && boxOf(k) && visible(boxOf(k)));
      const done = new Set();
      for (const f of fields) {
        if (done.has(f)) continue;
        const fr = f.getBoundingClientRect();
        const row = fields.filter((g) => sameRow(g.getBoundingClientRect(), fr));
        row.forEach((g) => done.add(g));
        if (row.length < 2) continue;
        const b0 = boxOf(row[0]).getBoundingClientRect();
        for (const g of row.slice(1)) {
          const b = boxOf(g).getBoundingClientRect();
          if (g.dataset.width !== row[0].dataset.width) add('field-row', 'fields side by side differ in width class in ' + name(box) + ': ' + (row[0].dataset.width || 'none') + ' and ' + (g.dataset.width || 'none'));
          if (Math.abs(b.width - b0.width) > 1) add('field-row', 'boxes side by side differ in width in ' + name(box) + ': ' + Math.round(b0.width) + ' px and ' + Math.round(b.width) + ' px');
          if (Math.abs(b.top - b0.top) > 1) add('field-row', 'boxes side by side start at different heights in ' + name(box) + ': ' + Math.round(b0.top) + ' px and ' + Math.round(b.top) + ' px');
        }
      }
      const column = fields.length ? Math.min(...fields.map((g) => g.getBoundingClientRect().left)) : null;
      if (column !== null) {
        for (const k of kids) {
          const c = k.matches('.ds-choice__row') ? k.querySelector(':scope > input[type=checkbox], :scope > input[type=radio]') : null;
          if (!c || k.hasAttribute('data-card') || k.hasAttribute('data-structured')) continue;
          const x = drawnLeft(c);
          if (Math.abs(x - column) > 1) add('check-edge', 'a check box or radio starts ' + Math.round(x - column) + ' px from the field column in ' + name(box));
        }
      }
    }

    // 5. the primary action in view without scrolling
    if (cfg.primary) {
      const target = Array.from(document.querySelectorAll(cfg.primary)).find(visible);
      if (!target) add('primary-in-view', 'no visible primary action matches ' + cfg.primary);
      else {
        const r = target.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) add('primary-in-view', 'the primary action ' + name(target) + ' is not in view (' + Math.round(r.top) + '..' + Math.round(r.bottom) + ' of ' + window.innerHeight + ' px)');
      }
    }
    return problems;
  })(${JSON.stringify({
    groups: options.groups ?? DEFAULT_GROUPS,
    primary: options.primary ?? null,
    buttons: options.buttons ?? DEFAULT_BUTTONS,
    spaceVar: options.spaceVar ?? DEFAULT_SPACE_VAR,
  })})`;
}

/** The part of a Playwright page the checker needs (so this file imports nothing). */
export interface PageLike {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  evaluate<T>(source: string): Promise<T>;
}

/** Measure a page at 360, 393 and 1300 px; every problem found, with its width. */
export async function measureDomLayout(
  page: PageLike,
  options: DomLayoutOptions = {},
): Promise<{ width: number; rule: LayoutRule; text: string }[]> {
  const found: { width: number; rule: LayoutRule; text: string }[] = [];
  for (const size of LAYOUT_WIDTHS) {
    await page.setViewportSize(size);
    await options.ready?.();
    for (const p of await page.evaluate<LayoutProblem[]>(domLayoutSource(options)))
      found.push({ width: size.width, ...p });
  }
  return found;
}

/** Split the problems into the unknown ones (fail) and the known list entries that no longer happen (fail). */
export function judgeLayout(
  screen: string,
  found: readonly { width: number; rule: LayoutRule; text: string }[],
  known: readonly KnownLayoutBreach[] = KNOWN_LAYOUT_BREACHES,
): { unknown: string[]; stale: string[] } {
  const mine = known.filter((k) => k.screen === screen);
  const matches = (
    k: KnownLayoutBreach,
    p: { width: number; rule: LayoutRule },
  ): boolean => k.rule === p.rule && (k.width === '*' || k.width === p.width);
  const unknown = found
    .filter((p) => !mine.some((k) => matches(k, p)))
    .map((p) => `${screen} at ${p.width} px [${p.rule}]: ${p.text}`);
  const stale = mine
    .filter((k) => !found.some((p) => matches(k, p)))
    .map(
      (k) =>
        `${screen}: known ${k.rule} breach at ${k.width} px (${k.task}) no longer happens: remove it from layout.known.json`,
    );
  return { unknown, stale };
}

/** The one call a spec makes: measure at the three widths and fail on an unknown breach or a stale entry. */
export async function expectDomLayout(
  page: PageLike,
  screen: string,
  options: DomLayoutOptions = {},
): Promise<void> {
  const found = await measureDomLayout(page, options);
  const { unknown, stale } = judgeLayout(
    screen,
    found,
    options.known ?? KNOWN_LAYOUT_BREACHES,
  );
  const problems = [...unknown, ...stale];
  if (problems.length > 0)
    throw new Error(`DOM layout (design system, Enforcement):\n${problems.join('\n')}`);
}
