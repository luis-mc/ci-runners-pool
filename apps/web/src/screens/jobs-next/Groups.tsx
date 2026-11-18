// Jobs sub-sections (RES15): the jobs grouped by repository, machine, runner, runner type or job type. One table
// each: running, queued, done, failed, average wait and run time, and a small trend of the last run times.
import {
  Empty,
  LinkButton,
  Section,
  Sparkline,
  Stack,
  Table,
  Text,
  formatDuration,
  type Column,
} from '@crsp/ui';
import type { Loaded } from '../../api/hooks';
import { Load } from '../common';
import { useJobsGet } from './api';
import { DONE_KEPT } from './JobsHome';
import type { JobItem, JobPage } from './model';
import { JOB_TYPE_WORDS } from './words';

export type GroupBy = 'repository' | 'machine' | 'runner' | 'runner-type' | 'job-type';

const NOT_PLACED = 'not placed yet';

interface Spec {
  title: string;
  what: string;
  key: (j: JobItem) => string;
  /** The address filter that lists this group's jobs. */
  filter: (j: JobItem) => string;
}

const SPECS: Record<GroupBy, Spec> = {
  repository: {
    title: 'Repositories',
    what: 'repository',
    key: (j) => j.repository,
    filter: (j) => `repository=${encodeURIComponent(j.repository)}`,
  },
  machine: {
    title: 'Machines',
    what: 'machine',
    key: (j) => j.runner?.machine_name ?? NOT_PLACED,
    filter: (j) => `machine=${encodeURIComponent(j.runner?.machine_name ?? '')}`,
  },
  runner: {
    title: 'Runners',
    what: 'runner',
    key: (j) => j.runner?.name ?? NOT_PLACED,
    filter: (j) => `runner=${encodeURIComponent(j.runner?.name ?? '')}`,
  },
  'runner-type': {
    title: 'Runner types',
    what: 'runner type',
    key: (j) => (j.runner ? `${j.runner.kind}, ${j.runner.backend}` : NOT_PLACED),
    filter: (j) =>
      `runner_kind=${j.runner?.kind ?? ''}&backend=${encodeURIComponent(j.runner?.backend ?? '')}`,
  },
  'job-type': {
    title: 'Job types',
    what: 'job type',
    key: (j) => JOB_TYPE_WORDS[j.job_type],
    filter: (j) => `job_type=${j.job_type}`,
  },
};

interface Group {
  name: string;
  filter: string;
  running: number;
  queued: number;
  done: number;
  failed: number;
  waitS: number | undefined;
  runS: number | undefined;
  trend: number[];
}

const avg = (xs: number[]): number | undefined =>
  xs.length === 0 ? undefined : xs.reduce((a, b) => a + b, 0) / xs.length;

export function groupJobs(jobs: readonly JobItem[], spec: Spec): Group[] {
  const by = new Map<string, JobItem[]>();
  for (const j of jobs) by.set(spec.key(j), [...(by.get(spec.key(j)) ?? []), j]);
  return [...by.entries()]
    .map(([name, js]) => {
      const done = js.filter((j) => j.state === 'done');
      const first = js[0] as JobItem;
      return {
        name,
        filter: name === NOT_PLACED ? '' : spec.filter(first),
        running: js.filter((j) => j.state === 'running').length,
        queued: js.filter((j) => j.state === 'queued').length,
        done: done.length,
        failed: done.filter((j) => j.result !== 'success').length,
        waitS: avg(
          done.flatMap((j) =>
            j.github_wait_seconds === undefined ? [] : [j.github_wait_seconds],
          ),
        ),
        runS: avg(
          done.flatMap((j) => (j.run_seconds === undefined ? [] : [j.run_seconds])),
        ),
        trend: done
          .filter((j) => j.run_seconds !== undefined)
          .sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''))
          .slice(-12)
          .map((j) => j.run_seconds as number),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const secs = (s: number | undefined) =>
  s === undefined ? 'not known' : formatDuration(s);

function combine(...parts: Loaded<JobPage>[]): Loaded<JobItem[]> {
  const failed = parts.find((p) => p.state === 'failed');
  if (failed && failed.state === 'failed')
    return { state: 'failed', error: failed.error };
  if (parts.some((p) => p.state === 'loading')) return { state: 'loading' };
  return {
    state: 'ready',
    data: parts.flatMap((p) => (p.state === 'ready' ? p.data.items : [])),
    loadedAt: Date.now(),
  };
}

export function GroupTab({ by }: { by: GroupBy }) {
  const spec = SPECS[by];
  const q = useJobsGet<JobPage>('/api/v1/jobs', { state: 'queued', limit: 200 }, true);
  const r = useJobsGet<JobPage>('/api/v1/jobs', { state: 'running', limit: 200 }, true);
  const d = useJobsGet<JobPage>('/api/v1/jobs', { state: 'done', limit: DONE_KEPT });
  const all = combine(q.result, r.result, d.result);
  const reload = () => {
    q.reload();
    r.reload();
    d.reload();
  };
  const columns: Column<Group>[] = [
    {
      id: 'name',
      header: spec.what[0]?.toUpperCase() + spec.what.slice(1),
      cell: (g) => g.name,
      sort: (g) => g.name,
    },
    {
      id: 'running',
      header: 'Running',
      cell: (g) => String(g.running),
      sort: (g) => g.running,
      secondary: true,
    },
    {
      id: 'queued',
      header: 'Queued',
      cell: (g) => String(g.queued),
      sort: (g) => g.queued,
      secondary: true,
    },
    {
      id: 'done',
      header: 'Done',
      cell: (g) => String(g.done),
      sort: (g) => g.done,
      secondary: true,
    },
    {
      id: 'failed',
      header: 'Failed',
      cell: (g) => String(g.failed),
      sort: (g) => g.failed,
    },
    {
      id: 'wait',
      header: 'Average wait',
      cell: (g) => secs(g.waitS),
      sort: (g) => g.waitS ?? 0,
      secondary: true,
    },
    {
      id: 'run',
      header: 'Average run',
      cell: (g) => secs(g.runS),
      sort: (g) => g.runS ?? 0,
      secondary: true,
    },
    {
      id: 'trend',
      header: 'Run times',
      cell: (g) =>
        g.trend.length > 1 ? (
          <Sparkline
            label={`Run times of ${g.name}, last ${g.trend.length} jobs`}
            values={g.trend}
            unit="seconds"
            markLast
          />
        ) : (
          'not enough jobs'
        ),
      secondary: true,
    },
    {
      id: 'open',
      header: 'Jobs',
      cell: (g) =>
        g.filter ? (
          <LinkButton to={`/jobs/done?${g.filter}`}>Open jobs</LinkButton>
        ) : null,
    },
  ];
  return (
    <Load result={all} what={`the jobs by ${spec.what}`} reload={reload}>
      {(jobs) => {
        const groups = groupJobs(jobs, spec);
        return (
          <Section
            title={spec.title}
            count={groups.length}
            hint={`Queued and running jobs, and the last ${DONE_KEPT} done jobs, grouped by ${spec.what}.`}
          >
            <Stack>
              {groups.length === 0 ? (
                <Empty title="No jobs yet. Jobs show here when a workflow runs on the pool." />
              ) : (
                <Table
                  caption={`Jobs by ${spec.what}`}
                  columns={columns}
                  rows={groups}
                  rowKey={(g) => g.name}
                />
              )}
              {by === 'runner' || by === 'machine' ? (
                <Text tone="muted">
                  A repository never picks a runner: the pool places each job, so this
                  list shows where jobs went.
                </Text>
              ) : null}
            </Stack>
          </Section>
        );
      }}
    </Load>
  );
}
