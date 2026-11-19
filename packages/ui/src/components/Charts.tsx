// Components 52 to 55: trend chart, sparkline, heatmap and forecast chart. Component 31 is the rule they follow:
// inline SVG or HTML to scale, token colours only, a label as the text alternative (role="img") and a real table
// under "Show as table" (UX-41, UX-17, UX-18, UX-11). Colour is never the only carrier (UX-58): lines differ by
// dash, the forecast range is a bracket with end caps, a heat cell carries its number in the table.
import { formatDateTime, formatDuration, formatNumber, formatPercent } from './format';
import { Empty } from './State';
import { VizAlt } from './VizAlt';
import type {
  ForecastChartProps,
  HeatmapProps,
  Point,
  SparklineProps,
  TrendChartProps,
  Unit,
} from './Viz.types';

export const CHART_WORDS = {
  noData: 'no data yet',
  lowest: 'lowest',
  highest: 'highest',
  last: 'last',
  values: 'values',
  series: 'Series',
  when: 'When',
  value: 'Value',
  range: 'Range',
  note: 'Note',
  day: 'Day',
  total: 'Total',
  busiest: 'Busiest hour',
  forecast: 'forecast',
  actual: 'actual',
  within: 'inside the forecast range',
  outside: 'outside the forecast range',
  noRange: 'no range',
  diagonal: 'forecast = actual',
  point: 'Job',
} as const;

function fmt(unit: Unit, v: number): string {
  if (unit === 'seconds') return formatDuration(v);
  if (unit === 'percent') return formatPercent(v);
  return formatNumber(v);
}

function xText(x: number | string): string {
  return typeof x === 'number' ? formatDateTime(x) : x;
}

function scale(v: number, lo: number, hi: number): number {
  return hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50;
}

const W = 600;
const H = 200;
const DASHES = ['', '8 4', '2 4', '10 3 2 3'] as const;

interface Prepared {
  id: string;
  label: string;
  kind: 'line' | 'column';
  index: number;
  pts: { x: number; y: number; lo?: number; hi?: number; p: Point }[];
}

export function TrendChart({ label, series, unit, emptyText }: TrendChartProps) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <Empty title={emptyText} />;
  const categories: string[] = [];
  for (const p of all) {
    if (typeof p.x === 'string' && !categories.includes(p.x)) categories.push(p.x);
  }
  const nums = all.flatMap((p) => (typeof p.x === 'number' ? [p.x] : []));
  const xMin = Math.min(...nums);
  const xMax = Math.max(...nums);
  const xAt = (x: number | string): number => {
    if (typeof x === 'number')
      return xMax > xMin ? ((x - xMin) / (xMax - xMin)) * W : W / 2;
    return ((categories.indexOf(x) + 0.5) / categories.length) * W;
  };
  const yTop =
    unit === 'percent' ? 100 : Math.max(1, ...all.flatMap((p) => [p.y, p.hi ?? 0]));
  const yAt = (y: number) => H - (Math.min(y, yTop) / yTop) * H;
  const prepared: Prepared[] = series.map((s, index) => ({
    id: s.id,
    label: s.label,
    kind: s.kind ?? 'line',
    index,
    pts: [...s.points]
      .map((p) => ({
        x: xAt(p.x),
        y: yAt(p.y),
        p,
        ...(p.lo !== undefined ? { lo: yAt(p.lo) } : {}),
        ...(p.hi !== undefined ? { hi: yAt(p.hi) } : {}),
      }))
      .sort((a, b) => a.x - b.x),
  }));
  const columns = prepared.filter((s) => s.kind === 'column');
  const slot = (W / Math.max(1, categories.length || all.length)) * 0.7;
  const barW = Math.max(2, slot / Math.max(1, columns.length));
  const first = all[0] as Point;
  const last = all[all.length - 1] as Point;
  const summary = series
    .map((s) => {
      const top = s.points.reduce((m, p) => Math.max(m, p.y), 0);
      return `${s.label}: ${s.points.length} ${CHART_WORDS.values}, ${CHART_WORDS.highest} ${fmt(unit, top)}`;
    })
    .join('; ');
  return (
    <div className="ds-trend">
      <div role="img" aria-label={`${label}: ${summary}`} className="ds-trend__chart">
        <span className="ds-trend__y ds-trend__y--top" aria-hidden="true">
          {fmt(unit, yTop)}
        </span>
        <span className="ds-trend__y ds-trend__y--bottom" aria-hidden="true">
          {fmt(unit, 0)}
        </span>
        <svg
          className="ds-trend__svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <line className="ds-trend__grid" x1="0" x2={W} y1={H / 2} y2={H / 2} />
          {prepared.map((s) => (
            <g
              key={s.id}
              className="ds-trend__series"
              data-series={s.index % DASHES.length}
            >
              {s.kind === 'line' &&
              s.pts.some((p) => p.lo !== undefined && p.hi !== undefined) ? (
                <path
                  className="ds-trend__band"
                  d={`${s.pts
                    .filter((p) => p.hi !== undefined)
                    .map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.hi}`)
                    .join(' ')} ${s.pts
                    .filter((p) => p.lo !== undefined)
                    .reverse()
                    .map((p) => `L ${p.x} ${p.lo}`)
                    .join(' ')} Z`}
                />
              ) : null}
              {s.kind === 'line' ? (
                <path
                  className="ds-trend__line"
                  strokeDasharray={DASHES[s.index % DASHES.length] || undefined}
                  d={s.pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')}
                />
              ) : (
                s.pts.map((p, i) => {
                  const col = columns.indexOf(s);
                  const x = p.x - slot / 2 + col * barW;
                  return (
                    <rect
                      key={i}
                      className="ds-trend__column"
                      x={x}
                      y={p.y}
                      width={barW}
                      height={Math.max(0, H - p.y)}
                    />
                  );
                })
              )}
            </g>
          ))}
        </svg>
        <span className="ds-trend__x" aria-hidden="true">
          <span>{xText(first.x)}</span>
          <span>{xText(last.x)}</span>
        </span>
      </div>
      <ul className="ds-trend__legend">
        {series.map((s, i) => (
          <li key={s.id} className="ds-trend__key" data-series={i % DASHES.length}>
            <svg
              viewBox="0 0 24 8"
              className="ds-trend__swatch"
              aria-hidden="true"
              focusable="false"
            >
              <line
                x1="0"
                x2="24"
                y1="4"
                y2="4"
                strokeDasharray={DASHES[i % DASHES.length] || undefined}
              />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
      <VizAlt
        caption={label}
        head={[
          CHART_WORDS.series,
          CHART_WORDS.when,
          CHART_WORDS.value,
          CHART_WORDS.range,
          CHART_WORDS.note,
        ]}
        rows={series.flatMap((s) =>
          s.points.map((p) => [
            s.label,
            xText(p.x),
            fmt(unit, p.y),
            p.lo !== undefined && p.hi !== undefined
              ? `${fmt(unit, p.lo)} - ${fmt(unit, p.hi)}`
              : '',
            p.note ?? '',
          ]),
        )}
      />
    </div>
  );
}

export function Sparkline({ label, values, unit, markLast = false }: SparklineProps) {
  if (values.length === 0) {
    return <span className="ds-spark ds-spark--empty">{CHART_WORDS.noData}</span>;
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const lastValue = values[values.length - 1] as number;
  const xAt = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * 100 : 50);
  const yAt = (v: number) => 100 - scale(v, lo, hi);
  return (
    <span
      className="ds-spark"
      role="img"
      aria-label={`${label}: ${values.length} ${CHART_WORDS.values}, ${CHART_WORDS.last} ${fmt(unit, lastValue)}, ${CHART_WORDS.lowest} ${fmt(unit, lo)}, ${CHART_WORDS.highest} ${fmt(unit, hi)}`}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
        className="ds-spark__svg"
      >
        <path
          className="ds-spark__line"
          d={values.map((v, i) => `${i ? 'L' : 'M'} ${xAt(i)} ${yAt(v)}`).join(' ')}
        />
      </svg>
      {markLast ? (
        <span
          className="ds-spark__last"
          aria-hidden="true"
          style={{
            insetInlineStart: `${xAt(values.length - 1)}%`,
            insetBlockStart: `${yAt(lastValue)}%`,
          }}
        />
      ) : null}
    </span>
  );
}

const LEVELS = 4;

export function Heatmap({ label, rows, unit }: HeatmapProps) {
  const peak = Math.max(0, ...rows.flatMap((r) => r.values));
  if (rows.length === 0 || peak <= 0) {
    return <span className="ds-spark ds-spark--empty">{CHART_WORDS.noData}</span>;
  }
  const level = (v: number) => (v <= 0 ? 0 : Math.max(1, Math.ceil((v / peak) * LEVELS)));
  const summary = rows
    .map((r) => {
      const top = busiest(r.values);
      return `${r.label}: ${CHART_WORDS.busiest} ${top.hour}:00, ${fmt(unit, top.value)}`;
    })
    .join('; ');
  return (
    <div className="ds-heat">
      <div role="img" aria-label={`${label}: ${summary}`} className="ds-heat__chart">
        <div className="ds-heat__hours" aria-hidden="true">
          <span />
          {[0, 6, 12, 18].map((h) => (
            <span key={h} style={{ gridColumn: `${h + 2} / span 6` }}>
              {h}
            </span>
          ))}
        </div>
        {rows.map((r) => (
          <div key={r.label} className="ds-heat__row" aria-hidden="true">
            <span className="ds-heat__day">{r.label}</span>
            {Array.from({ length: 24 }, (_, h) => {
              const v = r.values[h] ?? 0;
              return (
                <span
                  key={h}
                  className="ds-heat__cell"
                  data-level={level(v)}
                  title={`${r.label} ${h}:00, ${fmt(unit, v)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <VizAlt
        caption={label}
        head={[CHART_WORDS.day, CHART_WORDS.total, CHART_WORDS.busiest]}
        rows={rows.map((r) => {
          const top = busiest(r.values);
          return [
            r.label,
            fmt(
              unit,
              r.values.reduce((a, b) => a + b, 0),
            ),
            `${top.hour}:00, ${fmt(unit, top.value)}`,
          ];
        })}
      />
    </div>
  );
}

function busiest(values: readonly number[]): { hour: number; value: number } {
  let hour = 0;
  let value = 0;
  values.forEach((v, h) => {
    if (v > value) {
      value = v;
      hour = h;
    }
  });
  return { hour, value };
}

export function ForecastChart({ label, points }: ForecastChartProps) {
  if (points.length === 0) {
    return <span className="ds-spark ds-spark--empty">{CHART_WORDS.noData}</span>;
  }
  const top = Math.max(
    1,
    ...points.flatMap((p) => [p.forecastSec, p.actualSec, p.hiSec ?? 0]),
  );
  const inside = (p: ForecastChartProps['points'][number]) =>
    p.loSec !== undefined && p.hiSec !== undefined
      ? p.actualSec >= p.loSec && p.actualSec <= p.hiSec
      : undefined;
  const word = (p: ForecastChartProps['points'][number]) => {
    const i = inside(p);
    return i === undefined
      ? CHART_WORDS.noRange
      : i
        ? CHART_WORDS.within
        : CHART_WORDS.outside;
  };
  const nIn = points.filter((p) => inside(p) === true).length;
  const nRange = points.filter((p) => inside(p) !== undefined).length;
  return (
    <div className="ds-fchart">
      <div
        role="img"
        aria-label={`${label}: ${points.length} ${CHART_WORDS.values}${nRange ? `, ${nIn} ${CHART_WORDS.within}` : ''}`}
        className="ds-fchart__chart"
      >
        <svg
          className="ds-fchart__svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <line className="ds-fchart__diagonal" x1="0" y1="100" x2="100" y2="0" />
        </svg>
        {points.map((p, i) => (
          <span key={i} aria-hidden="true">
            {p.loSec !== undefined && p.hiSec !== undefined ? (
              <span
                className="ds-fchart__range"
                style={{
                  insetInlineStart: `${scale(p.loSec, 0, top)}%`,
                  inlineSize: `${scale(p.hiSec, 0, top) - scale(p.loSec, 0, top)}%`,
                  insetBlockEnd: `${scale(p.actualSec, 0, top)}%`,
                }}
              />
            ) : null}
            <span
              className="ds-fchart__dot"
              data-inside={inside(p) === undefined ? undefined : String(inside(p))}
              title={p.note}
              style={{
                insetInlineStart: `${scale(p.forecastSec, 0, top)}%`,
                insetBlockEnd: `${scale(p.actualSec, 0, top)}%`,
              }}
            />
          </span>
        ))}
        <span className="ds-fchart__axis ds-fchart__axis--x" aria-hidden="true">
          {CHART_WORDS.forecast} {fmt('seconds', top)}
        </span>
        <span className="ds-fchart__axis ds-fchart__axis--y" aria-hidden="true">
          {CHART_WORDS.actual} {fmt('seconds', top)}
        </span>
      </div>
      <p className="ds-fchart__legend">{CHART_WORDS.diagonal}</p>
      <VizAlt
        caption={label}
        head={[
          CHART_WORDS.point,
          CHART_WORDS.forecast,
          CHART_WORDS.actual,
          CHART_WORDS.range,
          CHART_WORDS.note,
        ]}
        rows={points.map((p) => [
          p.note,
          fmt('seconds', p.forecastSec),
          fmt('seconds', p.actualSec),
          p.loSec !== undefined && p.hiSec !== undefined
            ? `${fmt('seconds', p.loSec)} - ${fmt('seconds', p.hiSec)}, ${word(p)}`
            : word(p),
          p.note,
        ])}
      />
    </div>
  );
}
