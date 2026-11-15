// Keyboard first (UX-57, R5.5). Ctrl/Cmd+K opens the palette; `/` goes to the search bar; j and k move down and
// up a list; Enter opens the row; `?` lists every shortcut. None fires while typing in a field.
export const SHORTCUTS: readonly { keys: string; does: string }[] = [
  { keys: 'Ctrl+K', does: 'Open the command palette (Cmd+K on macOS)' },
  { keys: '/', does: "Go to the page's search bar" },
  { keys: 'j', does: 'Move down a list' },
  { keys: 'k', does: 'Move up a list' },
  { keys: 'Enter', does: 'Open the chosen row' },
  { keys: '?', does: 'List every shortcut' },
  { keys: 'Escape', does: 'Close a dialog' },
];

/** The key-hint bar at the page foot (UX-57). */
export const KEY_HINTS: readonly { keys: string; does: string }[] = [
  { keys: '/', does: 'search' },
  { keys: 'j k', does: 'move' },
  { keys: 'Enter', does: 'open' },
  { keys: '?', does: 'keys' },
];

export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    target.getAttribute('role') === 'textbox'
  );
}

export interface ShortcutHandlers {
  openPalette: () => void;
  openHelp: () => void;
}

/** Handle one key event. Returns true when it was a shortcut. */
export function handleKey(
  e: KeyboardEvent,
  h: ShortcutHandlers,
  root: ParentNode = document,
): boolean {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    h.openPalette();
    return true;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (isTyping(e.target)) return false;
  if (e.key === '?') {
    e.preventDefault();
    h.openHelp();
    return true;
  }
  if (e.key === '/') {
    const bar = root.querySelector<HTMLElement>('[data-search]');
    if (bar) {
      e.preventDefault();
      bar.focus();
      return true;
    }
    return false;
  }
  if (e.key === 'j' || e.key === 'k') {
    const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-list-row]'));
    if (rows.length === 0) return false;
    const at = rows.findIndex(
      (r) => r === document.activeElement || r.contains(document.activeElement),
    );
    const next =
      e.key === 'j'
        ? Math.min(rows.length - 1, at + 1)
        : Math.max(0, at <= 0 ? 0 : at - 1);
    rows[next]?.focus();
    e.preventDefault();
    return true;
  }
  if (e.key === 'Enter') {
    const row = document.activeElement;
    if (row instanceof HTMLElement && row.hasAttribute('data-list-row')) {
      const link = row.querySelector<HTMLElement>('a');
      if (link) {
        link.click();
        return true;
      }
    }
  }
  return false;
}

export function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
}
