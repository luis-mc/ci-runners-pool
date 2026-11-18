// Component 49: a waterfall. One bar per step or job on a shared time axis: where it started, how long it ran, how
// long it waited before (a lighter, hatched segment), the forecast for its end (a bracket with end caps) and "now"
// on a live chart. Status is the glyph and the words of `detail` as well as the colour; the critical path has a
// thicker outline and the words "critical path" (UX-58). Labels sit beside the bar and stack above it on a phone
// (UX-49). A row with `onOpen` is a real button (UX-57). The text alternative is a table under "Show as table".
import { Fragment } from 'react';
import { formatDuration } from './format';
import { STATUS_GLYPH } from './Status';
import { Empty } from './State';
import { VizAlt } from './VizAlt';
import type { WaterfallProps, WaterfallRow } from './Viz.types';

export const WATERFALL_WORDS = {
  now: 'now',
  critical: 'critical path',
  name: 'Name',
  detail: 'Detail',
} as const;

function pct(sec: number, total: number): number {
  return total > 0 ? Math.min(100, Math.max(0, (sec / total) * 100)) : 0;
}

function ticks(total: number): number[] {
  return [0, 0.25, 0.5, 0.75, 1].map((f) => total * f);
}

function detailOf(row: WaterfallRow): string {
  return row.critical ? `${WATERFALL_WORDS.critical}, ${row.detail}` : row.detail;
}

function rowText(row: WaterfallRow): string {
  return [row.label, row.sublabel, detailOf(row)].filter(Boolean).join(', ');
}

export function Waterfall({ label, rows, totalSec, nowSec, emptyText }: WaterfallProps) {
  if (rows.length === 0) return <Empty title={emptyText} />;
  const total =
    totalSec ??
    Math.max(1, ...rows.flatMap((r) => [r.endSec, r.forecast?.hiSec ?? 0, nowSec ?? 0]));
  return (
    <div className="ds-waterfall">
      <div className="ds-waterfall__axis" aria-hidden="true">
        <span className="ds-waterfall__axis-gap" />
        <span className="ds-waterfall__ticks">
          {ticks(total).map((t, i) => (
            <span
              key={i}
              className="ds-waterfall__tick"
              data-end={i === 4 || undefined}
              style={{ insetInlineStart: `${pct(t, total)}%` }}
            >
              {formatDuration(t)}
            </span>
          ))}
        </span>
      </div>
      <div
        // An image hides its children from assistive tech; rows that open are buttons, so that chart is a group.
        role={rows.some((r) => r.onOpen) ? 'group' : 'img'}
        aria-label={`${label}: ${rows.map(rowText).join('; ')}`}
        className="ds-waterfall__chart"
      >
        <ul className="ds-waterfall__rows">
          {rows.map((row, i) => {
            const newGroup = row.group !== undefined && row.group !== rows[i - 1]?.group;
            const start = pct(row.startSec, total);
            const end = pct(row.endSec, total);
            const waitFrom =
              row.waitFromSec !== undefined ? pct(row.waitFromSec, total) : undefined;
            const body = (
              <>
                <span className="ds-waterfall__glyph" aria-hidden="true">
                  {STATUS_GLYPH[row.status]}
                </span>
                <span className="ds-waterfall__text">
                  <span className="ds-waterfall__name">{row.label}</span>
                  {row.sublabel ? (
                    <span className="ds-waterfall__sub">{row.sublabel}</span>
                  ) : null}
                  <span className="ds-waterfall__detail">{detailOf(row)}</span>
                </span>
              </>
            );
            return (
              <Fragment key={row.id}>
                {newGroup ? <li className="ds-waterfall__group">{row.group}</li> : null}
                <li
                  className="ds-waterfall__row"
                  data-status={row.status}
                  data-current={row.current || undefined}
                  data-critical={row.critical || undefined}
                >
                  {row.onOpen ? (
                    <button
                      type="button"
                      className="ds-waterfall__label ds-waterfall__open"
                      data-list-row
                      onClick={row.onOpen}
                    >
                      {body}
                    </button>
                  ) : (
                    <span className="ds-waterfall__label">{body}</span>
                  )}
                  <span className="ds-waterfall__track" aria-hidden="true">
                    {waitFrom !== undefined && waitFrom < start ? (
                      <span
                        className="ds-waterfall__wait"
                        style={{
                          insetInlineStart: `${waitFrom}%`,
                          inlineSize: `${start - waitFrom}%`,
                        }}
                      />
                    ) : null}
                    <span
                      className="ds-waterfall__bar"
                      style={{
                        insetInlineStart: `${start}%`,
                        inlineSize: `${Math.max(0.5, end - start)}%`,
                      }}
                    />
                    {row.forecast ? (
                      <span
                        className="ds-waterfall__forecast"
                        style={{
                          insetInlineStart: `${pct(row.forecast.loSec, total)}%`,
                          inlineSize: `${Math.max(0.5, pct(row.forecast.hiSec, total) - pct(row.forecast.loSec, total))}%`,
                        }}
                      />
                    ) : null}
                    {nowSec !== undefined ? (
                      <span
                        className="ds-waterfall__now"
                        style={{ insetInlineStart: `${pct(nowSec, total)}%` }}
                      />
                    ) : null}
                  </span>
                </li>
              </Fragment>
            );
          })}
        </ul>
      </div>
      {nowSec !== undefined ? (
        <p className="ds-waterfall__legend">
          {WATERFALL_WORDS.now}: {formatDuration(nowSec)}
        </p>
      ) : null}
      <VizAlt
        caption={label}
        head={[WATERFALL_WORDS.name, WATERFALL_WORDS.detail]}
        rows={rows.map((r) => [
          r.group ? `${r.group}: ${r.label}` : r.label,
          detailOf(r),
        ])}
      />
    </div>
  );
}
