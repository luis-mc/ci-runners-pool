// Component 24: a time axis list (UX-33). Things that happen over time read as one axis: a range bar (the range,
// Clear, zoom out, zoom in), a chart of the range with one bar per day, and rows under a day header with its count.
// There are no pages: more rows load when the end of the list nears the screen. An empty range says so and offers
// to widen it. An error keeps the rows already drawn (the screen keeps them and shows a message).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { formatCount, formatDate } from './format';
import { Empty } from './State';

interface Period<T> {
  day: string;
  rows: T[];
}

function group<T>(
  rows: readonly T[],
  at: (row: T) => string | number | Date,
): Period<T>[] {
  const out: Period<T>[] = [];
  for (const row of rows) {
    const day = formatDate(at(row));
    const last = out[out.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else out.push({ day, rows: [row] });
  }
  return out;
}

export interface TimeAxisProps<T> {
  /** What the axis lists, for assistive technology: "Job history". */
  label: string;
  /** The rows in the order shown, newest first. */
  rows: readonly T[];
  at: (row: T) => string | number | Date;
  rowKey: (row: T) => string;
  renderRow: (row: T) => ReactNode;
  onOpen?: ((row: T) => void) | undefined;
  /** The range shown, in words ("all time", "2026-11-01 to 2026-11-14"): it is always named. */
  rangeText: string;
  onClear?: (() => void) | undefined;
  onZoomIn?: (() => void) | undefined;
  onZoomOut?: (() => void) | undefined;
  /** More rows exist after the last one drawn; they load as the end nears the screen. */
  hasMore?: boolean | undefined;
  onLoadMore?: (() => void) | undefined;
  loadingMore?: boolean | undefined;
  /** What an empty range says (UX-6). */
  emptyText: string;
}

export function TimeAxis<T>({
  label,
  rows,
  at,
  rowKey,
  renderRow,
  onOpen,
  rangeText,
  onClear,
  onZoomIn,
  onZoomOut,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  emptyText,
}: TimeAxisProps<T>) {
  const periods = group(rows, at);
  const peak = Math.max(1, ...periods.map((p) => p.rows.length));
  const end = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(0);
  useEffect(() => {
    const node = end.current;
    if (!node || !hasMore || loadingMore || typeof IntersectionObserver === 'undefined')
      return;
    const watch = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setNear((n) => n + 1);
    });
    watch.observe(node);
    return () => watch.disconnect();
  }, [hasMore, loadingMore, rows.length]);
  useEffect(() => {
    if (near > 0) onLoadMore?.();
    // Only a new sighting of the end loads more.
  }, [near]);
  return (
    <div className="ds-axis" data-layout-group>
      <div className="ds-axis__range" role="group" aria-label="Range">
        <span className="ds-axis__range-text">Showing {rangeText}</span>
        {onClear ? <Button onPress={onClear}>Clear</Button> : null}
        {onZoomOut ? <Button onPress={onZoomOut}>Zoom out</Button> : null}
        {onZoomIn ? <Button onPress={onZoomIn}>Zoom in</Button> : null}
      </div>
      {rows.length === 0 ? (
        <Empty
          title={emptyText}
          action={
            onZoomOut ? <Button onPress={onZoomOut}>Widen the range</Button> : undefined
          }
        />
      ) : (
        <>
          <div
            className="ds-axis__chart"
            role="img"
            aria-label={`${label}: ${periods
              .map((p) => `${p.day} ${formatCount(p.rows.length, 'job')}`)
              .join(', ')}`}
          >
            {[...periods].reverse().map((p) => (
              <span
                key={p.day}
                className="ds-axis__bar"
                style={{ blockSize: `${Math.max(8, (p.rows.length / peak) * 100)}%` }}
                title={`${p.day}: ${formatCount(p.rows.length, 'job')}`}
              />
            ))}
          </div>
          {periods.map((p) => (
            <section key={p.day} className="ds-axis__period" aria-label={p.day}>
              <h3 className="ds-axis__head">
                <span>{p.day}</span>
                <span className="ds-badge">{formatCount(p.rows.length, 'job')}</span>
              </h3>
              <ul className="ds-axis__rows">
                {p.rows.map((row) => (
                  <li
                    key={rowKey(row)}
                    className="ds-axis__row"
                    data-list-row
                    tabIndex={0}
                    onKeyDown={
                      onOpen
                        ? (e) => {
                            if (e.key === 'Enter' && e.target === e.currentTarget)
                              onOpen(row);
                          }
                        : undefined
                    }
                  >
                    {renderRow(row)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {hasMore ? (
            <div ref={end} className="ds-axis__end">
              <Button onPress={onLoadMore} busy={loadingMore} busyLabel="Loading earlier">
                Show earlier
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
