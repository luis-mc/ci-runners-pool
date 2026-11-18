// Jobs, Charts (RES15): durations and waits over time, forecast against actual, and the busiest hours. A chart
// supports the words beside it and has a text equivalent (UX-41, UX-17).
import {
  Cluster,
  Empty,
  ExportButton,
  ForecastChart,
  Heatmap,
  Section,
  Segmented,
  Stack,
  Text,
  TrendChart,
  formatNumber,
} from '@crsp/ui';
import { useState } from 'react';
import { Load } from '../common';
import { useJobsGet } from './api';
import { csvFile } from './csv';
import { insideRange } from './forecast';
import type { JobStats } from './model';
import { RETENTION_WORDS } from './words';

const SPANS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
] as const;

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export function ChartsTab() {
  const [days, setDays] = useState('14');
  const { result, reload } = useJobsGet<JobStats>('/api/v1/jobs/stats', { days });
  return (
    <Load result={result} what="the charts" reload={reload}>
      {(s) => {
        const bar = (
          <Cluster>
            <Segmented
              label="Range of the charts"
              options={SPANS}
              value={days}
              onChange={(v) => setDays(v || '14')}
              allLabel={null}
            />
            <ExportButton
              what="daily summaries"
              label="Export daily summaries (CSV)"
              run={() =>
                Promise.resolve(
                  csvFile(
                    'crsp-daily-summaries.csv',
                    [
                      'day',
                      'jobs',
                      'wait_p50_seconds',
                      'wait_p90_seconds',
                      'run_p50_seconds',
                      'run_p90_seconds',
                    ],
                    s.days.map((d) => [
                      d.day,
                      d.jobs,
                      d.wait_p50,
                      d.wait_p90,
                      d.run_p50,
                      d.run_p90,
                    ]),
                  ),
                )
              }
            />
          </Cluster>
        );
        if (s.days.length === 0)
          return (
            <Stack>
              {bar}
              <Section title="Charts">
                <Empty title="No finished jobs in this range, so there is nothing to draw." />
              </Section>
            </Stack>
          );
        const at = (day: string) => Date.parse(`${day}T00:00:00Z`);
        const inside = insideRange(
          s.forecast_points.map((p) => ({
            actual: p.actual_seconds,
            lo: p.lo,
            hi: p.hi,
          })),
        );
        return (
          <Stack>
            {bar}
            <Section
              title="Run time and wait per day"
              hint="The middle value and the slow end (p90) of each day."
            >
              <TrendChart
                label="Run time and wait per day"
                unit="seconds"
                emptyText="No finished jobs in this period."
                series={[
                  {
                    id: 'run50',
                    label: 'Run time, middle',
                    points: s.days.map((d) => ({
                      x: at(d.day),
                      y: d.run_p50,
                      note: `${d.jobs} jobs`,
                    })),
                  },
                  {
                    id: 'run90',
                    label: 'Run time, slow end',
                    points: s.days.map((d) => ({ x: at(d.day), y: d.run_p90 })),
                  },
                  {
                    id: 'wait50',
                    label: 'Wait, middle',
                    points: s.days.map((d) => ({ x: at(d.day), y: d.wait_p50 })),
                  },
                  {
                    id: 'wait90',
                    label: 'Wait, slow end',
                    points: s.days.map((d) => ({ x: at(d.day), y: d.wait_p90 })),
                  },
                ]}
              />
            </Section>
            <Section title="Jobs per day">
              <TrendChart
                label="Finished jobs per day"
                unit="count"
                emptyText="No finished jobs in this period."
                series={[
                  {
                    id: 'jobs',
                    label: 'Finished jobs',
                    kind: 'column',
                    points: s.days.map((d) => ({ x: at(d.day), y: d.jobs })),
                  },
                ]}
              />
            </Section>
            <Section
              title="Forecast against actual"
              hint="One dot for each finished job. A dot on the diagonal ran exactly as forecast."
            >
              <Stack>
                <Text>
                  {s.forecast_points.length === 0
                    ? 'No finished job had a forecast yet.'
                    : `${formatNumber(Math.round(inside * 100))}% of ${formatNumber(s.forecast_points.length)} finished jobs ran inside their forecast range. The aim is about 80%.`}
                </Text>
                <ForecastChart
                  label="Forecast against actual run time"
                  points={s.forecast_points.map((p) => ({
                    forecastSec: p.forecast_seconds,
                    actualSec: p.actual_seconds,
                    loSec: p.lo,
                    hiSec: p.hi,
                    note: p.note,
                  }))}
                />
              </Stack>
            </Section>
            <Section
              title="Busiest hours"
              hint="Jobs started, by weekday and hour of the day."
            >
              <Heatmap
                label="Jobs started by weekday and hour"
                unit="count"
                rows={WEEKDAYS.map((label, weekday) => ({
                  label,
                  values: Array.from(
                    { length: 24 },
                    (_, hour) =>
                      s.hours.find((h) => h.weekday === weekday && h.hour === hour)
                        ?.count ?? 0,
                  ),
                }))}
              />
            </Section>
            <Text tone="muted">{`Showing the last ${days} days. ${RETENTION_WORDS}`}</Text>
          </Stack>
        );
      }}
    </Load>
  );
}
