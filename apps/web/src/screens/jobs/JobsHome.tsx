// Jobs, home: one tab row for the queue, the running work, the last done work and the sub-sections (by repository,
// machine, runner, runner type, job type, charts). Every list is one Table (component 15). Wait reasons say what is
// happening (UX-29); a status is a word, a glyph and a colour (UX-58). Runs are the first view, jobs the second.
import {
  ActionBar,
  Button,
  Cut,
  ListToolbar,
  Empty,
  ExportButton,
  LinkButton,
  Message,
  Page,
  PageHeader,
  Progress,
  Section,
  Segmented,
  Stack,
  Status,
  Table,
  Tabs,
  Text,
  TextLink,
  fileNameOf,
  formatShortDateTime,
  formatDuration,
  type Column,
} from '@crsp/ui';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { unwrap, useClient } from '../../api/api';
import { Load } from '../common';
import {
  FILTER_KEYS,
  useJobList,
  useResolvedFilter,
  useRunList,
  type Filter,
  type JobsQuery,
  type RunsQuery,
} from './api';
import { csvFile } from './csv';
import {
  fromQueuedJobs,
  fromSummary,
  byRun,
  elapsedSeconds,
  type RunRow,
} from './runList';
import { BranchWords, RunDetail, runColumns } from './RunRows';
import {
  RETENTION_WORDS,
  forecastOf,
  forecastOne,
  jobStatus,
  ranSeconds,
  secondsOrNone,
  startsWords,
  waitWords,
  waitedSeconds,
  type Job,
} from './words';

export const JOBS_TABS = [
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

/** Done: shows 25, "Show more" adds 25 up to 100 a page; older ones by filter and range (owner decision 1). */
export const DONE_KEPT = 100;
export const DONE_STEP = 25;
/** Days kept: 90 (owner decision 1 and 2). */
export const KEPT_DAYS = 90;
const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
] as const;

export function JobsLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const segment = pathname.split('/')[2] ?? '';
  const current = JOBS_TABS.find((t) => t.id === segment)?.id ?? 'queue';
  return (
    <Page>
      <PageHeader
        title="Jobs"
        lead="Each row is a workflow run. Open a run to see its jobs, and a job to see its steps."
      />
      <Tabs
        label="Jobs sections"
        tabs={JOBS_TABS}
        current={current}
        onChange={(id) =>
          void navigate(JOBS_TABS.find((t) => t.id === id)?.to ?? '/jobs')
        }
      />
      <Outlet />
    </Page>
  );
}

const FILTER_NAMES: Record<(typeof FILTER_KEYS)[number], string> = {
  repository: 'repository',
  machine: 'machine',
  runner: 'runner',
  runner_kind: 'runner type',
  backend: 'backend',
  job_type: 'job type',
  branch: 'branch',
};

/** The filters a group row hands to a list, in the address, and what the API makes of them. */
function useFilters(): {
  filter: Filter;
  query: JobsQuery;
  ready: boolean;
  unknown: boolean;
  note: string | undefined;
  clearTo: string;
} {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const filter: Filter = {};
  for (const k of FILTER_KEYS) {
    const v = params.get(k);
    if (v) filter[k] = v;
  }
  const resolved = useResolvedFilter(filter);
  const parts = FILTER_KEYS.flatMap((k) =>
    filter[k]
      ? [
          `${FILTER_NAMES[k]} ${k === 'machine' ? (resolved.machineName ?? filter[k]) : filter[k]}`,
        ]
      : [],
  );
  return {
    filter,
    query: resolved.query,
    ready: resolved.ready,
    unknown: resolved.unknown,
    note: parts.length
      ? `Showing only what belongs to ${parts.join(' and ')}.`
      : undefined,
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
function whereWords(j: Job): string {
  return j.runner
    ? `${j.runner.name} on ${j.runner.machine_name ?? 'its machine'}`
    : j.runner_name
      ? `${j.runner_name}`
      : 'not placed yet';
}

function BranchCell({ j }: { j: Job }) {
  return <BranchWords branch={j.branch ?? ''} task={j.task_id} />;
}

function JobCell({ j }: { j: Job }) {
  return (
    <Cut tail={j.run_attempt > 1 ? `, attempt ${j.run_attempt}` : ''}>
      {`${j.workflow ?? 'workflow'} / `}
      <TextLink to={`/jobs/${j.id}`}>{j.job_name}</TextLink>
    </Cut>
  );
}

function StatusCell({ j }: { j: Job }) {
  const s = jobStatus(j);
  return <Status kind={s.kind} word={s.word} />;
}

type Kind = 'queue' | 'running' | 'done';

export function jobColumns(kind: Kind, now: number): Column<Job>[] {
  const repo: Column<Job> = {
    id: 'repo',
    header: 'Repository',
    cell: (j) => j.repository.split('/')[1] ?? j.repository,
    sort: (j) => j.repository,
    kind: 'grow',
    grow: 2,
  };
  const job: Column<Job> = {
    id: 'job',
    header: 'Workflow and job',
    cell: (j) => <JobCell j={j} />,
    title: (j) => `${j.workflow ?? 'workflow'} / ${j.job_name}`,
    sort: (j) => j.job_name,
    kind: 'grow',
    grow: 2,
  };
  const branch: Column<Job> = {
    id: 'branch',
    header: 'Branch',
    cell: (j) => <BranchCell j={j} />,
    middle: (j) => j.branch ?? '',
    title: (j) => j.branch ?? '',
    sort: (j) => j.branch ?? '',
    kind: 'grow',
    grow: 1,
    secondary: true,
  };
  const where: Column<Job> = {
    id: 'where',
    header: 'Runner and machine',
    cell: (j) => whereWords(j),
    sort: (j) => j.runner?.name ?? '',
    kind: 'grow',
    secondary: true,
  };
  const waited: Column<Job> = {
    id: 'waited',
    header: 'Waited',
    cell: (j) => secondsOrNone(waitedSeconds(j, now)),
    sort: (j) => waitedSeconds(j, now) ?? 0,
    secondary: true,
  };
  const ran: Column<Job> = {
    id: 'ran',
    header: 'Ran',
    cell: (j) => secondsOrNone(ranSeconds(j, now)),
    sort: (j) => ranSeconds(j, now) ?? 0,
    secondary: true,
  };
  const status: Column<Job> = {
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
      {
        id: 'starts',
        header: 'Starts',
        cell: (j) => startsWords(j.queue_eta, j.queue_position),
        sort: (j) => j.queue_eta?.p50 ?? 0,
        secondary: true,
      },
      {
        id: 'why',
        header: 'Why it waits',
        cell: () => null,
        kind: 'grow',
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
        id: 'progress',
        header: 'Progress',
        kind: 'grow',
        cell: (j) => {
          const t = ranSeconds(j, now) ?? 0;
          const f = forecastOf(j);
          const known = f.basis !== 'not_enough_history';
          return (
            <Progress
              label={`${j.job_name}, ${formatDuration(t)} of ${known ? forecastOne(f) : 'an unknown time'}`}
              {...(known ? { value: Math.min(t, f.p50), max: f.p50 } : {})}
            />
          );
        },
        secondary: true,
      },
      ran,
      status,
    ];
  return [
    {
      id: 'finished',
      header: 'Finished',
      cell: (j) => (j.completed_at ? formatShortDateTime(j.completed_at) : 'not known'),
      sort: (j) => j.completed_at ?? '',
    },
    repo,
    job,
    branch,
    where,
    waited,
    ran,
    status,
  ];
}

type View = 'runs' | 'jobs';

/** Which list the reader sees: runs by default; a filter only jobs have (runner, machine, type) opens the jobs. */
function useView(): { view: View; set: (v: View) => void } {
  const [params, setParams] = useSearchParams();
  const jobOnly = ['machine', 'runner', 'runner_kind', 'backend', 'job_type'].some((k) =>
    params.get(k),
  );
  const raw = params.get('view');
  const view: View = raw === 'jobs' || raw === 'runs' ? raw : jobOnly ? 'jobs' : 'runs';
  return {
    view,
    set: (v) => {
      const next = new URLSearchParams(params);
      next.set('view', v);
      setParams(next, { replace: true });
    },
  };
}

function ViewSwitch({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <Segmented<View>
      label="Show runs or jobs"
      options={[
        { value: 'runs', label: 'Runs' },
        { value: 'jobs', label: 'Jobs' },
      ]}
      value={view}
      onChange={(v) => onChange(v === '' ? 'runs' : v)}
      allLabel={null}
    />
  );
}

const TITLES: Record<Kind, string> = { queue: 'Queue', running: 'Running', done: 'Done' };
const HINTS: Record<Kind, Record<View, string>> = {
  queue: {
    runs: 'One row for each run that has jobs waiting: its place in line, when it should start, and why it waits.',
    jobs: 'Every waiting job in the order it will be placed. A job that waits says why and when it should start.',
  },
  running: {
    runs: 'One row for each run in progress: jobs done of all, what runs now, and when it should end.',
    jobs: 'What each job does now, on which runner, and how far it is against its forecast.',
  },
  done: {
    runs: 'The last finished runs, newest first. Open a run to see its jobs.',
    jobs: 'The last finished jobs, newest first.',
  },
};
const EMPTY: Record<Kind, string> = {
  queue: 'Nothing is waiting. Every job has a slot.',
  running: 'No run is in progress.',
  done: 'No finished runs yet. Runs show here when a workflow has run on the pool.',
};

/** Every row of a filter, page after page: the files of the screen hold all of it, not one page. */
async function allPages<T>(
  read: (
    cursor: string | undefined,
  ) => Promise<{ items: T[]; next_cursor?: string | undefined }>,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 100; page += 1) {
    const res = await read(cursor);
    out.push(...res.items);
    cursor = res.next_cursor;
    if (!cursor) break;
  }
  return out;
}

const DAY_MS = 86_400_000;

function JobsListTab({ kind }: { kind: Kind }) {
  const f = useFilters();
  const client = useClient();
  const { view, set } = useView();
  const [params, setParams] = useSearchParams();
  const days = RANGES.some((r) => r.value === params.get('days'))
    ? (params.get('days') as string)
    : String(KEPT_DAYS);
  const [shown, setShown] = useState(DONE_STEP);
  const limit = kind === 'done' ? shown : 100;
  const state = kind === 'queue' ? 'queued' : kind;
  // The range starts at a whole minute, so the question stays the same between two renders and the list does not
  // ask again on every render.
  const minute = Math.floor(Date.now() / 60_000) * 60_000;
  const from =
    kind === 'done' ? new Date(minute - Number(days) * DAY_MS).toISOString() : undefined;
  const wait = !f.ready;
  const jobsQuery: JobsQuery = { ...f.query, state, limit, ...(from ? { from } : {}) };
  // Runs take the repository and the branch only; a filter on a runner or a machine shows jobs.
  const runsQuery: RunsQuery = {
    state: kind === 'queue' ? 'queued' : kind,
    limit,
    ...(f.query.repository_id !== undefined
      ? { repository_id: f.query.repository_id }
      : {}),
    ...(f.query.branch ? { branch: f.query.branch } : {}),
    ...(from ? { from } : {}),
  };
  const open = kind !== 'done';
  const jobs = useJobList(jobsQuery, open && view === 'jobs', wait || view !== 'jobs');
  // Queue: the runs are made from the queued jobs; Running: the runs list, with the running jobs beside it.
  const queuedJobs = useJobList(
    jobsQuery,
    true,
    wait || view !== 'runs' || kind !== 'queue',
  );
  const runningJobs = useJobList(
    { ...jobsQuery, state: 'running' },
    true,
    wait || view !== 'runs' || kind !== 'running',
  );
  const runs = useRunList(runsQuery, open, wait || view !== 'runs' || kind === 'queue');
  const navigate = useNavigate();
  const live = Date.now();
  const unit = view === 'runs' ? 'runs' : 'jobs';

  const exportRows = async () => {
    if (view === 'runs') {
      const rows = await allPages((cursor) =>
        unwrap(
          client.GET('/api/v1/runs', {
            params: {
              query: { ...runsQuery, limit: 100, ...(cursor ? { cursor } : {}) },
            },
          }),
        ),
      );
      return csvFile(
        `crsp-${kind}-runs.csv`,
        [
          'repository',
          'workflow',
          'run',
          'attempt',
          'branch',
          'commit',
          'event',
          'jobs_done',
          'jobs_total',
          'total_seconds',
          'result',
        ],
        rows.map((r) => {
          const row = fromSummary(r);
          return [
            r.repository,
            r.workflow,
            r.id,
            r.attempt,
            r.branch,
            r.head_sha.slice(0, 7),
            r.pull_request ? `PR ${r.pull_request}` : r.trigger,
            r.jobs_done,
            r.jobs_total,
            Math.round(elapsedSeconds(row, live)),
            jobStatus(r).word,
          ];
        }),
      );
    }
    const { limit: _limit, ...filterOnly } = jobsQuery;
    const res = await client.GET('/api/v1/exports/jobs', {
      params: { query: { ...filterOnly, format: 'csv' } },
      parseAs: 'blob',
    });
    if (!res.response.ok) {
      const env = res.error as { error?: { message?: string } } | undefined;
      throw new Error(
        env?.error?.message ?? `The controller answered ${res.response.status}.`,
      );
    }
    return {
      blob: res.data as Blob,
      filename: fileNameOf(res.response.headers.get('Content-Disposition')),
    };
  };

  const list = (
    page: { total?: number | undefined; next_cursor?: string | undefined },
    rows: RunRow[] | undefined,
    items: Job[] | undefined,
    count: number,
  ) => {
    const canMore =
      kind === 'done' && page.next_cursor !== undefined && shown < DONE_KEPT;
    const empty = (rows ?? items ?? []).length === 0;
    return (
      <Section
        title={TITLES[kind]}
        count={count}
        hint={HINTS[kind][view]}
        actions={
          canMore ? (
            <Button onPress={() => setShown((n) => Math.min(DONE_KEPT, n + DONE_STEP))}>
              Show 25 more
            </Button>
          ) : undefined
        }
      >
        <Stack>
          {empty ? (
            <Empty
              title={
                f.note ? `No ${unit.slice(0, -1)} matches this filter.` : EMPTY[kind]
              }
            />
          ) : rows ? (
            <Table
              caption={`${TITLES[kind]} runs`}
              columns={runColumns(kind, live)}
              rows={rows}
              rowKey={(r) => `${r.id}-${r.attempt}`}
              expandLabel="Why"
              rowLabel={(r) => `${r.workflow} run ${r.id}`}
              oneLine
              detail={{
                label: 'Open run',
                render: (r) => (
                  <RunDetail
                    row={r}
                    now={live}
                    open={(j) => void navigate(`/jobs/${j.id}`)}
                  />
                ),
              }}
            />
          ) : (
            <JobTable
              kind={kind}
              items={items ?? []}
              now={live}
              onOpen={(j) => void navigate(`/jobs/${j.id}`)}
            />
          )}
          {kind === 'done' && !empty ? (
            <Text tone="muted">
              {`Showing ${(rows ?? items ?? []).length} of ${page.total ?? (rows ?? items ?? []).length} ${unit} in the last ${days} days. ${
                page.next_cursor !== undefined && shown >= DONE_KEPT
                  ? `A page holds at most ${DONE_KEPT}: choose a shorter range or a filter to see others. `
                  : ''
              }Jobs are kept ${KEPT_DAYS} days. ${RETENTION_WORDS}`}
            </Text>
          ) : null}
        </Stack>
      </Section>
    );
  };

  const body = () => {
    if (f.unknown)
      return (
        <Section title={TITLES[kind]} count={0}>
          <Empty title="This repository is not on the list of repositories, so no run belongs to it." />
        </Section>
      );
    if (!f.ready) return null;
    if (view === 'jobs')
      return (
        <Load
          result={jobs.result}
          what={`the ${TITLES[kind].toLowerCase()} list`}
          reload={jobs.reload}
        >
          {(page) => list(page, undefined, page.items, page.total ?? page.items.length)}
        </Load>
      );
    if (kind === 'queue')
      return (
        <Load result={queuedJobs.result} what="the queue" reload={queuedJobs.reload}>
          {(page) => {
            const rows = fromQueuedJobs(page.items);
            return list(page, rows, undefined, rows.length);
          }}
        </Load>
      );
    if (kind === 'running')
      return (
        <Load result={runs.result} what="the running list" reload={runs.reload}>
          {(page) => {
            const running = byRun(
              runningJobs.result.state === 'ready' ? runningJobs.result.data.items : [],
            );
            const rows = page.items.map((r) => fromSummary(r, new Map(), running));
            return list(page, rows, undefined, page.total ?? rows.length);
          }}
        </Load>
      );
    return (
      <Load result={runs.result} what="the done list" reload={runs.reload}>
        {(page) =>
          list(
            page,
            page.items.map((r) => fromSummary(r)),
            undefined,
            page.total,
          )
        }
      </Load>
    );
  };

  return (
    <Stack>
      <FilterNote note={f.note} to={f.clearTo} />
      <ListToolbar
        label={TITLES[kind]}
        count={view === 'runs' ? 'One row per run' : 'One row per job'}
        filters={
          <>
            <ViewSwitch view={view} onChange={set} />
            {kind === 'done' ? (
              <Segmented
                label="Range"
                options={RANGES}
                value={days}
                onChange={(v) => {
                  const next = new URLSearchParams(params);
                  next.set('days', v || String(KEPT_DAYS));
                  setParams(next, { replace: true });
                  setShown(DONE_STEP);
                }}
                allLabel={null}
              />
            ) : null}
          </>
        }
      />
      {body()}
      <ActionBar
        primary={
          kind === 'done' ? (
            <ExportButton
              what={`done ${unit}`}
              run={exportRows}
              label="Export CSV"
              primary
            />
          ) : (
            <LinkButton to="/pool/runners/add" kind="primary">
              Add runners
            </LinkButton>
          )
        }
      />
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
  items: Job[];
  now: number;
  onOpen: (j: Job) => void;
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
      oneLine
      action={{
        label: 'Open job',
        to: (j) => `/jobs/${j.id}`,
        name: (j) => j.job_name,
      }}
    />
  );
}

export const QueueTab = () => <JobsListTab kind="queue" />;
export const RunningTab = () => <JobsListTab kind="running" />;
export const DoneTab = () => <JobsListTab kind="done" />;
