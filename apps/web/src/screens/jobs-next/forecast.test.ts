import { describe, expect, it } from 'vitest';
import {
  chainForecast,
  criticalPath,
  forecastFromSamples,
  insideRange,
  percentile,
  queueEta,
  runEta,
  usableSamples,
  type DagNode,
} from './forecast';
import type { HistoryPoint } from './model';

const pt = (i: number, seconds: number, over: Partial<HistoryPoint> = {}): HistoryPoint => ({
  at: `2026-10-${String(1 + i).padStart(2, '0')}T10:00:00Z`,
  seconds,
  result: 'success',
  branch: 'main',
  ...over,
});
const series = (xs: number[]) => xs.map((s, i) => pt(i, s));
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
    const f = forecastFromSamples([100, 100, 100, 100, 100, 100, 100, 100, 100, 300], 'job_key');
    expect(f.p50).toBe(100);
    expect(f.lo).toBeLessThanOrEqual(90);
    expect(f.hi).toBeGreaterThan(110);
    expect(f.basis).toBe('job_key');
    expect(f.samples).toBe(10);
  });
  it('widens a tight range to at least 10 percent either side', () => {
    const f = forecastFromSamples([100, 100, 100, 100, 100, 101], 'job_key');
    expect(f.lo).toBeCloseTo(90, 5);
    expect(f.hi).toBeCloseTo(110, 5);
  });
});

describe('usableSamples', () => {
  it('keeps successes on main or the branch, the newest 20', () => {
    const history = [
      ...series(Array.from({ length: 25 }, (_, i) => 100 + i)),
      pt(26, 999, { result: 'failure' }),
      pt(27, 888, { branch: 'other' }),
      pt(28, 777, { branch: 'feature' }),
    ];
    const s = usableSamples(history, 'feature');
    expect(s).toHaveLength(20);
    expect(s).not.toContain(999);
    expect(s).not.toContain(888);
    expect(s[19]).toBe(777);
    expect(usableSamples(history, 'x')).not.toContain(777);
  });
});

describe('chainForecast', () => {
  const few = series([1, 2, 3]);
  const many = series([50, 52, 51, 53, 50, 54]);
  it('uses the job key when it has enough samples', () => {
    expect(chainForecast({ jobKey: many, workflow: few, repository: few }, 'main').basis).toBe(
      'job_key',
    );
  });
  it('falls back to the workflow, then the repository', () => {
    expect(chainForecast({ jobKey: few, workflow: many, repository: few }, 'main').basis).toBe(
      'workflow',
    );
    expect(chainForecast({ jobKey: few, workflow: few, repository: many }, 'main').basis).toBe(
      'repository',
    );
  });
  it('says not enough history when nothing has 5', () => {
    const f = chainForecast({ jobKey: few, workflow: few, repository: few }, 'main');
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
