// The basis of a run's end forecast, in words (owner decision 4: a range, with its basis, on the Run page).
import type { RunItem } from './model';

export function basisFor(run: RunItem): string {
  const n = run.critical_path.length;
  if (run.graph?.source === 'timing' || n === 0)
    return 'longest job still to run, no dependencies known';
  return `along the longest chain of ${n} ${n === 1 ? 'job' : 'jobs'}, adding the middle runs of each (quartiles for the range)`;
}

/** Where the arrows come from, in words (owner decision 3). */
export function graphSource(run: RunItem): string {
  if (run.graph?.source === 'timing')
    return 'The workflow file at this commit could not be read, so no arrows are drawn: jobs that ran at the same time are shown side by side. This is a guess from timing, not from the workflow.';
  return `Arrows come from the workflow file at commit ${run.head_sha.slice(0, 7)} (read once per commit and kept). A matrix or a reusable workflow is marked "expands at run time".`;
}
