// A run as one row (owner decision A, 18 Nov 2026): the columns of the Queue, Running and Done lists, and the detail
// that opens in place: the jobs of the run as a waterfall, each job opening to its steps. The list answers without the
// jobs of a run, so the detail reads the run when it opens.
import {
  CappedList,
  Cluster,
  Cut,
  Empty,
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
import { Load } from '../common';
import { useRun } from './api';
import { elapsedSeconds, runKey, type RunRow } from './runList';
import { runRows } from './runViews';
import {
  etaOne,
  commitWords,
  eventWords,
  jobStatus,
  startRange,
  taskIdOf,
  taskOf,
  type Job,
} from './words';
import { waitWords } from './words';

export type RunKind = 'queue' | 'running' | 'done';

/** The branch cut in the middle; the task id is added only when the cut hides it. Worktree: see the detail. */
export function BranchWords({
  branch,
  task,
  max = 16,
}: {
  branch: string;
  task?: string | undefined;
  max?: number;
}) {
  const id = task ?? taskIdOf(branch);
  return (
    <>
      <ShortText text={branch} max={max} />
      {id && branch.length > max ? ` (task ${id})` : ''}
    </>
  );
}

/** The result of a run in a word, a glyph and a colour: the state while it is open, else the result. */
export function runStatus(r: Pick<RunRow, 'state' | 'result'>) {
  return jobStatus(r);
}

export function runColumns(kind: RunKind, _now: number): Column<RunRow>[] {
  const repo: Column<RunRow> = {
    id: 'repo',
    header: 'Repository',
    cell: (r) => r.repository.split('/')[1] ?? r.repository,
    sort: (r) => r.repository,
    kind: 'grow',
  };
  const workflow: Column<RunRow> = {
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
  const branch: Column<RunRow> = {
    id: 'branch',
    header: 'Branch',
    cell: (r) => <BranchWords branch={r.branch} task={r.task_id} />,
    middle: (r) => r.branch,
    title: (r) => r.branch,
    sort: (r) => r.branch,
    kind: 'grow',
    secondary: true,
  };
  const commit: Column<RunRow> = {
    id: 'commit',
    header: 'Commit',
    cell: (r) => commitWords(r),
    sort: (r) => commitWords(r),
    kind: 'fit',
    secondary: true,
  };
  const event: Column<RunRow> = {
    id: 'event',
    header: 'Event',
    cell: (r) => eventWords(r),
    sort: (r) => eventWords(r),
    kind: 'fit',
    secondary: true,
  };
  const status: Column<RunRow> = {
    id: 'status',
    header: 'Result',
    cell: (r) => {
      const s = runStatus(r);
      return <Status kind={s.kind} word={s.word} />;
    },
    sort: (r) => runStatus(r).word,
  };
  const doneOf: Column<RunRow> = {
    id: 'jobs',
    header: 'Jobs done',
    cell: (r) =>
      r.jobsTotal === undefined ? 'not known' : `${r.jobsDone ?? 0} of ${r.jobsTotal}`,
    sort: (r) => (r.jobsDone ?? 0) / Math.max(1, r.jobsTotal ?? 1),
    secondary: true,
  };
  if (kind === 'queue')
    return [
      {
        id: 'order',
        header: 'Place',
        cell: (r) => String(r.queued[0]?.queue_position ?? ''),
        sort: (r) => r.queued[0]?.queue_position ?? 0,
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
          const e = r.queued[0]?.queue_eta;
          return e ? startRange(e) : 'not known';
        },
        sort: (r) => r.queued[0]?.queue_eta?.p50 ?? 0,
      },
      {
        id: 'why',
        header: 'Why it waits',
        cell: () => null,
        kind: 'grow',
        long: (r) => {
          const n = r.queued[0];
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
        cell: (r) => <CappedList items={r.running.map((j) => j.job_name)} max={1} />,
        title: (r) => r.running.map((j) => j.job_name).join(', '),
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
      cell: (r) => (r.completed_at ? formatShortDateTime(r.completed_at) : 'not known'),
      sort: (r) => r.completed_at ?? '',
    },
    repo,
    workflow,
    branch,
    commit,
    event,
    doneOf,
    {
      id: 'failed',
      header: 'Jobs failed',
      cell: (r) => String(r.jobsFailed ?? 0),
      sort: (r) => r.jobsFailed ?? 0,
      secondary: true,
    },
    status,
  ];
}

/** What opens under a run row: its jobs on one time line; a job opens to its steps. */
export function RunDetail({
  row,
  now,
  open,
}: {
  row: RunRow;
  now: number;
  open: (j: Job) => void;
}) {
  const { result, reload } = useRun(row.id, row.attempt, row.state !== 'done');
  return (
    <Load result={result} what="the run" reload={reload}>
      {(run) => {
        const view = runRows(run, now, open);
        return (
          <Stack>
            <Text tone="muted">
              {`Run ${run.id}${run.attempt > 1 ? `, attempt ${run.attempt}` : ''}, ${run.jobs.length} ${run.jobs.length === 1 ? 'job' : 'jobs'}: queue wait is the light part of a bar, the run the dark part. Open a job to see its steps. ${row.state === 'done' ? 'Total time' : 'Time so far'}: ${formatDuration(elapsedSeconds(row, now))}. Jobs: ${row.jobsDone ?? 0} of ${row.jobsTotal ?? run.jobs.length} done, ${row.queued.length} queued. Branch: ${run.branch}. Task: ${taskOf(run)}. Worktree: ${run.worktree ?? 'not reported'}.`}
            </Text>
            {run.jobs.length === 0 ? (
              <Empty title="This run has no jobs yet." />
            ) : (
              <Waterfall
                label={`Jobs of run ${run.id}`}
                rows={view.rows}
                totalSec={view.totalSec}
                {...(view.nowSec !== undefined ? { nowSec: view.nowSec } : {})}
                emptyText="This run has no jobs."
              />
            )}
            <Cluster>
              <LinkButton to={`/jobs/run/${run.id}?attempt=${run.attempt}`}>
                Open run page
              </LinkButton>
            </Cluster>
          </Stack>
        );
      }}
    </Load>
  );
}

export { runKey };
