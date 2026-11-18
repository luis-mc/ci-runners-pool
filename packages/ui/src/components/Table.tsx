// Component 15: tables and list rows. Use a table only to compare three or more facts (UX-25). Column heads
// sort. A table never scrolls sideways, nor does the page: cells wrap and a row folds to a stack at phone width (UX-49). j and k move the
// active row, Enter opens it (UX-57): the shell sets `data-list-row` and the handler reads it.
import { Fragment, useId, useMemo, useState, type ReactNode } from 'react';
import { Button } from './Button';
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
  /**
   * Long free text of this cell (an error, a reason). The cell shows it as one line with an ellipsis and, when it
   * is longer than one line, a button (the table's `expandLabel`) that opens the full text in a full-width row
   * under the row. `short` is a server-given short form; without one the table cuts the text itself.
   */
  long?: ((row: T) => LongText | null | undefined) | undefined;
}

export interface LongText {
  full: string;
  short?: string | undefined;
}

/** The first clause of a long text: up to the first " (" or ": ", cut at `max` characters with an ellipsis. */
export function summarize(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const cut = [flat.indexOf(' ('), flat.indexOf(': ')].filter((i) => i > 0);
  const head = cut.length > 0 ? flat.slice(0, Math.min(...cut)) : flat;
  return head.length > max ? `${head.slice(0, max - 1).trimEnd()}…` : head;
}

/** At most `max` items, then a count of the rest; the full list stays in text for a screen reader. */
export function CappedList({
  items,
  max = 2,
}: {
  items: readonly string[];
  max?: number;
}) {
  const more = items.length - max;
  return (
    <>
      <span aria-hidden="true">
        {items.slice(0, max).join(', ')}
        {more > 0 ? ` +${more}` : ''}
      </span>
      <span className="ds-visually-hidden">{items.join(', ')}</span>
    </>
  );
}

const LONG_AT = 40;

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
  expandLabel = 'Details',
  rowLabel,
  detail,
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
  /** The word on the button of a column's `long` text, for example "Full error" or "Details". */
  expandLabel?: string | undefined;
  /** Names a row for the region the button opens (a screen reader reads it with the button's word). */
  rowLabel?: ((row: T) => string) | undefined;
  /**
   * A row that opens in place to more than text: a last column holds a button (`label`) that opens a full-width row
   * under it with `render(row)` (a run opens to its jobs). The button's name carries `rowLabel`.
   */
  detail?: { label: string; render: (row: T) => ReactNode } | undefined;
}) {
  const base = useId();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggleOpen = (key: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (!n.delete(key)) n.add(key);
      return n;
    });
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
            {detail ? (
              <th scope="col">
                <span className="ds-visually-hidden">{detail.label}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const key = rowKey(row);
            const regionId = `${base}-${key.replace(/\s+/g, '_')}`;
            let expandedText: string | undefined;
            const isOpen = open.has(key);
            return (
              <Fragment key={key}>
                <tr
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
                      <span className="ds-table__value">
                        {c.cell(row)}
                        {(() => {
                          const long = c.long?.(row);
                          if (!long) return null;
                          const shown = long.short ?? summarize(long.full);
                          const needsButton =
                            long.full.length > LONG_AT || shown !== long.full;
                          if (needsButton) expandedText = long.full;
                          return (
                            <>
                              <span
                                className={needsButton ? 'ds-table__clip' : undefined}
                              >
                                {needsButton ? shown : long.full}
                              </span>
                              {needsButton ? (
                                <Button
                                  onPress={() => toggleOpen(key)}
                                  expanded={isOpen}
                                  controls={regionId}
                                >
                                  {expandLabel}
                                </Button>
                              ) : null}
                            </>
                          );
                        })()}
                      </span>
                    </td>
                  ))}
                  {detail ? (
                    <td data-label={detail.label} className="ds-table__detail">
                      <Button
                        onPress={() => toggleOpen(key)}
                        expanded={isOpen}
                        controls={regionId}
                      >
                        {detail.label}
                      </Button>
                    </td>
                  ) : null}
                </tr>
                {isOpen && detail ? (
                  <tr className="ds-table__expanded">
                    <td colSpan={columns.length + 1 + (onToggle ? 1 : 0)}>
                      <div
                        id={regionId}
                        role="region"
                        aria-label={
                          rowLabel ? `${detail.label}: ${rowLabel(row)}` : detail.label
                        }
                      >
                        {detail.render(row)}
                      </div>
                    </td>
                  </tr>
                ) : null}
                {isOpen && !detail && expandedText !== undefined ? (
                  <tr className="ds-table__expanded">
                    <td colSpan={columns.length + (onToggle ? 1 : 0)}>
                      <div
                        id={regionId}
                        role="region"
                        aria-label={
                          rowLabel ? `${expandLabel}: ${rowLabel(row)}` : expandLabel
                        }
                      >
                        {expandedText}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
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
