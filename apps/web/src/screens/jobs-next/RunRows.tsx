// A run as one row (owner decision A, 18 Nov 2026): the columns of the Queue, Running and Done lists, and the detail
// that opens in place: the jobs of the run as a waterfall, each job opening to its steps.
import {
  CappedList,
  Cluster,
  LinkButton,
  ShortText,
  Stack,
  Status,
  Text,
  TextLink,
  Waterfall,
  formatShortDateTime,
  formatDuration,
  type Column,
} from '@crsp/ui';
import { runRows } from './runViews';
import { summarize } from './runSummary';
import type { JobItem, RunItem } from './model';
import { etaOne, startRange, sourceWords, taskIdOf, waitWords } from './words';

export type RunKind = 'queue' | 'running' | 'done';

/** The branch cut in the middle; the task id is added only when the cut hides it. Worktree: see the detail. */
export function BranchWords({ branch, max = 16 }: { branch: string; max?: number }) {
  const task = taskIdOf(branch);
  return (
    <>
      <ShortText text={branch} max={max} />
      {task && branch.length > max ? ` (task ${task})` : ''}
    </>
  );
}

export function runColumns(kind: RunKind, now: number): Column<RunItem>[] {
  const sum = (r: RunItem) => summarize(r, now);
  const repo: Column<RunItem> = {
    id: 'repo',
    header: 'Repository',
    cell: (r) => r.repository.split('/')[1] ?? r.repository,
    sort: (r) => r.repository,
  };
  const workflow: Column<RunItem> = {
    id: 'workflow',
    header: 'Workflow',
    cell: (r) => (
      <>
        <TextLink to={`/jobs/run/${r.id}?attempt=${r.attempt}`}>{r.workflow}</TextLink>
        {` #${r.id}${r.attempt > 1 ? `, attempt ${r.attempt}` : ''}`}
      </>
    ),
    title: (r) => `${r.workflow} #${r.id}${r.attempt > 1 ? `, attempt ${r.attempt}` : ''}`,
    sort: (r) => r.workflow,
  };
  const branch: Column<RunItem> = {
    id: 'branch',
    header: 'Branch',
    cell: (r) => <BranchWords branch={r.branch} />,
    title: (r) => r.branch,
    sort: (r) => r.branch,
    secondary: true,
  };
  const source: Column<RunItem> = {
    id: 'source',
    header: 'Commit and event',
    cell: (r) => sourceWords(r),
    secondary: true,
  };
  const status: Column<RunItem> = {
    id: 'status',
    header: 'Result',
    cell: (r) => {
      const s = sum(r).result;
      return <Status kind={s.kind} word={s.word} />;
    },
    sort: (r) => sum(r).result.word,
  };
  const doneOf: Column<RunItem> = {
    id: 'jobs',
    header: 'Jobs done',
    cell: (r) => `${sum(r).doneJobs} of ${sum(r).total}`,
    sort: (r) => sum(r).doneJobs / Math.max(1, sum(r).total),
    secondary: true,
  };
  if (kind === 'queue')
    return [
      {
        id: 'order',
        header: 'Place',
        cell: (r) => String(sum(r).place ?? ''),
        sort: (r) => sum(r).place ?? 0,
      },
      repo,
      workflow,
      branch,
      source,
      {
        id: 'queued',
        header: 'Jobs queued',
        cell: (r) => `${sum(r).queuedJobs} of ${sum(r).total}`,
        sort: (r) => sum(r).queuedJobs,
        secondary: true,
      },
      {
        id: 'starts',
        header: 'Starts',
        cell: (r) => {
          const e = sum(r).next?.queue_eta;
          return e ? startRange(e) : 'not known';
        },
        sort: (r) => sum(r).next?.queue_eta?.p50 ?? 0,
      },
      {
        id: 'why',
        header: 'Why it waits',
        cell: () => null,
        long: (r) => {
          const n = sum(r).next;
          return n ? { full: waitWords(n) } : null;
        },
        secondary: true,
      },
    ];
  if (kind === 'running')
    return [
      repo,
      workflow,
      branch,
      source,
      doneOf,
      {
        id: 'now',
        header: 'Running now',
        cell: (r) => (
          <CappedList items={sum(r).runningJobs.map((j) => j.job_name)} max={1} />
        ),
        title: (r) => sum(r).runningJobs.map((j) => j.job_name).join(', '),
        secondary: true,
      },
      {
        id: 'elapsed',
        header: 'Time so far',
        cell: (r) => formatDuration(sum(r).elapsed),
        sort: (r) => sum(r).elapsed,
        secondary: true,
      },
      {
        id: 'ends',
        header: 'Ends',
        cell: (r) => (r.eta ? etaOne(r.eta) : 'not known'),
        sort: (r) => r.eta?.p50 ?? 0,
        secondary: true,
      },
      status,
    ];
  return [
    {
      id: 'finished',
      header: 'Finished',
      cell: (r) => {
        const f = sum(r).finishedAt;
        return f ? formatShortDateTime(f) : 'not known';
      },
      sort: (r) => sum(r).finishedAt ?? '',
    },
    repo,
    workflow,
    branch,
    source,
    doneOf,
    {
      id: 'took',
      header: 'Total time',
      cell: (r) => formatDuration(sum(r).elapsed),
      sort: (r) => sum(r).elapsed,
      secondary: true,
    },
    {
      id: 'slowest',
      header: 'Slowest job',
      cell: (r) => {
        const s = sum(r).slowest;
        return s ? `${formatDuration(s.seconds)}, ${s.job.job_name}` : 'none';
      },
      secondary: true,
    },
    status,
  ];
}

/** What opens under a run row: its jobs on one time line; a job opens to its steps. */
export function RunDetail({
  run,
  now,
  open,
}: {
  run: RunItem;
  now: number;
  open: (j: JobItem) => void;
}) {
  const view = runRows(run, now, open);
  return (
    <Stack>
      <Text tone="muted">
        {`Run ${run.id}${run.attempt > 1 ? `, attempt ${run.attempt}` : ''}, ${run.jobs.length} jobs: queue wait is the light part of a bar, the run the dark part. Open a job to see its steps. Branch: ${run.branch}. Task: ${taskIdOf(run.branch) ?? 'none in the branch name'}. Worktree: ${run.worktree ?? 'not reported'}.`}
      </Text>
      <Waterfall
        label={`Jobs of run ${run.id}`}
        rows={view.rows}
        totalSec={view.totalSec}
        {...(view.nowSec !== undefined ? { nowSec: view.nowSec } : {})}
        emptyText="This run has no jobs."
      />
      <Cluster>
        <LinkButton to={`/jobs/run/${run.id}?attempt=${run.attempt}`}>
          Open run page
        </LinkButton>
      </Cluster>
    </Stack>
  );
}
