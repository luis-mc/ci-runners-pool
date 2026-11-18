// One line about a run: the numbers a Queue, Running or Done row shows (owner decision A, 18 Nov 2026). A run is
// one row; its jobs are the next level, its steps the one after.
import type { StatusKind } from '@crsp/ui';
import type { JobItem, RunItem } from './model';
import { ranSeconds } from './words';

export interface RunSummary {
  total: number;
  doneJobs: number;
  queuedJobs: number;
  runningJobs: JobItem[];
  /** Seconds from the first queue time to now (open run) or to the last end (done run). */
  elapsed: number;
  finishedAt: string | undefined;
  slowest: { job: JobItem; seconds: number } | undefined;
  /** Smallest queue place among the run's queued jobs. */
  place: number | undefined;
  /** The queued job that is next in line, for the start range and the reason. */
  next: JobItem | undefined;
  result: { kind: StatusKind; word: string };
}

const WORSE: Record<string, number> = { failure: 3, timed_out: 3, cancelled: 2, lost: 2 };

export function summarize(run: RunItem, now: number): RunSummary {
  const jobs = run.jobs;
  const done = jobs.filter((j) => j.state === 'done');
  const queued = jobs.filter((j) => j.state === 'queued');
  const running = jobs.filter((j) => j.state === 'running');
  const start = Math.min(
    ...jobs.map((j) => (j.queued_at ? Date.parse(j.queued_at) : now)),
    now,
  );
  const ends = done.flatMap((j) => (j.completed_at ? [Date.parse(j.completed_at)] : []));
  const last = ends.length ? Math.max(...ends) : undefined;
  const open = run.state !== 'done';
  const timed = jobs
    .map((j) => ({ job: j, seconds: ranSeconds(j, now) ?? 0 }))
    .filter((x) => x.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
  const queuedPlaced = queued
    .filter((j) => j.queue_position !== undefined)
    .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
  const bad = done
    .filter((j) => j.result && j.result !== 'success')
    .sort((a, b) => (WORSE[b.result ?? ''] ?? 1) - (WORSE[a.result ?? ''] ?? 1))[0];
  let result: RunSummary['result'];
  if (run.state === 'running') result = { kind: 'running', word: 'running' };
  else if (run.state === 'queued') result = { kind: 'waiting', word: 'waiting' };
  else if (!bad) result = { kind: 'ok', word: 'success' };
  else if (bad.result === 'cancelled') result = { kind: 'off', word: 'cancelled' };
  else
    result = {
      kind: 'failed',
      word: bad.result === 'timed_out' ? 'timed out' : 'failure',
    };
  return {
    total: jobs.length,
    doneJobs: done.length,
    queuedJobs: queued.length,
    runningJobs: running,
    elapsed: Math.max(0, ((open || last === undefined ? now : last) - start) / 1000),
    finishedAt: open || last === undefined ? undefined : new Date(last).toISOString(),
    slowest: timed[0],
    place: queuedPlaced[0]?.queue_position,
    next: queuedPlaced[0],
    result,
  };
}
