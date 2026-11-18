// The forecast method (RES15 REPORT section 4): simple and explainable. Pure functions, no clock, no network.
//  - per job key: the median of the last 30 successful runs, none older than 90 days; the same machine class is
//    preferred when it has at least 5 samples;
//  - the range is p25 to p90 (nearest rank), at least 10 percent either side of the median;
//  - fewer than 5 samples: fall back job key -> workflow -> repository -> "not enough history";
//  - drift: median of the last 10 against the 20 before, ratio above 1.25 or below 0.8: use the last 10;
//  - a run's ETA is the longest path over its needs graph, from the sum of p25 to the sum of p75;
//  - a queued job's start is found by simulating the slots.
import type { Eta, Forecast, ForecastBasis, HistoryPoint } from './model';

export const MIN_SAMPLES = 5;
export const WINDOW = 30;
export const MAX_AGE_DAYS = 90;
export const DRIFT_UP = 1.25;
export const DRIFT_DOWN = 0.8;
export const MIN_SPREAD = 0.1;
export const DEFAULT_BRANCH = 'main';

const round = (n: number) => Math.round(n * 10) / 10;

/** The p-th percentile (0..1) of numbers, by linear interpolation. Empty input gives 0. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const at = Math.min(Math.max(p, 0), 1) * (s.length - 1);
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  const a = s[lo] as number;
  const b = s[hi] as number;
  return a + (b - a) * (at - lo);
}

/** Nearest-rank percentile (0..1): the smallest value with at least p of the sample at or below it. */
export function nearestRank(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))] as number;
}

export const median = (values: readonly number[]): number => percentile(values, 0.5);

export function noHistory(samples = 0): Forecast {
  return { p50: 0, lo: 0, hi: 0, basis: 'not_enough_history', samples };
}

/**
 * A forecast from sample durations (oldest first), or the 'not enough history' one under 5 samples. With 30 or
 * more samples a drift (median of the last 10 against the 20 before, ratio above 1.25 or below 0.8) makes it
 * use the last 10 and says so.
 */
export function forecastFromSamples(
  seconds: readonly number[],
  basis: Exclude<ForecastBasis, 'not_enough_history'>,
  machine?: string,
): Forecast {
  if (seconds.length < MIN_SAMPLES) return noHistory(seconds.length);
  let use = seconds;
  let changed = false;
  if (seconds.length >= 15) {
    const recent = seconds.slice(-10);
    const before = seconds.slice(-30, -10);
    const ratio = median(recent) / Math.max(1, median(before));
    if (ratio > DRIFT_UP || ratio < DRIFT_DOWN) {
      use = recent;
      changed = true;
    }
  }
  const p50 = median(use);
  const p25 = nearestRank(use, 0.25);
  const lo = Math.min(p25, p50 * (1 - MIN_SPREAD));
  const hi = Math.max(nearestRank(use, 0.9), p50 * (1 + MIN_SPREAD));
  return {
    p50: round(p50),
    lo: round(lo),
    hi: round(hi),
    p25: round(Math.min(p25, p50)),
    p75: round(Math.max(nearestRank(use, 0.75), p50)),
    basis,
    samples: use.length,
    ...(machine ? { machine } : {}),
    ...(changed ? { changed_lately: true } : {}),
  };
}

/** The history that counts: successes of the last 90 days, the newest `WINDOW`, oldest first. */
export function usableHistory(
  history: readonly HistoryPoint[],
  now: number,
  machine?: string,
): { points: HistoryPoint[]; machine?: string } {
  const recent = history
    .filter(
      (h) =>
        h.result === 'success' && now - Date.parse(h.at) <= MAX_AGE_DAYS * 86_400_000,
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  if (machine) {
    const same = recent.filter((h) => h.machine === machine);
    if (same.length >= MIN_SAMPLES) return { points: same.slice(-WINDOW), machine };
  }
  return { points: recent.slice(-WINDOW) };
}

export interface HistoryChain {
  jobKey: readonly HistoryPoint[];
  workflow: readonly HistoryPoint[];
  repository: readonly HistoryPoint[];
}

/** Job key first; with fewer than 5 samples the workflow, then the repository; else 'not enough history'. */
export function chainForecast(
  chain: HistoryChain,
  now: number,
  machine?: string,
): Forecast {
  const levels: ['job_key' | 'workflow' | 'repository', readonly HistoryPoint[]][] = [
    ['job_key', chain.jobKey],
    ['workflow', chain.workflow],
    ['repository', chain.repository],
  ];
  for (const [basis, points] of levels) {
    const u = usableHistory(points, now, machine);
    if (u.points.length >= MIN_SAMPLES)
      return forecastFromSamples(
        u.points.map((p) => p.seconds),
        basis,
        u.machine,
      );
  }
  return noHistory(usableHistory(chain.jobKey, now).points.length);
}

export interface DagNode {
  id: string;
  needs: readonly string[];
  /** Remaining seconds of the node: 0 for a finished node, the rest for a running one, the whole for a queued one. */
  remaining: Eta;
}

/** Nodes in an order where every node comes after the nodes it needs. A cycle or a missing need is ignored. */
export function topoOrder(nodes: readonly DagNode[]): DagNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const out: DagNode[] = [];
  const visit = (n: DagNode, stack: Set<string>) => {
    if (seen.has(n.id) || stack.has(n.id)) return;
    stack.add(n.id);
    for (const need of n.needs) {
      const dep = byId.get(need);
      if (dep) visit(dep, stack);
    }
    stack.delete(n.id);
    seen.add(n.id);
    out.push(n);
  };
  for (const n of nodes) visit(n, new Set());
  return out;
}

/** The longest path over the needs graph, for one of the three durations: its node ids and its total. */
export function criticalPath(
  nodes: readonly DagNode[],
  pick: keyof Eta = 'p50',
): { path: string[]; total: number } {
  const finish = new Map<string, number>();
  const via = new Map<string, string | undefined>();
  for (const n of topoOrder(nodes)) {
    let start = 0;
    let from: string | undefined;
    for (const need of n.needs) {
      const f = finish.get(need);
      if (f !== undefined && f >= start) {
        start = f;
        from = need;
      }
    }
    finish.set(n.id, start + n.remaining[pick]);
    via.set(n.id, from);
  }
  let last: string | undefined;
  let total = 0;
  for (const [id, f] of finish) {
    if (last === undefined || f > total) {
      last = id;
      total = f;
    }
  }
  const path: string[] = [];
  for (let at = last; at !== undefined; at = via.get(at)) path.unshift(at);
  return { path, total };
}

/** The ETA of a run, from now: the longest path with the low, median and high durations. */
export function runEta(nodes: readonly DagNode[]): Eta {
  return {
    p50: criticalPath(nodes, 'p50').total,
    lo: criticalPath(nodes, 'lo').total,
    hi: criticalPath(nodes, 'hi').total,
  };
}

export interface QueueSim {
  /** Seconds left of each running job on a slot (its median forecast minus the time it has run, at least 0). */
  runningLeft: readonly number[];
  /** Free slots now. */
  freeSlots: number;
  /** The run time of each queued job ahead of this one, in queue order. */
  ahead: readonly Eta[];
}

/**
 * When a queued job starts, from now: the jobs ahead take the slots in order, each slot free again after its job's
 * run time; the job starts on the first slot that frees. Run for the low, median and high run times.
 */
export function queueEta(sim: QueueSim): Eta {
  const one = (pick: keyof Eta): number => {
    const slots = [
      ...sim.runningLeft.map((s) => Math.max(0, s)),
      ...Array<number>(Math.max(0, sim.freeSlots)).fill(0),
    ];
    if (slots.length === 0) return Number.POSITIVE_INFINITY;
    for (const job of sim.ahead) {
      slots.sort((a, b) => a - b);
      slots[0] = (slots[0] as number) + job[pick];
    }
    slots.sort((a, b) => a - b);
    return slots[0] as number;
  };
  return { p50: one('p50'), lo: one('lo'), hi: one('hi') };
}

/** The share of finished jobs whose actual time fell inside their forecast range. */
export function insideRange(
  points: readonly { actual: number; lo: number; hi: number }[],
): number {
  if (points.length === 0) return 0;
  return (
    points.filter((p) => p.actual >= p.lo && p.actual <= p.hi).length / points.length
  );
}
