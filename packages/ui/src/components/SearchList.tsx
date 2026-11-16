// Part of component 38: a search box over a filtered list (UX-31, UX-57). Typing filters. Down and Up (and `j` and `k`
// outside the box) move through the results; Enter in the box opens the first result, Enter on a result opens it.
// At the first and last stop the key is left alone, so the page's arrow navigation hands focus to the previous or
// next control. Focus starts in the box only when `autoFocus` is set, which a dialog the user just opened does.
import { useEffect, useRef, useState } from 'react';
import { SearchBar } from './Controls';

export interface SearchListItem {
  id: string;
  label: string;
  hint?: string | undefined;
}

export function SearchList({
  items,
  onPick,
  label,
  listLabel = 'Results',
  empty = 'Nothing matches. Clear the search to see everything.',
  max = 12,
  autoFocus = false,
}: {
  items: readonly SearchListItem[];
  onPick: (id: string) => void;
  /** The name of the search box. */
  label: string;
  listLabel?: string | undefined;
  /** Said when nothing matches. */
  empty?: string | undefined;
  /** At most this many results show. */
  max?: number | undefined;
  autoFocus?: boolean | undefined;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(-1);
  const needle = q.trim().toLowerCase();
  const shown = items.filter((i) => i.label.toLowerCase().includes(needle)).slice(0, max);

  // After the opener's own focus handling (a dialog focuses its first control in a layout effect).
  useEffect(() => {
    if (autoFocus) box.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, [autoFocus]);

  const stops = () => {
    const input = box.current?.querySelector<HTMLElement>('input');
    const rows = Array.from(
      box.current?.querySelectorAll<HTMLElement>('[data-list-row]') ?? [],
    );
    return input ? [input, ...rows] : rows;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const inBox = e.target instanceof HTMLInputElement;
    if (e.key === 'Enter' && inBox) {
      const first = shown[0];
      if (first) {
        e.preventDefault();
        onPick(first.id);
      }
      return;
    }
    const down = e.key === 'ArrowDown' || (e.key === 'j' && !inBox);
    const up = e.key === 'ArrowUp' || (e.key === 'k' && !inBox);
    if (!down && !up) return;
    const all = stops();
    const at = all.indexOf(e.target as HTMLElement);
    // The clear button is not one of ours: the page's arrow navigation moves from it.
    const to = at < 0 ? undefined : all[at + (down ? 1 : -1)];
    if (!to) return;
    e.preventDefault();
    to.focus();
  };

  const active = focused >= 0 ? focused : 0;
  return (
    <div ref={box} onKeyDown={onKeyDown}>
      <SearchBar value={q} onChange={setQ} label={label} />
      {shown.length === 0 ? (
        <p className="ds-text">{empty}</p>
      ) : (
        <ul className="ds-results" role="listbox" aria-label={listLabel}>
          {shown.map((it, i) => (
            <li key={it.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                className="ds-results__item"
                data-list-row
                data-active={i === active || undefined}
                tabIndex={-1}
                onFocus={() => setFocused(i)}
                onBlur={() => setFocused(-1)}
                onClick={() => onPick(it.id)}
              >
                {it.label}
                {it.hint ? <span className="ds-results__hint"> {it.hint}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
