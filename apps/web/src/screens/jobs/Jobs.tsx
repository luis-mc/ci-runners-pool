// Jobs (web-console 4.6, R5.24): the queue with each job's wait reason (UX-29), the history on a time axis
// (UX-33) with filters by repository, machine, result and time range, the detail with a link to the run on
// GitHub, and Export of every row of the filter in the order shown (UX-39).
import {
  ActionBar,
  Badge,
  Breadcrumbs,
  Button,
  ListToolbar,
  Segmented,
  ChoiceField,
  Cluster,
  Empty,
  ExportButton,
  Facts,
  LinkButton,
  Message,
  Page,
  PageHeader,
  Section,
  Stack,
  Status,
  Table,
  Text,
  TimeAxis,
  fileNameOf,
  formatCount,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  useNow,
  type Column,
  type StatusKind,
} from '@crsp/ui';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useLoad } from '../../api/hooks';
import { useVersion } from '../../live/LiveProvider';
import { Load } from '../common';
import { allRepositories } from '../repositories/plans';

type Job = Schemas['Job'];
type Result = Schemas['JobResult'];

const PAGE = 100;
const DAY_MS = 86_400_000;
/** The ranges, narrowest first; 0 is all time. Zoom steps along this list. */
const RANGES = [1, 7, 30, 0] as const;
type Days = (typeof RANGES)[number];

const REASON_WORDS: Record<Schemas['WaitReason'], string> = {
  free_slot: 'waits for a free slot',
  load_over_budget: 'waits until the machine load is under its budget',
  no_runner_with_labels: 'waits for a runner with its labels',
  repository_parallel_limit: "waits for the repository's parallel limit",
  machine_drained: 'waits because its machine is not taking jobs',
  quiet_hours: 'waits for quiet hours to end',
  load_not_measured: 'waits because the machine load is not measured yet',
  paused: 'waits because its machine is paused',
  on_battery: 'waits because its machine runs on battery',
  unknown: 'waits, the reason is not known yet',
};

/** Why a queued job waits, in words (UX-29): the server's line when it has one, else the reason's. */
export function waitWords(j: Pick<Job, 'wait_reason' | 'wait_text'>): string {
  if (j.wait_text) return j.wait_text;
  return j.wait_reason ? REASON_WORDS[j.wait_reason] : 'waits to be placed';
}

/** UX-58: the result as a word, a glyph and a colour. */
export function jobStatus(j: Pick<Job, 'state' | 'result'>): {
  kind: StatusKind;
  word: string;
} {
  if (j.state === 'queued') return { kind: 'waiting', word: 'waiting' };
  if (j.state === 'running') return { kind: 'running', word: 'running' };
  switch (j.result) {
    case 'success':
      return { kind: 'ok', word: 'success' };
    case 'failure':
      return { kind: 'failed', word: 'failure' };
    case 'timed_out':
      return { kind: 'failed', word: 'timed out' };
    case 'lost':
      return { kind: 'failed', word: 'lost' };
    case 'cancelled':
      return { kind: 'off', word: 'cancelled' };
    default:
      return { kind: 'info', word: 'done' };
  }
}

function seconds(n: number | undefined): string {
  return n === undefined ? 'not known' : formatDuration(n);
}

const RESULTS: { value: Result; label: string }[] = [
  { value: 'success', label: 'Success' },
  { value: 'failure', label: 'Failure' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'timed_out', label: 'Timed out' },
  { value: 'lost', label: 'Lost' },
];

interface Filter {
  repo: string;
  machine: string;
  result: Result | '';
  days: Days;
}

function rangeText(days: Days, now: number): string {
  return days === 0
    ? 'all time'
    : `${formatDate(now - days * DAY_MS)} to ${formatDate(now)}`;
}

export function JobsList() {
  const client = useClient();
  const navigate = useNavigate();
  const now = useNow();
  const v = useVersion('jobs');
  const [filter, setFilter] = useState<Filter>({
    repo: '',
    machine: '',
    result: '',
    days: 0,
  });
  const queue = useLoad(
    () =>
      unwrap(
        client.GET('/api/v1/jobs', {
          params: { query: { state: 'queued', limit: 200 } },
        }),
      ),
    [v],
  );
  const query = (extra: Record<string, unknown> = {}) => ({
    state: 'done' as const,
    ...(filter.repo ? { repository_id: Number(filter.repo) } : {}),
    ...(filter.machine ? { machine_id: filter.machine } : {}),
    ...(filter.result ? { result: filter.result } : {}),
    ...(filter.days
      ? { from: new Date(Date.now() - filter.days * DAY_MS).toISOString() }
      : {}),
    ...extra,
  });
  const history = useLoad(
    () =>
      unwrap(client.GET('/api/v1/jobs', { params: { query: query({ limit: PAGE }) } })),
    [v, filter.repo, filter.machine, filter.result, filter.days],
  );
  const machines = useLoad(() => unwrap(client.GET('/api/v1/machines')), [v]);
  const repos = useLoad(() => allRepositories(client, { pool: 'on' }), []);

  // Earlier pages load as the end of the axis nears the screen; a new first page starts them again.
  const [more, setMore] = useState<{ rows: Job[]; cursor: string | undefined } | null>(
    null,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  // D34: the list keeps the last 100 finished jobs; See all pages in the rest.
  const [seeAll, setSeeAll] = useState(false);
  const [moreError, setMoreError] = useState<string | undefined>(undefined);
  const first = history.result.state === 'loading' ? undefined : history.result;
  const firstData = first && 'data' in first ? first.data : undefined;
  useEffect(() => {
    setMore(null);
    setMoreError(undefined);
    setSeeAll(false);
  }, [firstData]);
  const cursor = more ? more.cursor : firstData?.next_cursor;
  const loadMore = () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(undefined);
    unwrap(
      client.GET('/api/v1/jobs', {
        params: { query: query({ limit: PAGE, cursor }) },
      }),
    )
      .then((page) =>
        setMore((m) => ({
          rows: [...(m?.rows ?? []), ...page.items],
          cursor: page.next_cursor,
        })),
      )
      .catch((e: unknown) => setMoreError(e instanceof Error ? e.message : 'No answer.'))
      .finally(() => setLoadingMore(false));
  };

  const machineName = useMemo(() => {
    const names = new Map<string, string>();
    if (machines.result.state === 'ready')
      for (const m of machines.result.data.items) names.set(m.id, m.name);
    return (id: string | undefined) => (id ? (names.get(id) ?? id) : 'none');
  }, [machines.result]);

  const setF = (patch: Partial<Filter>) => setFilter((f) => ({ ...f, ...patch }));
  const filtered = Boolean(filter.repo || filter.machine || filter.result || filter.days);
  const zoom = (step: 1 | -1) => {
    const i = RANGES.indexOf(filter.days) + step;
    const next = RANGES[i];
    if (next !== undefined) setF({ days: next });
  };

  const queueColumns: Column<Job>[] = [
    {
      id: 'repo',
      header: 'Repository',
      cell: (j) => j.repository,
      sort: (j) => j.repository,
    },
    { id: 'job', header: 'Job', cell: (j) => j.job_name, sort: (j) => j.job_name },
    { id: 'labels', header: 'Labels', cell: (j) => j.labels.join(', ') },
    {
      id: 'wait',
      header: 'Waiting',
      cell: (j) => {
        const since = j.queued_at ?? j.created_at;
        return since
          ? formatDuration(Math.max(0, (now - new Date(since).getTime()) / 1000))
          : 'not known';
      },
      sort: (j) => j.queued_at ?? j.created_at ?? '',
    },
    {
      id: 'why',
      header: 'Why it waits',
      cell: () => null,
      long: (j) => ({ full: waitWords(j) }),
    },
    {
      id: 'open',
      header: 'Open',
      cell: (j) => <LinkButton to={`/jobs/${j.id}`}>Open</LinkButton>,
    },
  ];

  const exportAll = async () => {
    const res = await client.GET('/api/v1/exports/jobs', {
      params: { query: query({ format: 'csv' }) },
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

  const noJobs =
    queue.result.state === 'ready' &&
    queue.result.data.items.length === 0 &&
    history.result.state === 'ready' &&
    history.result.data.items.length === 0 &&
    !filtered;

  return (
    <Page>
      <PageHeader
        title="Jobs"
        lead="The queue and the job history, and why a job waits."
      />
      {noJobs ? (
        <Section title="Jobs">
          <Empty title="No jobs yet. Jobs show here when a workflow runs on the pool." />
        </Section>
      ) : (
        <>
          <Section title="Queue">
            <Load result={queue.result} what="the queue" reload={queue.reload}>
              {(data) =>
                data.items.length === 0 ? (
                  <Empty title="Nothing is waiting. Every job has a slot." />
                ) : (
                  <Table
                    caption="Queued jobs"
                    columns={queueColumns}
                    rows={data.items}
                    rowKey={(j) => String(j.id)}
                    expandLabel="Details"
                    rowLabel={(j) => j.job_name}
                    onOpen={(j) => void navigate(`/jobs/${j.id}`)}
                  />
                )
              }
            </Load>
          </Section>
          <Section title="Filters">
            <Stack>
              <ListToolbar
                label="Job history"
                filters={
                  <>
                    <Segmented
                      label="Result"
                      options={RESULTS}
                      value={filter.result}
                      onChange={(result) => setF({ result })}
                    />
                    <Segmented
                      label="Time range"
                      options={[
                        { value: '1', label: 'Last day' },
                        { value: '7', label: 'Last 7 days' },
                        { value: '30', label: 'Last 30 days' },
                      ]}
                      value={filter.days ? (String(filter.days) as '1' | '7' | '30') : ''}
                      onChange={(d) => setF({ days: Number(d) as Days })}
                    />
                  </>
                }
              />
              <Cluster>
                <ChoiceField
                  label="Repository"
                  value={filter.repo}
                  choices={[
                    { value: '', label: 'Every repository' },
                    ...(repos.result.state === 'ready'
                      ? repos.result.data.items.map((r) => ({
                          value: String(r.id),
                          label: r.full_name,
                        }))
                      : []),
                  ]}
                  onChange={(repo) => setF({ repo })}
                />
                <ChoiceField
                  label="Machine"
                  value={filter.machine}
                  choices={[
                    { value: '', label: 'Every machine' },
                    ...(machines.result.state === 'ready'
                      ? machines.result.data.items.map((m) => ({
                          value: m.id,
                          label: m.name,
                        }))
                      : []),
                  ]}
                  onChange={(machine) => setF({ machine })}
                />
              </Cluster>
            </Stack>
          </Section>
          <Section title="History">
            <Stack>
              <Load
                result={history.result}
                what="the job history"
                reload={history.reload}
              >
                {(data) => {
                  const rows = [...data.items, ...(more?.rows ?? [])];
                  return (
                    <Stack>
                      {moreError ? (
                        <Message
                          tone="problem"
                          action={<Button onPress={loadMore}>Try again</Button>}
                        >
                          Could not load earlier jobs. {moreError} The list shows the{' '}
                          {formatCount(rows.length, 'job')} already loaded.
                        </Message>
                      ) : null}
                      {cursor && !seeAll ? (
                        <Message
                          tone="note"
                          action={
                            <Button
                              onPress={() => {
                                setSeeAll(true);
                                loadMore();
                              }}
                            >
                              See all
                            </Button>
                          }
                        >
                          {`Showing the last ${PAGE} finished jobs.`}
                        </Message>
                      ) : null}
                      <TimeAxis
                        label="Job history"
                        rows={rows}
                        at={(j) => j.completed_at ?? j.created_at ?? 0}
                        rowKey={(j) => String(j.id)}
                        onOpen={(j) => void navigate(`/jobs/${j.id}`)}
                        rangeText={rangeText(filter.days, now)}
                        onClear={filter.days ? () => setF({ days: 0 }) : undefined}
                        onZoomOut={filter.days !== 0 ? () => zoom(1) : undefined}
                        onZoomIn={
                          filter.days > 1 || filter.days === 0
                            ? () => zoom(-1)
                            : undefined
                        }
                        hasMore={seeAll && Boolean(cursor)}
                        onLoadMore={loadMore}
                        loadingMore={loadingMore}
                        emptyText={
                          filtered
                            ? 'No jobs match the filters in this range.'
                            : 'No finished jobs yet.'
                        }
                        renderRow={(j) => (
                          <HistoryRow j={j} machine={machineName(j.machine_id)} />
                        )}
                      />
                    </Stack>
                  );
                }}
              </Load>
            </Stack>
          </Section>
        </>
      )}
      {noJobs ? (
        <ActionBar
          primary={
            <LinkButton to="/pool/runners/add" kind="primary">
              Add runners
            </LinkButton>
          }
        />
      ) : (
        <ActionBar
          primary={<ExportButton what="jobs" run={exportAll} kind="primary" />}
        />
      )}
    </Page>
  );
}

function HistoryRow({ j, machine }: { j: Job; machine: string }) {
  const s = jobStatus(j);
  return (
    <Stack gap="tight">
      <Cluster>
        <Status kind={s.kind} word={s.word} />
        <strong className="ds-strong">{j.repository}</strong>
        <span>{j.workflow ? `${j.workflow} / ${j.job_name}` : j.job_name}</span>
      </Cluster>
      <Cluster>
        <Text tone="muted">
          {`${j.completed_at ? formatDateTime(j.completed_at) : 'not known'} on ${machine}${j.backend ? `, ${j.backend}` : ''}`}
        </Text>
        <Text tone="muted">{`Waited ${seconds(j.github_wait_seconds)}`}</Text>
        <Text tone="muted">{`Ran ${seconds(j.run_seconds)}`}</Text>
        <LinkButton to={`/jobs/${j.id}`}>Open</LinkButton>
      </Cluster>
    </Stack>
  );
}

export function JobDetail() {
  const client = useClient();
  const { id = '' } = useParams();
  const v = useVersion('jobs');
  const { result, reload } = useLoad(
    () =>
      unwrap(
        client.GET('/api/v1/jobs/{jobId}', { params: { path: { jobId: Number(id) } } }),
      ),
    [id, v],
  );
  const url = result.state === 'ready' ? result.data.html_url : undefined;
  const safeUrl = url?.startsWith('https://') ? url : undefined;
  return (
    <Page>
      <Breadcrumbs
        trail={[
          { to: '/jobs', label: 'Jobs' },
          { label: result.state === 'ready' ? result.data.job_name : 'Job' },
        ]}
      />
      {result.state === 'ready' || (result.state === 'failed' && result.data) ? null : (
        <PageHeader title="Job" lead="One job: where it ran and when." />
      )}
      <Load result={result} what="the job" reload={reload}>
        {(j) => <JobBody j={j} />}
      </Load>
      {safeUrl ? (
        <ActionBar
          primary={
            <Button
              kind="primary"
              onPress={() => window.open(safeUrl, '_blank', 'noopener,noreferrer')}
            >
              Open the run on GitHub
            </Button>
          }
        />
      ) : null}
    </Page>
  );
}

function JobBody({ j }: { j: Job }) {
  const s = jobStatus(j);
  const when = (t: string | undefined) => (t ? formatDateTime(t) : 'not yet');
  return (
    <Stack>
      <PageHeader
        title={j.job_name}
        lead={`${j.repository}, run ${formatNumber(j.run_id)}, attempt ${j.run_attempt}.`}
      />
      <Cluster>
        <Status kind={s.kind} word={s.word} />
        {j.state === 'queued' ? <Badge>{waitWords(j)}</Badge> : null}
      </Cluster>
      <Section title="Where it ran">
        <Facts
          items={[
            { name: 'Workflow', value: j.workflow ?? 'not known' },
            { name: 'Trigger', value: j.trigger ?? 'not known' },
            { name: 'Machine', value: j.machine_id ?? 'none yet' },
            { name: 'Runner', value: j.runner_name ?? 'none yet' },
            { name: 'Backend', value: j.backend ?? 'not known' },
            { name: 'Isolation', value: j.isolation ?? 'not known' },
            { name: 'Labels', value: j.labels.join(', ') || 'none' },
            { name: 'Commit', value: j.head_sha ? j.head_sha.slice(0, 7) : 'not known' },
          ]}
        />
      </Section>
      <Section title="Times">
        <Facts
          items={[
            { name: 'Created', value: when(j.created_at) },
            { name: 'Took a slot', value: when(j.slot_at) },
            { name: 'Started', value: when(j.started_at) },
            { name: 'Completed', value: when(j.completed_at) },
            { name: 'Waited for GitHub', value: seconds(j.github_wait_seconds) },
            { name: 'Waited for a slot', value: seconds(j.slot_wait_seconds) },
            { name: 'Ran', value: seconds(j.run_seconds) },
          ]}
        />
      </Section>
    </Stack>
  );
}
