// Part of component 38: arrow keys along a horizontal row (UX-57). Left and Right move to the previous and next item
// of a tab row, a segment or chip row, the top menu, a toolbar or a group of radios; they wrap at the ends, and Home
// and End go to the first and last. A tab row and a group of radios also choose the item they land on (the WAI-ARIA
// tabs and radiogroup patterns); a segment row, chips, the top menu and a toolbar only move focus (the toolbar
// pattern). Up and Down are not handled here.

const ROWS =
  '[role="tablist"], [role="toolbar"], [role="radiogroup"], .ds-tabs, .ds-segmented, .ds-chips, .ds-topmenu__list, [role="group"][data-layout-group]';
const ITEMS = '[role="tab"], button, a[href], input[type="radio"]';

function usable(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled) return false;
  return !el.closest('[inert], [hidden], [aria-hidden="true"]');
}

function radioGroup(r: HTMLInputElement): HTMLInputElement[] {
  const scope = r.form ?? r.getRootNode();
  const all = (scope as ParentNode).querySelectorAll<HTMLInputElement>(
    'input[type="radio"]',
  );
  return Array.from(all).filter((x) => x.name === r.name && usable(x));
}

/** The items of the row `target` sits in, and whether landing on one chooses it. */
function rowOf(target: Element): { items: HTMLElement[]; choose: boolean } | null {
  if (target instanceof HTMLInputElement && target.type === 'radio') {
    return target.name ? { items: radioGroup(target), choose: true } : null;
  }
  const row = target.closest<HTMLElement>(ROWS);
  if (!row) return null;
  const tabs = target.getAttribute('role') === 'tab';
  const items = Array.from(row.querySelectorAll<HTMLElement>(ITEMS)).filter(
    (el) =>
      usable(el) &&
      (!tabs || el.getAttribute('role') === 'tab') &&
      !(el instanceof HTMLInputElement && el.type !== 'radio'),
  );
  return { items, choose: tabs };
}

/** Handle one key event. Returns true when it moved along a row (or held at its only item). */
export function handleRowKey(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)
    return false;
  const k = e.key;
  if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End')
    return false;
  // An Element, not an HTMLElement: the target may be an SVG shape inside a button.
  const hit = e.target instanceof Element ? e.target : null;
  if (!hit) return false;
  const target: Element =
    hit instanceof HTMLElement ? hit : (hit.closest<HTMLElement>(ITEMS) ?? hit);
  const row = rowOf(target);
  if (!row || row.items.length === 0) return false;
  const at = row.items.indexOf(target as HTMLElement);
  if (at < 0) return false;
  const n = row.items.length;
  let to: number;
  if (k === 'ArrowRight') to = (at + 1) % n;
  else if (k === 'ArrowLeft') to = (at - 1 + n) % n;
  else if (k === 'Home') to = 0;
  else to = n - 1;
  e.preventDefault();
  const next = row.items[to];
  if (!next) return true;
  next.focus();
  if (row.choose && next !== target) {
    next.click();
    keepFocus(next, to);
  }
  return true;
}

/**
 * Choosing an item can redraw the row (a tab that changes the address draws the page again). For half a second, if
 * focus is lost in that redraw, put it back on the item at the same place in the same row. Focus the user moved to
 * another control is left alone.
 */
let keeping = 0;
function keepFocus(next: HTMLElement, index: number): void {
  const mine = ++keeping; // a newer choice ends the older watch
  const label = next.closest<HTMLElement>(ROWS)?.getAttribute('aria-label') ?? null;
  const name = next instanceof HTMLInputElement ? next.name : null;
  const text = next.textContent;
  const find = (): HTMLElement | undefined => {
    if (next.isConnected) return next;
    let items: HTMLElement[] = [];
    if (name) {
      items = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
      ).filter((x) => x.name === name);
    } else if (label !== null) {
      const row = Array.from(document.querySelectorAll<HTMLElement>(ROWS)).find(
        (r) => r.getAttribute('aria-label') === label,
      );
      items = row
        ? Array.from(row.querySelectorAll<HTMLElement>(ITEMS)).filter(usable)
        : [];
    }
    return items.find((x) => x.textContent === text) ?? items[index];
  };
  let frames = 0;
  const check = () => {
    if (mine !== keeping) return;
    const now = document.activeElement;
    if (!now || now === document.body || !document.contains(now)) find()?.focus();
    if (++frames < 30) requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}
