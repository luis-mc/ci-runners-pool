// Component 15: tables and list rows. Use a table only to compare three or more facts (UX-25). Column heads
// sort. A wide table may scroll sideways inside its frame, the page never does (UX-49). j and k move the
// active row, Enter opens it (UX-57): the shell sets `data-list-row` and the handler reads it.
import { useMemo, useState, type ReactNode } from 'react';
import { useKeyHints } from './KeyHints';
import { Pane } from './Pane';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** A sort value. A column without one does not sort. */
  sort?: ((row: T) => string | number) | undefined;
  /** Left out of the two-line fold at phone width; the row still shows it on a wide screen (UX-25). */
  secondary?: boolean | undefined;
}

export function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
  onOpen,
  selected,
  onToggle,
  toggleLabel,
  inactive,
  title,
}: {
  caption: string;
  /** Draws the table inside a pane with this title and the row count; leave out when the page already has one. */
  title?: string | undefined;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  onOpen?: ((row: T) => void) | undefined;
  /** Keys of the chosen rows, with `onToggle` to change one (a choice list). */
  selected?: ReadonlySet<string> | undefined;
  onToggle?: ((key: string) => void) | undefined;
  toggleLabel?: ((row: T) => string) | undefined;
  /** A row the screen shows in grey because it cannot be used now (UX-70): text and links grey, links underlined; its reason sits in the row. */
  inactive?: ((row: T) => boolean) | undefined;
}) {
  useKeyHints(
    rows.length > 0
      ? [
          { keys: 'j / k', does: 'Move' },
          ...(onOpen ? [{ keys: 'Enter', does: 'Open' }] : []),
        ]
      : [],
  );
  const [sortBy, setSortBy] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.id === sortBy?.id);
    if (!col?.sort || !sortBy) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sortBy.dir;
    });
  }, [rows, columns, sortBy]);
  const table = (
    <div className="ds-table-frame">
      <table className="ds-table">
        <caption className="ds-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {onToggle ? <th scope="col" className="ds-table__pick" /> : null}
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                aria-sort={
                  sortBy?.id === c.id
                    ? sortBy.dir === 1
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {c.sort ? (
                  <button
                    type="button"
                    className="ds-table__sort"
                    onClick={() =>
                      setSortBy((s) =>
                        s?.id === c.id
                          ? { id: c.id, dir: s.dir === 1 ? -1 : 1 }
                          : { id: c.id, dir: 1 },
                      )
                    }
                  >
                    {c.header}
                    {sortBy?.id === c.id ? (sortBy.dir === 1 ? ' ▲' : ' ▼') : ''}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                data-list-row
                data-selected={selected?.has(key) || undefined}
                data-inactive={inactive?.(row) || undefined}
                tabIndex={0}
                onDoubleClick={onOpen ? () => onOpen(row) : undefined}
                onKeyDown={
                  onOpen
                    ? (e) => {
                        if (e.key === 'Enter' && e.target === e.currentTarget)
                          onOpen(row);
                      }
                    : undefined
                }
              >
                {onToggle ? (
                  <td className="ds-table__pick">
                    <input
                      type="checkbox"
                      className="ds-checkbox"
                      checked={selected?.has(key) ?? false}
                      aria-label={toggleLabel ? toggleLabel(row) : key}
                      onChange={() => onToggle(key)}
                    />
                  </td>
                ) : null}
                {columns.map((c, i) => (
                  <td
                    key={c.id}
                    data-label={c.header}
                    data-lead={i === 0 || undefined}
                    data-secondary={(i > 0 && c.secondary) || undefined}
                  >
                    <span className="ds-table__value">{c.cell(row)}</span>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  return title ? (
    <Pane title={title} count={rows.length}>
      {table}
    </Pane>
  ) : (
    table
  );
}

/** Component 10: long lists page. */
export function Pager({
  page,
  pages,
  onPage,
  label,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  label: string;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="ds-pager" aria-label={label} data-layout-group>
      <button
        type="button"
        className="ds-button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Back
      </button>
      <span className="ds-pager__where">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        className="ds-button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

export function paginate<T>(rows: readonly T[], page: number, size: number): T[] {
  return rows.slice((page - 1) * size, page * size);
}
