// Jobs sub-sections (D24, LOOK31): the jobs grouped by repository, machine, runner type or job type, and one
// chart view (wait time and duration per day). They read the queue, the running jobs and the last finished jobs.
import {
  Empty,
  LevelBar,
  Page,
  PageHeader,
  Section,
  Stack,
  Table,
  Tabs,
  Text,
  formatDuration,
  type Column,
} from '@crsp/ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useLoad } from '../../api/hooks';
import { useVersion } from '../../live/LiveProvider';
import { Load } from '../common';
import { isLight } from '../runners/Runners';

type Job = Schemas['Job'];

/** How many finished jobs the grouped views read. */
export const GROUP_WINDOW = 200;

export const JOBS_TABS = [
  { id: 'all', label: 'All', to: '/jobs' },
  { id: 'repository', label: 'By repository', to: '/jobs/repository' },
  { id: 'machine', label: 'By machine', to: '/jobs/machine' },
  { id: 'runner-type', label: 'By runner type', to: '/jobs/runner-type' },
  { id: 'job-type', label: 'By job type', to: '/jobs/job-type' },
  { id: 'trends', label: 'Wait and duration', to: '/jobs/trends' },
] as const;

export function JobsLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const segment = pathname.split('/')[2] ?? '';
  const current = JOBS_TABS.find((t) => t.id === segment)?.id ?? 'all';
  return (
    <>
      <Page>
        <Tabs
          label="Jobs sections"
          tabs={JOBS_TABS}
          current={current}
          onChange={(id) =>
            void navigate(JOBS_TABS.find((t) => t.id === id)?.to ?? '/jobs')
          }
        />
      </Page>
      <Outlet />
    </>
  );
}

/** The job type from its labels: light, heavy, else standard. */
export function jobType(j: Pick<Job, 'labels'>): 'Light' | 'Standard' | 'Heavy' {
  if (j.labels.includes('crsp-light')) return 'Light';
  if (j.labels.includes('crsp-heavy')) return 'Heavy';
  return 'Standard';
}

export interface Group {
  name: string;
  running: number;
  queued: number;
  done: number;
  failed: number;
  waitS: number | undefined;
  runS: number | undefined;
}

const avg = (xs: number[]): number | undefined =>
  xs.length === 0 ? undefined : xs.reduce((a, b) => a + b, 0) / xs.length;

/** One row per key: counts by state, failures among the finished jobs, and the mean wait and run time. */
export function groupJobs(jobs: readonly Job[], key: (j: Job) => string): Group[] {
  const by = new Map<string, Job[]>();
  for (const j of jobs) {
    const k = key(j);
    by.set(k, [...(by.get(k) ?? []), j]);
  }
  return [...by.entries()]
    .map(([name, js]) => {
      const done = js.filter((j) => j.state === 'done');
      return {
        name,
        running: js.filter((j) => j.state === 'running').length,
        queued: js.filter((j) => j.state === 'queued').length,
        done: done.length,
        failed: done.filter((j) => j.result !== undefined && j.result !== 'success')
          .length,
        waitS: avg(
          done.flatMap((j) =>
            j.github_wait_seconds === undefined ? [] : [j.github_wait_seconds],
          ),
        ),
        runS: avg(
          done.flatMap((j) => (j.run_seconds === undefined ? [] : [j.run_seconds])),
        ),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const secs = (s: number | undefined) =>
  s === undefined ? 'not known' : formatDuration(s);

function useAllJobs() {
  const client = useClient();
  const v = useVersion('jobs');
  const get = (state: 'queued' | 'running' | 'done', limit: number) =>
    unwrap(client.GET('/api/v1/jobs', { params: { query: { state, limit } } }));
  return useLoad(async () => {
    const [q, r, d] = await Promise.all([
      get('queued', 200),
      get('running', 200),
      get('done', GROUP_WINDOW),
    ]);
    return [...q.items, ...r.items, ...d.items];
  }, [v]);
}

type GroupBy = 'repository' | 'machine' | 'runner-type' | 'job-type';

const META: Record<GroupBy, { title: string; lead: string; first: string }> = {
  repository: {
    title: 'By repository',
    lead: 'Each repository that uses the pool.',
    first: 'Repository',
  },
  machine: {
    title: 'By machine',
    lead: 'Where jobs run. A queued job has no machine yet.',
    first: 'Machine',
  },
  'runner-type': {
    title: 'By runner type',
    lead: 'Persistent runners keep state, light runners take short jobs, ephemeral runners take one job.',
    first: 'Runner type',
  },
  'job-type': {
    title: 'By job type',
    lead: 'Light, standard and heavy jobs, read from their labels.',
    first: 'Job type',
  },
};

export function JobsGrouped({ by }: { by: GroupBy }) {
  const client = useClient();
  const jobs = useAllJobs();
  const machines = useLoad(() => unwrap(client.GET('/api/v1/machines')), []);
  const runners = useLoad(() => unwrap(client.GET('/api/v1/runners')), []);
  const meta = META[by];

  const keyOf = (): ((j: Job) => string) => {
    if (by === 'repository') return (j) => j.repository;
    if (by === 'job-type') return jobType;
    if (by === 'machine') {
      const names = new Map(
        (machines.result.state === 'ready' ? machines.result.data.items : []).map((m) => [
          m.id,
          m.name,
        ]),
      );
      return (j) =>
        j.machine_id ? (names.get(j.machine_id) ?? j.machine_id) : 'not placed yet';
    }
    const byId = new Map(
      (runners.result.state === 'ready' ? runners.result.data.items : []).map((r) => [
        r.id,
        r,
      ]),
    );
    return (j) => {
      const r = j.runner_id ? byId.get(j.runner_id) : undefined;
      if (!r) return 'not placed yet';
      if (isLight(r)) return 'Light';
      return r.kind === 'ephemeral' ? 'Ephemeral' : 'Persistent';
    };
  };

  const columns: Column<Group>[] = [
    { id: 'name', header: meta.first, cell: (g) => g.name, sort: (g) => g.name },
    {
      id: 'running',
      header: 'Running',
      cell: (g) => String(g.running),
      sort: (g) => g.running,
    },
    {
      id: 'queued',
      header: 'Queued',
      cell: (g) => String(g.queued),
      sort: (g) => g.queued,
    },
    { id: 'done', header: 'Done', cell: (g) => String(g.done), sort: (g) => g.done },
    {
      id: 'failed',
      header: 'Failed',
      cell: (g) => String(g.failed),
      sort: (g) => g.failed,
    },
    { id: 'wait', header: 'Average wait', cell: (g) => secs(g.waitS) },
    { id: 'run', header: 'Average duration', cell: (g) => secs(g.runS) },
  ];

  return (
    <Page>
      <PageHeader title="Jobs" lead={meta.lead} />
      <Load result={jobs.result} what="the jobs" reload={jobs.reload}>
        {(items) => {
          const rows = groupJobs(items, keyOf());
          return (
            <Section title={meta.title} count={rows.length}>
              {rows.length === 0 ? (
                <Empty title="No jobs yet. Jobs show here when a workflow runs on the pool." />
              ) : (
                <Stack>
                  <Table
                    caption={meta.title}
                    columns={columns}
                    rows={rows}
                    rowKey={(g) => g.name}
                  />
                  <Text tone="muted">{`Done, failed and the averages count the last ${GROUP_WINDOW} finished jobs.`}</Text>
                </Stack>
              )}
            </Section>
          );
        }}
      </Load>
    </Page>
  );
}

export interface Day {
  day: string;
  jobs: number;
  failed: number;
  waitS: number | undefined;
  runS: number | undefined;
}

/** The finished jobs by the day they ended (local date), newest first. */
export function byDay(jobs: readonly Job[]): Day[] {
  const done = jobs.filter((j) => j.state === 'done' && j.completed_at);
  const by = new Map<string, Job[]>();
  for (const j of done) {
    const d = new Date(j.completed_at as string);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    by.set(k, [...(by.get(k) ?? []), j]);
  }
  return [...by.entries()]
    .map(([day, js]) => ({
      day,
      jobs: js.length,
      failed: js.filter((j) => j.result !== undefined && j.result !== 'success').length,
      waitS: avg(
        js.flatMap((j) =>
          j.github_wait_seconds === undefined ? [] : [j.github_wait_seconds],
        ),
      ),
      runS: avg(js.flatMap((j) => (j.run_seconds === undefined ? [] : [j.run_seconds]))),
    }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

export function JobsTrends() {
  const jobs = useAllJobs();
  return (
    <Page>
      <PageHeader
        title="Jobs"
        lead="How long jobs wait and how long they run, day by day."
      />
      <Load result={jobs.result} what="the jobs" reload={jobs.reload}>
        {(items) => {
          const days = byDay(items);
          const maxWait = Math.max(1, ...days.map((d) => d.waitS ?? 0));
          const maxRun = Math.max(1, ...days.map((d) => d.runS ?? 0));
          return (
            <Section title="Wait and duration" count={days.length}>
              {days.length === 0 ? (
                <Empty title="No finished jobs yet. The days show here after the first jobs end." />
              ) : (
                <Stack>
                  {days.map((d) => (
                    <Stack key={d.day} gap="tight">
                      <Text>{`${d.day}: ${d.jobs} ${d.jobs === 1 ? 'job' : 'jobs'}, ${d.failed} failed`}</Text>
                      <LevelBar
                        label={`Average wait on ${d.day}`}
                        value={d.waitS ?? 0}
                        max={maxWait}
                        text={`Wait ${secs(d.waitS)}`}
                      />
                      <LevelBar
                        label={`Average duration on ${d.day}`}
                        value={d.runS ?? 0}
                        max={maxRun}
                        text={`Duration ${secs(d.runS)}`}
                      />
                    </Stack>
                  ))}
                  <Text tone="muted">{`The days count the last ${GROUP_WINDOW} finished jobs.`}</Text>
                </Stack>
              )}
            </Section>
          );
        }}
      </Load>
    </Page>
  );
}
