// Prop contracts of the RES15 visual parts (waterfall, job graph, charts). The parts live in Waterfall.tsx,
// JobGraph.tsx and Charts.tsx; this file is the contract the screens build against.
import type { ReactNode } from 'react';
import type { StatusKind } from './Status';

/** One bar of a waterfall: seconds are counted from the origin of the chart (the run's first moment). */
export interface WaterfallRow {
  id: string;
  label: string;
  /** A muted second line: runner, machine, matrix values. */
  sublabel?: string | undefined;
  /** A group heading the row sits under ("Job build", "Run 8141"). Rows of one group are adjacent. */
  group?: string | undefined;
  status: StatusKind;
  /** The bar starts here. */
  startSec: number;
  /** The bar ends here; for a running row, the time now. */
  endSec: number;
  /** A lighter segment before startSec: the job waited from this second (queued). */
  waitFromSec?: number | undefined;
  /** The forecast range for the bar's end: drawn as a bracket after the bar. */
  forecast?: { loSec: number; hiSec: number } | undefined;
  /** True for the row of the job being looked at. */
  current?: boolean | undefined;
  /** True for a row on the critical path. */
  critical?: boolean | undefined;
  /** The row in words, for assistive tech and the table under the chart ("ran 4 min 12 s, forecast 3-5 min"). */
  detail: string;
  onOpen?: (() => void) | undefined;
}
export interface WaterfallProps {
  /** What it shows: "Steps of job build". */
  label: string;
  rows: readonly WaterfallRow[];
  /** The time axis end; default the largest endSec, forecast included. */
  totalSec?: number | undefined;
  /** A marker for "now" on a live chart. */
  nowSec?: number | undefined;
  /**
   * A text alternative that lives elsewhere on the page: the id of the element that holds a table of the same
   * items. The chart then draws no "Show as table" of its own and points to that element (aria-describedby).
   * Without it the chart folds its own table under it (UX-41).
   */
  altTable?: string | undefined;
  emptyText: string;
}

export interface JobGraphNode {
  id: string;
  label: string;
  /** A muted second line: "4 min 12 s", "waits 40 s". */
  sublabel?: string | undefined;
  status: StatusKind;
  current?: boolean | undefined;
  critical?: boolean | undefined;
  /** Matrix jobs: how many copies this node stands for ("x 3"). */
  copies?: number | undefined;
  onOpen?: (() => void) | undefined;
}
export interface JobGraphProps {
  label: string;
  nodes: readonly JobGraphNode[];
  /** `needs`: edge [a, b] means b needs a. */
  edges: readonly (readonly [string, string])[];
  emptyText: string;
  /**
   * A text alternative that lives elsewhere on the page: the id of the element that holds a table of the same
   * items. The chart then draws no "Show as table" of its own and points to that element (aria-describedby).
   * Without it the chart folds its own table under it (UX-41).
   */
  altTable?: string | undefined;
}

export interface Point {
  /** A time (ms since epoch) or a category label. */
  x: number | string;
  y: number;
  /** A range around y (forecast or p10-p90). */
  lo?: number | undefined;
  hi?: number | undefined;
  /** What the point is, for the text alternative. */
  note?: string | undefined;
}
export interface Series {
  id: string;
  label: string;
  points: readonly Point[];
  /** Draw as a line (default) or as columns. */
  kind?: 'line' | 'column' | undefined;
}
export type Unit = 'seconds' | 'count' | 'percent';
export interface TrendChartProps {
  label: string;
  series: readonly Series[];
  unit: Unit;
  emptyText: string;
}
/** A small line in a table cell or a facts row; always has `label` as text alternative. */
export interface SparklineProps {
  label: string;
  values: readonly number[];
  unit: Unit;
  /** Mark the last value. */
  markLast?: boolean | undefined;
}
/** Weekday x hour grid of counts or seconds ("busiest hours"). */
export interface HeatmapProps {
  label: string;
  /** rows[day][hour 0..23] */
  rows: readonly {
    label: string;
    /** The label on the grid when the column is too narrow for `label` (Mon for Monday); the table keeps `label`. */
    short?: string;
    values: readonly number[];
  }[];
  unit: Unit;
}
/** Forecast against actual: one dot per finished job, a diagonal for "forecast = actual", a band for the range. */
export interface ForecastChartProps {
  label: string;
  points: readonly {
    forecastSec: number;
    actualSec: number;
    loSec?: number;
    hiSec?: number;
    note: string;
  }[];
}
export type VizChild = ReactNode;
