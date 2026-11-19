// A run as one row (owner decision A, 18 Nov 2026): the columns of the Queue, Running and Done lists, and the detail
// that opens in place: the jobs of the run as a waterfall, each job opening to its steps.
import {
  CappedList,
  Cluster,
  Cut,
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
import {
  commitWords,
  etaOne,
  eventWords,
  startRange,
  taskIdOf,
  waitWords,
} from './words';

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
    kind: 'grow',
  };
  const workflow: Column<RunItem> = {
    id: 'workflow',
    header: 'Workflow',
    cell: (r) => (
      <Cut tail={` #${r.id}${r.attempt > 1 ? `, attempt ${r.attempt}` : ''}`}>
        <TextLink to={`/jobs/run/${r.id}?attempt=${r.attempt}`}>{r.workflow}</TextLink>
      </Cut>
    ),
    kind: 'grow',
    title: (r) =>
      `${r.workflow} #${r.id}${r.attempt > 1 ? `, attempt ${r.attempt}` : ''}`,
    sort: (r) => r.workflow,
  };
  const branch: Column<RunItem> = {
    id: 'branch',
    header: 'Branch',
    cell: (r) => <BranchWords branch={r.branch} />,
    middle: (r) => r.branch,
    title: (r) => r.branch,
    sort: (r) => r.branch,
    kind: 'grow',
    secondary: true,
  };
  const commit: Column<RunItem> = {
    id: 'commit',
    header: 'Commit',
    cell: (r) => commitWords(r),
    sort: (r) => commitWords(r),
    kind: 'fit',
    secondary: true,
  };
  const event: Column<RunItem> = {
    id: 'event',
    header: 'Event',
    cell: (r) => eventWords(r),
    sort: (r) => eventWords(r),
    kind: 'fit',
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
      commit,
      event,
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
        kind: 'grow',
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
      commit,
      event,
      doneOf,
      {
        id: 'now',
        header: 'Running now',
        cell: (r) => (
          <CappedList items={sum(r).runningJobs.map((j) => j.job_name)} max={1} />
        ),
        title: (r) =>
          sum(r)
            .runningJobs.map((j) => j.job_name)
            .join(', '),
        kind: 'grow',
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
    commit,
    event,
    doneOf,
    {
      id: 'slowest',
      header: 'Slowest job',
      cell: (r) => {
        const s = sum(r).slowest;
        return s ? (
          <Cut tail={`, ${formatDuration(s.seconds)}`}>{s.job.job_name}</Cut>
        ) : (
          'none'
        );
      },
      title: (r) => {
        const s = sum(r).slowest;
        return s ? `${s.job.job_name}, ${formatDuration(s.seconds)}` : 'none';
      },
      sort: (r) => sum(r).slowest?.seconds ?? 0,
      kind: 'grow',
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
  const facts = summarize(run, now);
  return (
    <Stack>
      <Text tone="muted">
        {`Run ${run.id}${run.attempt > 1 ? `, attempt ${run.attempt}` : ''}, ${run.jobs.length} jobs: queue wait is the light part of a bar, the run the dark part. Open a job to see its steps. ${facts.finishedAt ? 'Total time' : 'Time so far'}: ${formatDuration(facts.elapsed)}. Jobs: ${facts.doneJobs} of ${facts.total} done, ${facts.queuedJobs} queued. Branch: ${run.branch}. Task: ${taskIdOf(run.branch) ?? 'none in the branch name'}. Worktree: ${run.worktree ?? 'not reported'}.`}
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
