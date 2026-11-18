import { describe, expect, it } from 'vitest';
import {
  chainForecast,
  criticalPath,
  forecastFromSamples,
  insideRange,
  percentile,
  queueEta,
  runEta,
  usableHistory,
  type DagNode,
} from './forecast';
import type { HistoryPoint } from './model';

const eta = (n: number) => ({ p50: n, lo: n * 0.8, hi: n * 1.5 });

describe('percentile', () => {
  it('interpolates and handles the edges', () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([10], 0.9)).toBe(10);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([4, 1, 3, 2], 0)).toBe(1);
    expect(percentile([4, 1, 3, 2], 1)).toBe(4);
  });
});

describe('forecastFromSamples', () => {
  it('has no forecast under 5 samples', () => {
    const f = forecastFromSamples([10, 11, 12, 13], 'job_key');
    expect(f.basis).toBe('not_enough_history');
    expect(f.samples).toBe(4);
  });
  it('takes the median and p25..p90', () => {
    const f = forecastFromSamples(
      [100, 100, 100, 100, 100, 100, 100, 100, 100, 300],
      'job_key',
    );
    expect(f.p50).toBe(100);
    expect(f.lo).toBeLessThanOrEqual(90);
    expect(f.hi).toBeGreaterThanOrEqual(110);
    expect(f.basis).toBe('job_key');
    expect(f.samples).toBe(10);
  });
  it('widens a tight range to at least 10 percent either side', () => {
    const f = forecastFromSamples([100, 100, 100, 100, 100, 101], 'job_key');
    expect(f.lo).toBeCloseTo(90, 5);
    expect(f.hi).toBeCloseTo(110, 5);
  });
});

const NOW = Date.parse('2026-11-18T14:30:00Z');
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const hp = (
  daysAgo: number,
  seconds: number,
  over: Partial<HistoryPoint> = {},
): HistoryPoint => ({
  at: day(daysAgo),
  seconds,
  result: 'success',
  branch: 'main',
  ...over,
});

describe('usableHistory', () => {
  it('keeps successes of the last 90 days, the newest 30', () => {
    const h = [
      ...Array.from({ length: 40 }, (_, i) => hp(41 - i, 100 + i)),
      hp(0.5, 999, { result: 'failure' }),
      hp(120, 5),
    ];
    const u = usableHistory(h, NOW);
    expect(u.points).toHaveLength(30);
    expect(u.points.map((p) => p.seconds)).not.toContain(999);
    expect(u.points.map((p) => p.seconds)).not.toContain(5);
    expect(u.points[29]?.seconds).toBe(139);
  });
  it('prefers the same machine with 5 samples, else all', () => {
    const h = [
      ...Array.from({ length: 6 }, (_, i) => hp(10 - i, 50, { machine: 'linux-box' })),
      ...Array.from({ length: 6 }, (_, i) => hp(20 - i, 90, { machine: 'GameRoomPC' })),
    ];
    expect(usableHistory(h, NOW, 'linux-box').points).toHaveLength(6);
    expect(usableHistory(h, NOW, 'linux-box').machine).toBe('linux-box');
    expect(
      usableHistory(h.slice(0, 3).concat(h.slice(6)), NOW, 'linux-box').machine,
    ).toBeUndefined();
  });
});

describe('drift', () => {
  it('uses the last 10 when the median moved by more than a quarter', () => {
    const f = forecastFromSamples(
      [...Array<number>(20).fill(100), ...Array<number>(10).fill(160)],
      'job_key',
    );
    expect(f.changed_lately).toBe(true);
    expect(f.p50).toBe(160);
    expect(f.samples).toBe(10);
  });
  it('stays on the whole sample when steady', () => {
    const f = forecastFromSamples(
      [...Array<number>(20).fill(100), ...Array<number>(10).fill(110)],
      'job_key',
    );
    expect(f.changed_lately).toBeUndefined();
    expect(f.samples).toBe(30);
  });
});

describe('chainForecast', () => {
  const few = [1, 2, 3].map((n) => hp(n, 10));
  const many = [50, 52, 51, 53, 50, 54].map((n, i) => hp(i + 1, n));
  it('uses the job key when it has enough samples', () => {
    expect(
      chainForecast({ jobKey: many, workflow: few, repository: few }, NOW).basis,
    ).toBe('job_key');
  });
  it('falls back to the workflow, then the repository', () => {
    expect(
      chainForecast({ jobKey: few, workflow: many, repository: few }, NOW).basis,
    ).toBe('workflow');
    expect(
      chainForecast({ jobKey: few, workflow: few, repository: many }, NOW).basis,
    ).toBe('repository');
  });
  it('says not enough history when nothing has 5', () => {
    const f = chainForecast({ jobKey: few, workflow: few, repository: few }, NOW);
    expect(f.basis).toBe('not_enough_history');
    expect(f.samples).toBe(3);
  });
});

describe('criticalPath and runEta', () => {
  const node = (id: string, needs: string[], n: number): DagNode => ({
    id,
    needs,
    remaining: eta(n),
  });
  const dag = [
    node('lint', [], 60),
    node('types', [], 90),
    node('unit', ['lint'], 200),
    node('e2e', ['unit', 'types'], 300),
    node('docs', [], 20),
  ];
  it('finds the longest path', () => {
    const c = criticalPath(dag);
    expect(c.path).toEqual(['lint', 'unit', 'e2e']);
    expect(c.total).toBe(560);
  });
  it('orders nodes given out of order', () => {
    expect(criticalPath([...dag].reverse()).path).toEqual(['lint', 'unit', 'e2e']);
  });
  it('gives a range ETA', () => {
    const e = runEta(dag);
    expect(e.p50).toBe(560);
    expect(e.lo).toBeCloseTo(448, 5);
    expect(e.hi).toBeCloseTo(840, 5);
  });
  it('counts a finished node as zero', () => {
    const done = dag.map((n) =>
      n.id === 'lint' ? { ...n, remaining: { p50: 0, lo: 0, hi: 0 } } : n,
    );
    expect(criticalPath(done).total).toBe(500);
  });
  it('survives a cycle and an empty graph', () => {
    const odd = [node('a', ['b'], 10), node('b', ['a', 'ghost'], 10)];
    expect(criticalPath(odd).total).toBeGreaterThan(0);
    expect(criticalPath([]).path).toEqual([]);
  });
});

describe('queueEta', () => {
  it('starts at once with a free slot and nobody ahead', () => {
    expect(queueEta({ runningLeft: [], freeSlots: 1, ahead: [] }).p50).toBe(0);
  });
  it('waits for the first running job to end when no slot is free', () => {
    expect(queueEta({ runningLeft: [120, 300], freeSlots: 0, ahead: [] }).p50).toBe(120);
  });
  it('lets the jobs ahead take the slots in order', () => {
    const e = queueEta({ runningLeft: [100], freeSlots: 1, ahead: [eta(50), eta(200)] });
    // slots [0, 100]: job 1 takes slot 0 (ends 50); job 2 takes the slot free at 50 (ends 250); we start at 100.
    expect(e.p50).toBe(100);
    expect(e.hi).toBeGreaterThanOrEqual(e.p50);
    expect(e.lo).toBeLessThanOrEqual(e.p50);
  });
  it('is unbounded with no slot at all', () => {
    expect(queueEta({ runningLeft: [], freeSlots: 0, ahead: [] }).p50).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe('insideRange', () => {
  it('counts the share inside the range', () => {
    expect(insideRange([])).toBe(0);
    expect(
      insideRange([
        { actual: 5, lo: 1, hi: 10 },
        { actual: 50, lo: 1, hi: 10 },
      ]),
    ).toBe(0.5);
  });
});
