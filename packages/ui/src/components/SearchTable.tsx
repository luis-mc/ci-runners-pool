// Component 67: a search box, a state filter, one table and a details panel. It is the one list of the Jobs section
// (Live, Done, Run elsewhere) and the part any later list with a search and a side panel uses (owner decision, 20 Nov
// 2026, option 11 of CRSP211). A page passes data: the rows, the columns, what each row says in words and what its
// details show. The search is the one of option 9: free words match any text of a row; `name:word` narrows one field.
// Focus starts in the search box. Down, Up, `j` and `k` move through the box, the filters, the button and every row
// (the shell's arrow navigation, UX-57). The details button opens the panel of the chosen row at the right; at phone
// width the panel is a sheet at the bottom of the screen (UX-43).
import { useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { SearchBar, ListToolbar } from './Controls';
import { Text } from './layout';
import { Pane } from './Pane';
import { Empty } from './State';
import { Table, type Column, type RowActionSpec } from './Table';

export const SEARCH_TABLE_WORDS = {
  show: 'Show details',
  hide: 'Hide details',
  details: 'Details',
  close: 'Close details',
  none: 'Choose a row to see its details.',
  noMatch: 'Nothing matches. Clear the search or choose All.',
} as const;

/** A search query cut into words: a plain word, or `field:word` for a field the page names. */
export interface SearchTerm {
  field?: string | undefined;
  word: string;
}

export function parseSearch(query: string, fields: readonly string[]): SearchTerm[] {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t): SearchTerm => {
      const at = t.indexOf(':');
      const name = at > 0 ? t.slice(0, at).toLowerCase() : '';
      return fields.includes(name)
        ? { field: name, word: t.slice(at + 1).toLowerCase() }
        : { word: t.toLowerCase() };
    });
}

/** Whether a row (its whole text and its named fields) answers every word of the query. */
export function matchesSearch(
  terms: readonly SearchTerm[],
  text: string,
  fields: Readonly<Record<string, string>>,
): boolean {
  const all = text.toLowerCase();
  return terms.every((t) =>
    t.field === undefined
      ? all.includes(t.word)
      : (fields[t.field] ?? '').toLowerCase().includes(t.word),
  );
}

/** The icon of the details button: a box with a bar at the right (the panel). */
function PanelRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M15 3v18" />
    </svg>
  );
}

export function SearchTable<T>({
  label,
  title,
  hint,
  searchLabel,
  placeholder = 'Search, or repo: state: runner: branch: job:',
  rows,
  text,
  fields,
  query,
  onQuery,
  filters,
  count,
  caption,
  columns,
  rowKey,
  expandLabel,
  rowLabel,
  onOpen,
  action,
  oneLine = true,
  detail,
  empty = SEARCH_TABLE_WORDS.noMatch,
  below,
  autoFocus = true,
}: {
  /** The name of the list, for screen readers. */
  label: string;
  /** The title of the pane the table sits in (CORE-7); the pane counts the rows that match. */
  title: string;
  /** One quiet line under the title: what a row is. */
  hint?: string | undefined;
  searchLabel?: string | undefined;
  placeholder?: string | undefined;
  rows: readonly T[];
  /** Everything a row says, one string: a free word matches any of it. */
  text: (row: T) => string;
  /** The fields a word can name (`repo:`, `state:` ...). */
  fields: Readonly<Record<string, (row: T) => string>>;
  query: string;
  onQuery: (query: string) => void;
  /** The state filter and the other choices of the list, before the search box's neighbours. */
  filters?: ReactNode;
  /** A short count at the end of the bar. */
  count?: string | undefined;
  caption: string;
  columns: readonly Column<T>[];
  rowKey: (row: T) => string;
  expandLabel?: string | undefined;
  rowLabel?: ((row: T) => string) | undefined;
  onOpen?: ((row: T) => void) | undefined;
  action?: RowActionSpec<T> | undefined;
  oneLine?: boolean | undefined;
  /** The panel of the chosen row. Without it the list has no details button. */
  detail?: { title: (row: T) => string; render: (row: T) => ReactNode } | undefined;
  /** Said when no row matches. */
  empty?: string | undefined;
  /** Under the table: a count line, Show more. */
  below?: ReactNode;
  autoFocus?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const toggle = useRef<HTMLButtonElement>(null);
  const names = Object.keys(fields);
  const terms = parseSearch(query, names);
  const shown = rows.filter((r) =>
    matchesSearch(
      terms,
      text(r),
      Object.fromEntries(names.map((n) => [n, (fields[n] as (row: T) => string)(r)])),
    ),
  );
  // The chosen row stays chosen while it is on the list; else the first row is.
  const current = shown.find((r) => rowKey(r) === chosen) ?? shown[0];
  const word = open ? SEARCH_TABLE_WORDS.hide : SEARCH_TABLE_WORDS.show;
  const panel = open && detail && current ? detail : undefined;
  return (
    <div className="ds-search-table">
      <ListToolbar
        label={label}
        search={
          <SearchBar
            value={query}
            onChange={onQuery}
            label={searchLabel ?? `Search ${label.toLowerCase()}`}
            placeholder={placeholder}
            autoFocus={autoFocus}
          />
        }
        filters={filters}
        count={count}
        actions={
          detail ? (
            <button
              ref={toggle}
              type="button"
              className="ds-button ds-panel-toggle"
              data-icon
              aria-pressed={open}
              aria-label={word}
              title={word}
              onClick={() => setOpen((o) => !o)}
            >
              <PanelRightIcon />
            </button>
          ) : undefined
        }
      />
      <div className="ds-search-table__grid" data-open={panel ? true : undefined}>
        <div className="ds-search-table__main">
          <Pane title={title} count={shown.length}>
            {hint ? <Text tone="muted">{hint}</Text> : null}
            {shown.length === 0 ? (
              <Empty title={empty} />
            ) : (
              <Table
                caption={caption}
                columns={columns}
                rows={shown}
                rowKey={rowKey}
                expandLabel={expandLabel}
                rowLabel={rowLabel}
                onOpen={onOpen}
                action={action}
                oneLine={oneLine}
                current={panel && current ? rowKey(current) : undefined}
                onSelect={detail ? (r) => setChosen(rowKey(r)) : undefined}
              />
            )}
            {below}
          </Pane>
        </div>
        {panel && current ? (
          <aside
            className="ds-side"
            aria-label={`${SEARCH_TABLE_WORDS.details}: ${panel.title(current)}`}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setOpen(false);
                toggle.current?.focus();
              }
            }}
          >
            <div className="ds-side__bar">
              <h2 className="ds-side__title">{panel.title(current)}</h2>
              <Button
                onPress={() => {
                  setOpen(false);
                  toggle.current?.focus();
                }}
              >
                {SEARCH_TABLE_WORDS.close}
              </Button>
            </div>
            <div className="ds-side__body">{panel.render(current)}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
