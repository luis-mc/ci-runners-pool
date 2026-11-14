// Overview (web-console 4.2, R5.20): machines with load bars, the queue count, the running jobs and today's
// minutes saved, live. It has no command; each item links to its screen (UX-52).
import {
  Card,
  CardGrid,
  Empty,
  Facts,
  LevelBar,
  Loading,
  Message,
  Page,
  PageHeader,
  Section,
  Status,
  Table,
  TextLink,
  formatNumber,
  formatPercent,
  type Column,
} from '@crsp/ui';
import { useEffect, useState } from 'react';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useLiveState, useLiveStore } from '../../live/LiveProvider';

type Machine = Schemas['Machine'];
type Job = Schemas['Job'];

export function machineStatus(m: Machine): {
  kind: 'ok' | 'waiting' | 'failed' | 'off';
  word: string;
} {
  if (!m.online) return { kind: 'failed', word: 'offline' };
  if (m.state === 'draining') return { kind: 'waiting', word: 'draining' };
  if (m.state === 'drained') return { kind: 'off', word: 'drained' };
  if (m.state === 'removing') return { kind: 'waiting', word: 'removing' };
  return { kind: 'ok', word: 'online' };
}

export function MachineCard({ m }: { m: Machine }) {
  const s = machineStatus(m);
  const mem = m.load?.memory_pct;
  const cpu = m.load?.cpu_pct;
  const budget = m.settings;
  return (
    <Card title={m.name} to={`/machines/${m.id}`}>
      <Status kind={s.kind} word={s.word} />
      <LevelBar
        label="Memory"
        value={mem ?? 0}
        max={budget.budget_memory_pct}
        text={
          mem === undefined
            ? 'not known'
            : `${formatPercent(mem)} of ${formatPercent(budget.budget_memory_pct)}`
        }
      />
      <LevelBar
        label="CPU"
        value={cpu ?? 0}
        max={budget.budget_cpu_pct}
        text={
          cpu === undefined
            ? 'not known'
            : `${formatPercent(cpu)} of ${formatPercent(budget.budget_cpu_pct)}`
        }
      />
      <LevelBar
        label="Slots"
        value={m.slots_used}
        max={Math.max(1, budget.job_slots)}
        text={`${m.slots_used} of ${budget.job_slots}`}
      />
    </Card>
  );
}

const jobColumns: Column<Job>[] = [
  { id: 'repo', header: 'Repository', cell: (j) => j.repository },
  { id: 'job', header: 'Job', cell: (j) => j.job_name },
  {
    id: 'where',
    header: 'Machine',
    cell: (j) => j.runner_name ?? j.machine_id ?? 'not placed',
  },
];

export function Overview() {
  const client = useClient();
  const live = useLiveState();
  const liveStore = useLiveStore();
  const [firstPaint, setFirstPaint] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [why, setWhy] = useState('');
  const store = live.overview;

  // The stream starts with a snapshot. If it is slow, load the overview once so the first screen is quick (R6.12).
  useEffect(() => {
    if (store) return;
    let on = true;
    unwrap(client.GET('/api/v1/overview'))
      .then((first) => {
        if (!on) return;
        liveStore.seed(first);
        setFirstPaint('ready');
      })
      .catch((e: unknown) => {
        if (!on) return;
        setFirstPaint('failed');
        setWhy(e instanceof Error ? e.message : 'The controller did not answer.');
      });
    return () => {
      on = false;
    };
  }, [client, store, liveStore]);

  const o = store;
  return (
    <Page>
      <PageHeader title="Overview" lead="The pool at a glance." />
      {!o && firstPaint !== 'failed' ? <Loading what="Loading the overview" /> : null}
      {!o && firstPaint === 'failed' ? (
        <Message tone="problem">
          Could not load the overview. {why} The console keeps trying.
        </Message>
      ) : null}
      {o ? (
        <>
          <Section title="Machines">
            {o.machines.length === 0 ? (
              <Empty
                title="No machines yet. Add a machine to start."
                action={<TextLink to="/machines">Open Machines</TextLink>}
              />
            ) : (
              <CardGrid>
                {o.machines.map((m) => (
                  <MachineCard key={m.id} m={m} />
                ))}
              </CardGrid>
            )}
          </Section>
          <Section title="Queue and running jobs">
            <Facts
              items={[
                { name: 'Queued jobs', value: formatNumber(o.queued_count) },
                { name: 'Running jobs', value: formatNumber(o.running.length) },
              ]}
            />
            {o.running.length === 0 ? (
              <Empty title="No jobs running. Jobs show here when a workflow runs on the pool." />
            ) : (
              <Table
                caption="Running jobs"
                columns={jobColumns}
                rows={o.running}
                rowKey={(j) => String(j.id)}
              />
            )}
          </Section>
          {o.minutes_saved_today && o.minutes_saved_today.length > 0 ? (
            <Section title="Minutes saved today">
              <Facts
                items={o.minutes_saved_today.map((m) => ({
                  name: m.os,
                  value: formatNumber(m.minutes),
                }))}
              />
            </Section>
          ) : null}
        </>
      ) : null}
    </Page>
  );
}
