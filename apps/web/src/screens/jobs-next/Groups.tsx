// Jobs sub-sections (RES15): the jobs grouped by repository, machine, runner, runner type or job type. One table
// each: running, queued, done, failed, average wait and run time, and a small trend of the last run times.
import {
  Badge,
  Empty,
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
import { JOB_TYPE_WORDS, RETENTION_WORDS, baseJobName } from './words';

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
    key: (j) => j.runner?.kind ?? NOT_PLACED,
    filter: (j) => `runner_kind=${j.runner?.kind ?? ''}`,
  },
  'job-type': {
    title: 'Job types',
    what: 'job type',
    key: (j) => baseJobName(j.job_name),
    filter: (j) => `job=${encodeURIComponent(baseJobName(j.job_name))}`,
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
  /** The backends the group's jobs ran on (docker, wsl2, hyperv), for runner types. */
  backends: string[];
  /** The scheduler class of a job type: heavy when any of its jobs is heavy. */
  weight: 'light' | 'standard' | 'heavy';
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
        backends: [
          ...new Set(js.flatMap((j) => (j.runner ? [j.runner.backend] : []))),
        ].sort(),
        weight: weightOf(js),
        trend: done
          .filter((j) => j.run_seconds !== undefined)
          .sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''))
          .slice(-12)
          .map((j) => j.run_seconds as number),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function weightOf(js: readonly JobItem[]): Group['weight'] {
  if (js.some((j) => j.job_type === 'heavy')) return 'heavy';
  return js.every((j) => j.job_type === 'light') ? 'light' : 'standard';
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
    ...(by === 'runner-type'
      ? [
          {
            id: 'backend',
            header: 'Backend',
            cell: (g: Group) => g.backends.join(', ') || 'none',
            secondary: true,
          },
        ]
      : []),
    ...(by === 'job-type'
      ? [
          {
            id: 'weight',
            header: 'Weight',
            cell: (g: Group) => <Badge>{JOB_TYPE_WORDS[g.weight]}</Badge>,
            sort: (g: Group) => g.weight,
          },
        ]
      : []),
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
                  oneLine
                  action={{
                    label: 'Open',
                    // Jobs that no runner took yet wait in the queue, so that is what the row opens.
                    to: (g) =>
                      g.filter
                        ? `/jobs/done?${by === 'repository' ? '' : 'view=jobs&'}${g.filter}`
                        : '/jobs?view=jobs',
                    name: (g) => g.name,
                  }}
                />
              )}
              {by === 'runner-type' ? (
                <Text tone="muted">
                  Persistent runners keep state between jobs; ephemeral runners are fresh
                  for every job. The backend is where the runner runs.
                </Text>
              ) : null}
              {by === 'job-type' ? (
                <Text tone="muted">
                  A job type is the job name without its matrix values. Light jobs need
                  little of a machine, heavy jobs a lot.
                </Text>
              ) : null}
              <Text tone="muted">{RETENTION_WORDS}</Text>
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
