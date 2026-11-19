// A run as one row (owner decision A, 18 Nov 2026): the columns of the Queue, Running and Done lists. The row action
// Open run goes straight to the Run page (OPS43), as Open job goes to the Job page.
import {
  CappedList,
  Cut,
  ShortText,
  Status,
  TextLink,
  formatShortDateTime,
  type Column,
} from '@crsp/ui';
import { runKey, type RunRow } from './runList';
import {
  etaOne,
  commitWords,
  eventWords,
  jobStatus,
  startRange,
  taskIdOf,
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
    grow: 2,
  };
  const workflow: Column<RunRow> = {
    id: 'workflow',
    header: 'Workflow',
    cell: (r) => (
      <Cut tail={` #${r.id}${r.attempt > 1 ? `, attempt ${r.attempt}` : ''}`}>
        <TextLink to={runPath(r)}>{r.workflow}</TextLink>
      </Cut>
    ),
    kind: 'grow',
    grow: 2,
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
    grow: 1,
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

/** Where a run row opens: the Run page of that attempt. */
export function runPath(r: Pick<RunRow, 'id' | 'attempt'>): string {
  return `/jobs/run/${r.id}?attempt=${r.attempt}`;
}

export { runKey };
