// Jobs, home (RES15 review build): one tab row for the queue, the running jobs, the last done jobs and the
// sub-sections (by repository, machine, runner, runner type, job type, charts). Every list is one Table
// (component 15). Wait reasons say what is happening (UX-29); a status is a word, a glyph and a colour (UX-58).
import {
  Button,
  Cluster,
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
  formatShortDateTime,
  formatDuration,
  type Column,
} from '@crsp/ui';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Load } from '../common';
import { useFetcher, useJobsGet, type Query } from './api';
import { csvFile } from './csv';
import type { JobItem, JobPage, RunItem, RunPageData } from './model';
import { BranchWords, RunDetail, runColumns } from './RunRows';
import { summarize } from './runSummary';
import {
  RETENTION_WORDS,
  forecastOne,
  jobStatus,
  ranSeconds,
  secondsOrNone,
  startsWords,
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

export function JobsNextLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const segment = pathname.split('/')[2] ?? '';
  const current = JOBS_NEXT_TABS.find((t) => t.id === segment)?.id ?? 'queue';
  return (
    <Page>
      <PageHeader
        title="Jobs"
        lead="Each row is a workflow run. Open a run to see its jobs, and a job to see its steps."
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
  'job',
] as const;
const FILTER_NAMES: Record<(typeof FILTER_KEYS)[number], string> = {
  repository: 'repository',
  machine: 'machine',
  runner: 'runner',
  runner_kind: 'runner type',
  backend: 'backend',
  job_type: 'job type',
  job: 'job',
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
function whereWords(j: JobItem): string {
  return j.runner ? `${j.runner.name} on ${j.runner.machine_name}` : 'not placed yet';
}

function BranchCell({ j }: { j: JobItem }) {
  return <BranchWords branch={j.branch} />;
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
    title: (j) => `${j.workflow ?? 'workflow'} / ${j.job_name}`,
    sort: (j) => j.job_name,
  };
  const branch: Column<JobItem> = {
    id: 'branch',
    header: 'Branch',
    cell: (j) => <BranchCell j={j} />,
    title: (j) => j.branch,
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
        cell: (j) => startsWords(j.queue_eta, j.queue_position),
        sort: (j) => j.queue_eta?.p50 ?? 0,
        secondary: true,
      },
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
      {
        id: 'progress',
        header: 'Progress',
        cell: (j) => {
          const t = ranSeconds(j, now) ?? 0;
          const known = j.forecast.basis !== 'not_enough_history';
          return (
            <Progress
              label={`${j.job_name}, ${formatDuration(t)} of ${known ? forecastOne(j.forecast) : 'an unknown time'}`}
              {...(known
                ? { value: Math.min(t, j.forecast.p50), max: j.forecast.p50 }
                : {})}
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
  const jobOnly = ['machine', 'runner', 'runner_kind', 'backend', 'job_type', 'job'].some(
    (k) => params.get(k),
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

function JobsListTab({ kind }: { kind: Kind }) {
  const f = useFilters();
  const { view, set } = useView();
  const [params, setParams] = useSearchParams();
  const days = RANGES.some((r) => r.value === params.get('days'))
    ? (params.get('days') as string)
    : String(KEPT_DAYS);
  const [shown, setShown] = useState(DONE_STEP);
  const since = kind === 'done' ? { since: days } : {};
  const limit = kind === 'done' ? shown : 100;
  const base = { state: kind === 'queue' ? 'queued' : kind, limit, ...f.query, ...since };
  const runs = useJobsGet<RunPageData>(
    '/api/v1/runs',
    base,
    kind !== 'done' && view === 'runs',
  );
  const jobs = useJobsGet<JobPage>(
    '/api/v1/jobs',
    base,
    kind !== 'done' && view === 'jobs',
  );
  const fetchAll = useFetcher();
  const navigate = useNavigate();
  const live = Date.now();
  const unit = view === 'runs' ? 'runs' : 'jobs';
  const exportRows = async () => {
    const q = { ...base, limit: 200 };
    if (view === 'runs') {
      const page = await fetchAll<RunPageData>('/api/v1/runs', q);
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
        page.items.map((r) => {
          const s = summarize(r, live);
          return [
            r.repository,
            r.workflow,
            r.id,
            r.attempt,
            r.branch,
            r.head_sha.slice(0, 7),
            r.pull_request ? `PR ${r.pull_request}` : r.trigger,
            s.doneJobs,
            s.total,
            Math.round(s.elapsed),
            s.result.word,
          ];
        }),
      );
    }
    const page = await fetchAll<JobPage>('/api/v1/jobs', q);
    return csvFile(
      `crsp-${kind}-jobs.csv`,
      [
        'repository',
        'workflow',
        'job',
        'run',
        'attempt',
        'branch',
        'runner',
        'machine',
        'waited_seconds',
        'run_seconds',
        'result',
      ],
      page.items.map((j) => [
        j.repository,
        j.workflow,
        j.job_name,
        j.run_id,
        j.run_attempt,
        j.branch,
        j.runner?.name,
        j.runner?.machine_name,
        j.github_wait_seconds,
        j.run_seconds,
        jobStatus(j).word,
      ]),
    );
  };
  const list = (
    page: { total: number; next_cursor?: string | undefined },
    items: RunItem[] | JobItem[],
  ) => {
    const canMore =
      kind === 'done' && page.next_cursor !== undefined && shown < DONE_KEPT;
    return (
      <Section
        title={TITLES[kind]}
        count={page.total}
        hint={HINTS[kind][view]}
        actions={
          canMore ? (
            <Button onPress={() => setShown((s) => Math.min(DONE_KEPT, s + DONE_STEP))}>
              Show 25 more
            </Button>
          ) : undefined
        }
      >
        <Stack>
          {items.length === 0 ? (
            <Empty
              title={
                f.note ? `No ${unit.slice(0, -1)} matches this filter.` : EMPTY[kind]
              }
            />
          ) : view === 'runs' ? (
            <Table
              caption={`${TITLES[kind]} runs`}
              columns={runColumns(kind, live)}
              rows={items as RunItem[]}
              rowKey={(r) => `${r.id}-${r.attempt}`}
              expandLabel="Why"
              rowLabel={(r) => `${r.workflow} run ${r.id}`}
              oneLine
              detail={{
                label: 'Open run',
                render: (r) => (
                  <RunDetail
                    run={r}
                    now={live}
                    open={(j) => void navigate(`/jobs/${j.id}`)}
                  />
                ),
              }}
            />
          ) : (
            <JobTable
              kind={kind}
              items={items as JobItem[]}
              now={live}
              onOpen={(j) => void navigate(`/jobs/${j.id}`)}
            />
          )}
          {kind === 'done' && items.length > 0 ? (
            <Text tone="muted">
              {`Showing ${items.length} of ${page.total} ${unit} in the last ${days} days. ${
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
  return (
    <Stack>
      <FilterNote note={f.note} to={f.clearTo} />
      <Cluster>
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
        {kind === 'done' ? (
          <ExportButton what={`done ${unit}`} run={exportRows} label="Export CSV" />
        ) : null}
      </Cluster>
      {view === 'runs' ? (
        <Load
          result={runs.result}
          what={`the ${TITLES[kind].toLowerCase()} list`}
          reload={runs.reload}
        >
          {(page) => list(page, page.items)}
        </Load>
      ) : (
        <Load
          result={jobs.result}
          what={`the ${TITLES[kind].toLowerCase()} list`}
          reload={jobs.reload}
        >
          {(page) => list(page, page.items)}
        </Load>
      )}
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
