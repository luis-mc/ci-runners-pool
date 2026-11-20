// Run insights, Waits (idea 11): wait, hold and run per day as a trend chart with its table, and a table per
// repository and per job key. Range 7, 14 or 30 days, named (UX-33, UX-17, UX-41, UX-29).
import { Section, Segmented, Stack, Table, Text, TrendChart, type Column } from '@crsp/ui';
import { useState } from 'react';
import { Load } from '../common';
import { useWaits } from './api';
import { useRepositoryFilter } from './InsightsLayout';
import { HOLD_REASON_WORDS, RANGES, secondsWords } from './words';
import type { Schemas } from '../../api/api';

type Row = Schemas['WaitSplitRow'];

const columns = (first: string): Column<Row>[] => [
  { id: 'key', header: first, cell: (r) => r.key, sort: (r) => r.key, kind: 'grow', grow: 2 },
  { id: 'jobs', header: 'Jobs', cell: (r) => String(r.jobs), sort: (r) => r.jobs },
  { id: 'wait50', header: 'Wait, middle', cell: (r) => secondsWords(r.wait.p50_seconds), secondary: true },
  { id: 'wait95', header: 'Wait, slow end', cell: (r) => secondsWords(r.wait.p95_seconds) },
  { id: 'hold50', header: 'Hold, middle', cell: (r) => secondsWords(r.hold.p50_seconds), secondary: true },
  { id: 'hold95', header: 'Hold, slow end', cell: (r) => secondsWords(r.hold.p95_seconds), secondary: true },
  { id: 'run50', header: 'Run, middle', cell: (r) => secondsWords(r.run.p50_seconds), secondary: true },
  { id: 'run95', header: 'Run, slow end', cell: (r) => secondsWords(r.run.p95_seconds), secondary: true },
  {
    id: 'over',
    header: 'Holds over the cap',
    cell: (r) =>
      r.holds_over_cap
        ? `${r.holds_over_cap}, ${Object.keys(r.hold_reasons ?? {})
            .map((k) => HOLD_REASON_WORDS[k] ?? k)
            .join(', ')}`
        : 'none',
    kind: 'grow',
  },
];

export function Waits() {
  const [days, setDays] = useState<'7' | '14' | '30'>('7');
  const n = Number(days) as 7 | 14 | 30;
  const repository = useRepositoryFilter();
  const perDay = useWaits(n, 'day');
  const perRepo = useWaits(n, 'repository');
  const perJob = useWaits(n, 'job_key');
  const only = (rows: Row[]) => rows.filter((r) => !repository || r.key.startsWith(repository));
  return (
    <Stack>
      <Segmented
        label="Range of the waits"
        options={RANGES}
        value={days}
        allLabel={null}
        onChange={(v) => setDays(v === '14' || v === '30' ? v : '7')}
      />
      <Load result={perDay.result} what="the waits" reload={perDay.reload}>
        {(d) => {
          const at = (day: string) => Date.parse(`${day}T00:00:00Z`);
          const line = (id: string, label: string, pick: (r: Row) => number) => ({
            id,
            label,
            kind: 'column' as const,
            points: d.rows.map((r) => ({ x: at(r.key), y: pick(r), note: `${r.jobs} jobs` })),
          });
          return (
            <Section
              title="Wait, hold and run per day"
              hint={`Time summed over the last ${days} days, by day. A hold is time after GitHub assigned the job and before it ran; over ${secondsWords(d.hold_cap_seconds)} it counts as too long.`}
            >
              <TrendChart
                label="Wait, hold and run per day"
                unit="seconds"
                emptyText="No finished jobs in this range."
                series={[
                  line('wait', 'Wait', (r) => r.wait.total_seconds),
                  line('hold', 'Hold', (r) => r.hold.total_seconds),
                  line('run', 'Run', (r) => r.run.total_seconds),
                ]}
              />
            </Section>
          );
        }}
      </Load>
      <Load result={perRepo.result} what="the waits by repository" reload={perRepo.reload}>
        {(p) => {
          const rows = only(p.rows);
          return (
            <Section title="By repository" count={rows.length}>
              {rows.length === 0 ? (
                <Text>No finished jobs in this range.</Text>
              ) : (
                <Table caption="Waits by repository" columns={columns('Repository')} rows={rows} rowKey={(r) => r.key} />
              )}
            </Section>
          );
        }}
      </Load>
      <Load result={perJob.result} what="the waits by job" reload={perJob.reload}>
        {(p) => {
          const rows = only(p.rows);
          return (
            <Section title="By job" count={rows.length}>
              {rows.length === 0 ? (
                <Text>No finished jobs in this range.</Text>
              ) : (
                <Table caption="Waits by job" columns={columns('Job')} rows={rows} rowKey={(r) => r.key} />
              )}
            </Section>
          );
        }}
      </Load>
    </Stack>
  );
}
