import { describe, expect, it } from 'vitest';
import { buildFixtures } from './fixtures';

describe('review fixtures', () => {
  const a = buildFixtures();
  it('is deterministic', () => {
    expect(JSON.stringify(buildFixtures().jobs.slice(0, 20))).toBe(
      JSON.stringify(a.jobs.slice(0, 20)),
    );
  });
  it('has the counts the review needs', () => {
    const n = (s: string) => a.jobs.filter((j) => j.state === s).length;
    console.info('fixture counts', n('queued'), n('running'), n('done'), a.runs.length);
    expect(a.jobs.filter((j) => j.queue_position !== undefined)).toHaveLength(
      a.jobs.filter((j) => j.state === 'queued' && j.wait_reason).length,
    );
    expect(n('running')).toBe(8);
    expect(n('done')).toBeGreaterThan(140);
    expect(n('done')).toBeLessThan(200);
    expect(
      a.jobs.filter((j) => j.queue_position !== undefined).length,
    ).toBeGreaterThanOrEqual(12);
  });
  it('has a retried attempt, matrix jobs, a 14-job run and some worktrees', () => {
    expect(a.runs.some((r) => r.attempt === 2)).toBe(true);
    expect(a.jobs.some((j) => j.matrix.length === 2)).toBe(true);
    expect(a.runs.some((r) => r.jobs.length === 14)).toBe(true);
    const wt = a.jobs.filter((j) => j.worktree).length;
    expect(wt).toBeGreaterThan(2);
    expect(wt).toBeLessThan(a.jobs.length / 2);
    for (const r of ['success', 'failure', 'cancelled', 'timed_out']) {
      expect(a.jobs.some((j) => j.result === r)).toBe(true);
    }
  });
});
