// The words of the Jobs section: durations, ranges, forecasts and their basis (design system content.md, "Jobs
// section"). One place, so a table, a fact and a chart say the same thing.
import { formatDuration } from '@crsp/ui';
import { jobStatus, waitWords } from '../jobs/Jobs';
import type { Eta, Forecast, JobItem } from './model';

export { jobStatus, waitWords };

/** "about 6 to 9 min", "about 40 to 55 s": a range in seconds, rounded for reading. */
export function rangeWords(lo: number, hi: number): string {
  if (hi < 90) return `about ${Math.round(lo)} to ${Math.round(hi)} s`;
  const m = (s: number) => Math.max(1, Math.round(s / 60));
  const a = m(lo);
  const b = m(hi);
  if (hi >= 3600) return `about ${formatDuration(lo)} to ${formatDuration(hi)}`;
  return a === b ? `about ${a} min` : `about ${a} to ${b} min`;
}

export const NO_FORECAST = 'not enough history yet';

/** The forecast range of a job or a step in words; "not enough history yet" when there are fewer than 5 samples. */
export function forecastWords(f: Forecast): string {
  return f.basis === 'not_enough_history' ? NO_FORECAST : rangeWords(f.lo, f.hi);
}

/** Where the forecast comes from, in words ("median of the last 30 runs on linux-box"). */
export function basisWords(f: Forecast): string {
  const tail = f.changed_lately ? ', changed lately, so the last 10 runs count' : '';
  switch (f.basis) {
    case 'job_key':
      return `median of the last ${f.samples} runs on ${f.machine ?? 'all machines'}${tail}`;
    case 'workflow':
      return `median of the last ${f.samples} runs of the jobs of this workflow${tail}`;
    case 'repository':
      return `median of the last ${f.samples} runs of this repository${tail}`;
    default:
      return `${f.samples} of 5 runs needed, so no number is made up`;
  }
}

export function etaWords(e: Eta): string {
  return e.p50 < 20 ? 'now' : `in ${rangeWords(e.lo, e.hi)}`;
}

export function secondsOrNone(n: number | undefined): string {
  return n === undefined ? 'not yet' : formatDuration(n);
}

/** Seconds a job waited: the time since it queued while it waits, the recorded wait once it has started. */
export function waitedSeconds(j: JobItem, now: number): number | undefined {
  if (j.state === 'queued')
    return j.queued_at ? Math.max(0, (now - Date.parse(j.queued_at)) / 1000) : undefined;
  return j.github_wait_seconds;
}

/** Seconds a job ran: so far while it runs, the recorded time once it is done. */
export function ranSeconds(j: JobItem, now: number): number | undefined {
  if (j.state === 'running' && j.started_at)
    return Math.max(0, (now - Date.parse(j.started_at)) / 1000);
  return j.run_seconds;
}

export const RUNNER_KIND_WORDS = {
  persistent: 'persistent, state kept between jobs',
  ephemeral: 'ephemeral, fresh for every job',
} as const;

export const JOB_TYPE_WORDS = {
  light: 'Light',
  standard: 'Standard',
  heavy: 'Heavy',
} as const;

/** "owner/name" to the two parts the repository page uses. */
export function repoPath(full: string): string {
  return `/repositories/${full}`;
}
