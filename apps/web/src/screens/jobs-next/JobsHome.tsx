// Jobs, home (RES15 review build): one tab row for the queue, the running jobs, the last done jobs and the
// sub-sections (by repository, machine, runner, runner type, job type, charts). Every list is one Table
// (component 15). Wait reasons say what is happening (UX-29); a status is a word, a glyph and a colour (UX-58).
import {
  Button,
  Empty,
  LinkButton,
  Message,
  Page,
  PageHeader,
  Progress,
  Section,
  Stack,
  Status,
  Table,
  Tabs,
  TextLink,
  formatDateTime,
  formatDuration,
  type Column,
} from '@crsp/ui';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Load } from '../common';
import { useJobsGet, type Query } from './api';
import type { JobItem, JobPage } from './model';
import {
  forecastWords,
  jobStatus,
  rangeWords,
  ranSeconds,
  secondsOrNone,
  waitWords,
  waitedSeconds,
} from './words';

export const JOBS_NEXT_TABS = [
  { id: 'queue', label: 'Queue', to: '/jobs' },
  { id: 'running', label: 'Running', to: '/jobs/running' },
  { id: 'done', label: 'Done', to: '/jobs/done' },
  { id: 'repository', label: 'By repository', to: '/jobs/repository' },
  { id: 'machine', label: 'By machine', to: '/jobs/machine' },
  { id: 'runner', label: 'By runner', to: '/jobs/runner' },
  { id: 'runner-type', label: 'By runner type', to: '/jobs/runner-type' },
  { id: 'job-type', label: 'By job type', to: '/jobs/job-type' },
  { id: 'charts', label: 'Charts', to: '/jobs/charts' },
] as const;

/** The most done jobs the console keeps and shows (owner question pending: is 100 right?). */
export const DONE_KEPT = 100;
export const DONE_STEP = 25;

export function JobsNextLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const segment = pathname.split('/')[2] ?? '';
  const current = JOBS_NEXT_TABS.find((t) => t.id === segment)?.id ?? 'queue';
  return (
    <Page>
      <PageHeader
        title="Jobs"
        lead="Queued, running and done jobs: where each one builds, what is done, and how long it takes."
      />
      <Tabs
        label="Jobs sections"
        tabs={JOBS_NEXT_TABS}
        current={current}
        onChange={(id) =>
          void navigate(JOBS_NEXT_TABS.find((t) => t.id === id)?.to ?? '/jobs')
        }
      />
      <Outlet />
    </Page>
  );
}

/** The filters a group row hands to a list, in the address. */
const FILTER_KEYS = [
  'repository',
  'machine',
  'runner',
  'runner_kind',
  'backend',
  'job_type',
] as const;
const FILTER_NAMES: Record<(typeof FILTER_KEYS)[number], string> = {
  repository: 'repository',
  machine: 'machine',
  runner: 'runner',
  runner_kind: 'runner type',
  backend: 'backend',
  job_type: 'job type',
};

function useFilters(): { query: Query; note: string | undefined; clearTo: string } {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const query: Query = {};
  const parts: string[] = [];
  for (const k of FILTER_KEYS) {
    const v = params.get(k);
    if (v) {
      query[k] = v;
      parts.push(`${FILTER_NAMES[k]} ${v}`);
    }
  }
  return {
    query,
    note: parts.length ? `Showing only jobs of ${parts.join(' and ')}.` : undefined,
    clearTo: pathname,
  };
}

function FilterNote({ note, to }: { note: string | undefined; to: string }) {
  if (!note) return null;
  return (
    <Message
      tone="note"
      dismissible={false}
      action={<LinkButton to={to}>Show every job</LinkButton>}
    >
      {note}
    </Message>
  );
}

/** Runner and machine in one cell: "crsp-linuxbox-docker-2 on linux-box". */
function whereWords(j: JobItem): string {
  return j.runner ? `${j.runner.name} on ${j.runner.machine_name}` : 'not placed yet';
}

function BranchCell({ j }: { j: JobItem }) {
  return (
    <>
      {j.branch}
      {j.worktree ? ` (worktree ${j.worktree})` : ''}
    </>
  );
}

function JobCell({ j }: { j: JobItem }) {
  return (
    <>
      {`${j.workflow ?? 'workflow'} / `}
      <TextLink to={`/jobs/${j.id}`}>{j.job_name}</TextLink>
      {j.run_attempt > 1 ? `, attempt ${j.run_attempt}` : ''}
    </>
  );
}

function StatusCell({ j }: { j: JobItem }) {
  const s = jobStatus(j);
  return <Status kind={s.kind} word={s.word} />;
}

type Kind = 'queue' | 'running' | 'done';

export function jobColumns(kind: Kind, now: number): Column<JobItem>[] {
  const repo: Column<JobItem> = {
    id: 'repo',
    header: 'Repository',
    cell: (j) => j.repository.split('/')[1] ?? j.repository,
    sort: (j) => j.repository,
  };
  const job: Column<JobItem> = {
    id: 'job',
    header: 'Workflow and job',
    cell: (j) => <JobCell j={j} />,
    sort: (j) => j.job_name,
  };
  const branch: Column<JobItem> = {
    id: 'branch',
    header: 'Branch',
    cell: (j) => <BranchCell j={j} />,
    sort: (j) => j.branch,
    secondary: true,
  };
  const where: Column<JobItem> = {
    id: 'where',
    header: 'Runner and machine',
    cell: (j) => whereWords(j),
    sort: (j) => j.runner?.name ?? '',
    secondary: true,
  };
  const waited: Column<JobItem> = {
    id: 'waited',
    header: 'Waited',
    cell: (j) => secondsOrNone(waitedSeconds(j, now)),
    sort: (j) => waitedSeconds(j, now) ?? 0,
    secondary: true,
  };
  const ran: Column<JobItem> = {
    id: 'ran',
    header: 'Ran',
    cell: (j) => secondsOrNone(ranSeconds(j, now)),
    sort: (j) => ranSeconds(j, now) ?? 0,
    secondary: true,
  };
  const forecast: Column<JobItem> = {
    id: 'forecast',
    header: 'Forecast',
    cell: (j) => forecastWords(j.forecast),
    sort: (j) => j.forecast.p50,
    secondary: true,
  };
  const status: Column<JobItem> = {
    id: 'status',
    header: 'Status',
    cell: (j) => <StatusCell j={j} />,
    sort: (j) => jobStatus(j).word,
  };
  if (kind === 'queue')
    return [
      {
        id: 'order',
        header: 'Order',
        cell: (j) => String(j.queue_position ?? ''),
        sort: (j) => j.queue_position ?? 0,
      },
      repo,
      job,
      branch,
      waited,
      {
        id: 'starts',
        header: 'Starts',
        cell: (j) =>
          j.queue_eta
            ? j.queue_eta.p50 < 20
              ? 'now'
              : `in ${rangeWords(j.queue_eta.lo, j.queue_eta.hi)}`
            : 'not known',
        sort: (j) => j.queue_eta?.p50 ?? 0,
        secondary: true,
      },
      forecast,
      {
        id: 'why',
        header: 'Why it waits',
        cell: () => null,
        long: (j) => ({ full: waitWords(j) }),
        secondary: true,
      },
      status,
    ];
  if (kind === 'running')
    return [
      repo,
      job,
      branch,
      where,
      {
        id: 'now',
        header: 'Doing now',
        cell: (j) => {
          const steps = j.steps ?? [];
          const at = steps.find((s) => s.state === 'running');
          return at ? `${at.name} (step ${at.number} of ${steps.length})` : 'starting';
        },
        secondary: true,
      },
      waited,
      {
        id: 'progress',
        header: 'Progress',
        cell: (j) => {
          const t = ranSeconds(j, now) ?? 0;
          const known = j.forecast.basis !== 'not_enough_history';
          return (
            <Progress
              label={`${j.job_name}, ${formatDuration(t)} of ${known ? rangeWords(j.forecast.lo, j.forecast.hi) : 'an unknown time'}`}
              {...(known
                ? { value: Math.min(t, j.forecast.p50), max: j.forecast.p50 }
                : {})}
            />
          );
        },
        secondary: true,
      },
      ran,
      forecast,
      status,
    ];
  return [
    {
      id: 'finished',
      header: 'Finished',
      cell: (j) => (j.completed_at ? formatDateTime(j.completed_at) : 'not known'),
      sort: (j) => j.completed_at ?? '',
    },
    repo,
    job,
    branch,
    where,
    waited,
    ran,
    forecast,
    status,
  ];
}

function useJobTable(kind: Kind) {
  const f = useFilters();
  const [shown, setShown] = useState(DONE_STEP);
  const limit = kind === 'done' ? shown : 100;
  const jobs = useJobsGet<JobPage>(
    '/api/v1/jobs',
    { state: kind === 'queue' ? 'queued' : kind, limit, ...f.query },
    kind !== 'done',
  );
  return { f, shown, setShown, ...jobs };
}

const TITLES: Record<Kind, string> = { queue: 'Queue', running: 'Running', done: 'Done' };
const HINTS: Record<Kind, string> = {
  queue:
    'In the order the jobs will be placed. A job that waits says why and when it should start.',
  running:
    'What each job does now, on which runner, and how far it is against its forecast.',
  done: 'The last finished jobs, newest first.',
};
const EMPTY: Record<Kind, string> = {
  queue: 'Nothing is waiting. Every job has a slot.',
  running: 'No job is running now.',
  done: 'No finished jobs yet. Jobs show here when a workflow has run on the pool.',
};

function JobsListTab({ kind }: { kind: Kind }) {
  const navigate = useNavigate();
  const { f, shown, setShown, result, reload } = useJobTable(kind);
  // Running jobs advance with the clock between two answers: every answer renders again.
  const live = Date.now();
  return (
    <Stack>
      <FilterNote note={f.note} to={f.clearTo} />
      <Load
        result={result}
        what={`the ${TITLES[kind].toLowerCase()} list`}
        reload={reload}
      >
        {(page) => {
          const kept = Math.min(page.total, DONE_KEPT);
          const canMore =
            kind === 'done' && page.items.length < kept && shown < DONE_KEPT;
          return (
            <Section
              title={TITLES[kind]}
              count={kind === 'done' ? kept : page.total}
              hint={HINTS[kind]}
              actions={
                canMore ? (
                  <Button
                    onPress={() => setShown((s) => Math.min(DONE_KEPT, s + DONE_STEP))}
                  >
                    Show 25 more
                  </Button>
                ) : undefined
              }
            >
              <Stack>
                {page.items.length === 0 ? (
                  <Empty title={f.note ? 'No job matches this filter.' : EMPTY[kind]} />
                ) : (
                  <JobTable
                    kind={kind}
                    items={page.items}
                    now={live}
                    onOpen={(j) => void navigate(`/jobs/${j.id}`)}
                  />
                )}
                {kind === 'done' &&
                page.total > DONE_KEPT &&
                page.items.length >= kept ? (
                  <Message tone="note" dismissible={false}>
                    Only the last {DONE_KEPT} done jobs are kept. Older ones are not
                    shown.
                  </Message>
                ) : null}
                {kind === 'done' && page.items.length > 0 ? (
                  <Message tone="note" dismissible={false}>
                    {`Showing ${page.items.length} of ${kept} kept done jobs.`}
                  </Message>
                ) : null}
              </Stack>
            </Section>
          );
        }}
      </Load>
    </Stack>
  );
}

function JobTable({
  kind,
  items,
  now,
  onOpen,
}: {
  kind: Kind;
  items: JobItem[];
  now: number;
  onOpen: (j: JobItem) => void;
}) {
  return (
    <Table
      caption={`${TITLES[kind]} jobs`}
      columns={jobColumns(kind, now)}
      rows={items}
      rowKey={(j) => String(j.id)}
      expandLabel="Details"
      rowLabel={(j) => j.job_name}
      onOpen={onOpen}
    />
  );
}

export const QueueTab = () => <JobsListTab kind="queue" />;
export const RunningTab = () => <JobsListTab kind="running" />;
export const DoneTab = () => <JobsListTab kind="done" />;
