// Component 45: an ordered list. Each item appears once, in numbered rows with Move up and Move down (UX-16, UX-20).
// Alt+ArrowUp and Alt+ArrowDown move the focused row; focus follows the row; a live line says the new place.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface OrderItem {
  id: string;
  label: string;
}

/** Keep the first occurrence of each known id, drop unknown ids, append the missing ones in the default order. */
export function normaliseOrder(
  value: readonly string[],
  items: readonly OrderItem[],
): string[] {
  const known = new Set(items.map((i) => i.id));
  const out: string[] = [];
  for (const id of value) if (known.has(id) && !out.includes(id)) out.push(id);
  for (const i of items) if (!out.includes(i.id)) out.push(i.id);
  return out;
}

export function OrderList({
  label,
  items,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  items: readonly OrderItem[];
  /** The ids in their order. Duplicates and missing ids are normalised for display. */
  value: readonly string[];
  onChange: (value: string[]) => void;
  disabled?: boolean | undefined;
}) {
  const order = normaliseOrder(value, items);
  const name = (id: string) => items.find((i) => i.id === id)?.label ?? id;
  const [said, setSaid] = useState('');
  const focusId = useRef<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    if (focusId.current) {
      rows.current.get(focusId.current)?.focus();
      focusId.current = null;
    }
  });

  const move = (id: string, by: -1 | 1) => {
    const from = order.indexOf(id);
    const to = from + by;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, id);
    focusId.current = id;
    setSaid(`${name(id)} moved to place ${to + 1} of ${order.length}.`);
    onChange(next);
  };

  const onKey = (e: KeyboardEvent<HTMLLIElement>, id: string) => {
    if (disabled || !e.altKey || e.target !== e.currentTarget) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      move(id, e.key === 'ArrowUp' ? -1 : 1);
    }
  };

  return (
    <div className="ds-order" data-layout-group>
      <ol className="ds-order__list" aria-label={label}>
        {order.map((id, i) => (
          <li
            key={id}
            className="ds-order__row"
            tabIndex={0}
            ref={(el) => {
              if (el) rows.current.set(id, el);
              else rows.current.delete(id);
            }}
            aria-label={`${i + 1}, ${name(id)}`}
            onKeyDown={(e) => onKey(e, id)}
          >
            <span className="ds-order__place" aria-hidden="true">
              {i + 1}
            </span>
            <span className="ds-order__name">{name(id)}</span>
            <span className="ds-order__moves">
              <button
                type="button"
                className="ds-button ds-order__move"
                aria-label={`Move ${name(id)} up`}
                disabled={disabled || i === 0}
                onClick={() => move(id, -1)}
              >
                <span aria-hidden="true">↑</span>
              </button>
              <button
                type="button"
                className="ds-button ds-order__move"
                aria-label={`Move ${name(id)} down`}
                disabled={disabled || i === order.length - 1}
                onClick={() => move(id, 1)}
              >
                <span aria-hidden="true">↓</span>
              </button>
            </span>
          </li>
        ))}
      </ol>
      <p className="ds-visually-hidden" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}
