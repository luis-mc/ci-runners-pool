// Part of component 38: page-level arrow navigation (UX-57). Down and Up move focus through every button, link, input
// and list item of the page in page order. `j` and `k` do the same unless the user is typing. Inside a group of
// radios Up and Down still leave the group; Left and Right move along any horizontal row (RowKeys.ts). In a multi-line text box
// Up and Down move the text cursor. Focus moves only when the user presses a key (UX-35).
import { useEffect, type ReactNode } from 'react';
import { handleRowKey } from './RowKeys';

const STOPS =
  'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [data-list-row], [contenteditable=""], [contenteditable="true"]';

const TEXT_INPUTS = new Set(['', 'text', 'search', 'email', 'password', 'url', 'tel']);
/** Inputs whose arrow keys change their own value: a slider, a number, a date. */
const OWN_ARROWS = new Set([
  'range',
  'number',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
]);

function inputType(el: Element): string {
  return el instanceof HTMLInputElement
    ? (el.getAttribute('type') ?? '').toLowerCase()
    : '';
}

/** A box the user types letters into: `j` and `k` are text there, not movement. */
export function isTextEntry(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement)
    return TEXT_INPUTS.has(inputType(el)) || OWN_ARROWS.has(inputType(el));
  return (
    el.isContentEditable ||
    el.getAttribute('contenteditable') === 'true' ||
    el.getAttribute('role') === 'textbox'
  );
}

/** A control that uses Up and Down itself: a multi-line box, a drop-down, a slider, a number. */
function ownsVerticalArrows(el: HTMLElement): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return OWN_ARROWS.has(inputType(el));
  const role = el.getAttribute('role');
  if (
    role === 'slider' ||
    role === 'spinbutton' ||
    role === 'listbox' ||
    role === 'combobox'
  )
    return true;
  return (
    el.isContentEditable ||
    el.getAttribute('contenteditable') === 'true' ||
    el.getAttribute('aria-multiline') === 'true'
  );
}

function hidden(el: HTMLElement): boolean {
  if (el.closest('[inert], [hidden], [aria-hidden="true"]')) return true;
  if (el instanceof HTMLInputElement && inputType(el) === 'hidden') return true;
  if ((el as HTMLButtonElement).disabled) return true;
  if (el.matches(':disabled')) return true;
  // Not drawn: no box, or hidden by style.
  if (typeof el.getClientRects === 'function' && !isJsdom()) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return true;
    if (getComputedStyle(el).visibility === 'hidden') return true;
  }
  // A member of a roving group (an inactive tab, a stepper button) is reached with the group's own keys.
  if (el.getAttribute('tabindex') === '-1' && !el.hasAttribute('data-list-row'))
    return true;
  return false;
}

/** jsdom lays nothing out, so every box is empty there. */
function isJsdom(): boolean {
  return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
}

/** The stops of the page in page order. A group of radios is one stop: its chosen radio, else its first. */
export function focusStops(root: ParentNode = document): HTMLElement[] {
  const groupStop = new Map<string, HTMLInputElement>();
  for (const r of Array.from(
    root.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
  )) {
    if (hidden(r) || !r.name) continue;
    const cur = groupStop.get(r.name);
    if (!cur || (r.checked && !cur.checked)) groupStop.set(r.name, r);
  }
  return Array.from(root.querySelectorAll<HTMLElement>(STOPS)).filter((el) => {
    if (hidden(el)) return false;
    if (el instanceof HTMLInputElement && inputType(el) === 'radio' && el.name)
      return groupStop.get(el.name) === el;
    return true;
  });
}

/** The stop in `dir` from `from`, or undefined at the first and last stop. */
export function nextStop(
  from: Element | null,
  dir: 1 | -1,
  root: ParentNode = document,
): HTMLElement | undefined {
  const stops = focusStops(root);
  if (!from) return dir === 1 ? stops[0] : stops[stops.length - 1];
  let at = stops.indexOf(from as HTMLElement);
  if (
    at < 0 &&
    from instanceof HTMLInputElement &&
    inputType(from) === 'radio' &&
    from.name
  )
    at = stops.findIndex(
      (s) =>
        s instanceof HTMLInputElement && inputType(s) === 'radio' && s.name === from.name,
    );
  if (at >= 0) return stops[at + dir];
  // Not a stop itself: go from its place in the page.
  const after = (s: HTMLElement) =>
    Boolean(from.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
  if (dir === 1) return stops.find(after);
  return [...stops].reverse().find((s) => !after(s) && !s.contains(from));
}

/**
 * Handle one key event. Returns true when it moved focus (or held it at the first or last stop).
 * Down, `j`: next stop. Up, `k`: previous stop. `j` and `k` type in a text box.
 */
export function handleNavigationKey(
  e: KeyboardEvent,
  root: ParentNode = document,
): boolean {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)
    return false;
  const down = e.key === 'ArrowDown' || e.key === 'j';
  const up = e.key === 'ArrowUp' || e.key === 'k';
  if (!down && !up) return false;
  const target = e.target instanceof Element ? (e.target as HTMLElement) : null;
  const letter = e.key === 'j' || e.key === 'k';
  if (letter && isTextEntry(target)) return false;
  if (!letter && target && ownsVerticalArrows(target)) return false;
  const from = target && target !== document.body ? target : null;
  const to = nextStop(from, down ? 1 : -1, root);
  e.preventDefault();
  if (to) to.focus();
  return true;
}

/** Mount once in the shell: every page gets the arrow movement. */
export function ArrowNavigation({ children }: { children?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!handleRowKey(e)) handleNavigationKey(e);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return <>{children}</>;
}
