// Jobs, Overview (UX-75, concept A of the Jobs redesign study): four numbers with their change and trend, the top
// three findings, and cards that only show and link (UX-52). Every tile and card leads to a list.
import {
  BarList,
  Card,
  CardGrid,
  FindingList,
  Section,
  Sparkline,
  Stack,
  StatGrid,
  StatTile,
  Text,
  TextLink,
  formatDuration,
  type BarItem,
  type FindingItem,
} from '@crsp/ui';
import { Navigate, useSearchParams } from 'react-router-dom';
import { unwrap, useClient } from '../../api/api';
import { useLoad } from '../../api/hooks';
import { findingPath } from '../insights/DoNext';
import { useFindings } from '../insights/api';
import { minutesWords, ranked, type Finding } from '../insights/words';
import { Load } from '../common';
import { FILTER_KEYS, useGroups, useJobList, useStats } from './api';
import { groupLink } from './Groups';
import { passChange, passRate, periods, waitChange } from './overviewStats';

/** An old address of the Queue (`/jobs?view=jobs`, `/jobs?repository=...`) goes to the list it used to show. */
const LIST_PARAMS: readonly string[] = [...FILTER_KEYS, 'view', 'elsewhere', 'state'];

export function JobsIndex() {
  const [params] = useSearchParams();
  if (LIST_PARAMS.some((k) => params.has(k))) {
    const rest = new URLSearchParams(params);
    const elsewhere = rest.get('elsewhere') === '1';
    rest.delete('elsewhere');
    if (!elsewhere && !rest.has('state')) rest.set('state', 'queued');
    const q = rest.toString();
    return (
      <Navigate
        to={`/jobs/${elsewhere ? 'elsewhere' : 'live'}${q ? `?${q}` : ''}`}
        replace
      />
    );
  }
  return <Overview />;
}

function usePoolBusy(): { used: number; slots: number } | undefined {
  const client = useClient();
  const r = useLoad(() => unwrap(client.GET('/api/v1/machines')), []);
  if (r.result.state !== 'ready') return undefined;
  const on = r.result.data.items.filter((m) => m.online);
  const slots = on.reduce((n, m) => n + (m.settings?.job_slots ?? 0), 0);
  return slots > 0
    ? { used: on.reduce((n, m) => n + m.slots_used, 0), slots }
    : undefined;
}

function Overview() {
  const stats = useStats(14);
  const waiting = useJobList({ state: 'queued', limit: 1 });
  const pool = usePoolBusy();
  const findings = useFindings(undefined);
  const groups = useGroups('repository');
  return (
    <Stack>
      <Load result={stats.result} what="the overview" reload={stats.reload}>
        {(s) => {
          const { last, prev } = periods(s.days);
          const wait = waitChange(last, prev);
          const pass = passChange(last, prev);
          const rate = passRate(last);
          const queued =
            waiting.result.state === 'ready' ? waiting.result.data.total : undefined;
          return (
            <>
              <StatGrid>
                <StatTile
                  label="Waiting now"
                  {...(queued === undefined ? {} : { value: String(queued) })}
                  unit={queued === 1 ? 'job' : 'jobs'}
                  to="/jobs/live?state=queued"
                  linkName="Open the jobs that wait now"
                />
                <StatTile
                  label="Wait, slow end"
                  {...(last.waitP90 === undefined
                    ? {}
                    : { value: formatDuration(Math.round(last.waitP90)) })}
                  {...(wait ? { change: wait.change, changeText: wait.text } : {})}
                  trend={last.waitSeries}
                  trendUnit="seconds"
                  to="/jobs/charts"
                  linkName="Open the charts of the waits"
                />
                <StatTile
                  label="Jobs that passed"
                  {...(rate === undefined ? {} : { value: `${Math.round(rate)}%` })}
                  {...(pass ? { change: pass.change, changeText: pass.text } : {})}
                  trend={last.passSeries}
                  trendUnit="percent"
                  to="/jobs/done"
                  linkName="Open the finished jobs"
                />
                <StatTile
                  label="Pool busy"
                  {...(pool
                    ? {
                        value: `${Math.round((pool.used / pool.slots) * 100)}%`,
                        changeText: `${pool.used} of ${pool.slots} slots in use`,
                      }
                    : {})}
                  to="/pool/machines"
                  linkName="Open the machines"
                />
              </StatGrid>
              <Section
                title="Needs you"
                hint="The things that save the most time a week, best first. Open one to change it."
              >
                {findings.result.state === 'ready' ? (
                  <FindingList
                    label="Needs you"
                    items={strip(findings.result.data.items)}
                  />
                ) : (
                  <Text tone="muted">Loading the findings.</Text>
                )}
              </Section>
              <CardGrid>
                <Card title="Where the time goes" to="/jobs/charts">
                  <Text>
                    {last.waitP90 === undefined
                      ? 'No finished jobs in the last 7 days.'
                      : `The slow end of the wait was ${formatDuration(Math.round(last.waitP90))} over the last 7 days.`}
                  </Text>
                  <Sparkline
                    label="Slow-end wait by day"
                    values={last.waitSeries}
                    unit="seconds"
                  />
                </Card>
                <Card title="Busiest repositories" to="/jobs/done?group=repository">
                  <Load
                    result={groups.result}
                    what="the repositories"
                    reload={groups.reload}
                  >
                    {(g) => (
                      <BarList
                        label="Busiest repositories"
                        items={g.items
                          .map((r): BarItem => ({
                            key: r.name,
                            label: r.name,
                            value: r.done + r.running + r.queued,
                            text: `${r.done + r.running + r.queued} jobs`,
                            linkName: `Open the jobs of ${r.name}`,
                            to: groupLink('repository', r),
                          }))
                          .sort((a, b) => b.value - a.value)
                          .slice(0, 5)}
                      />
                    )}
                  </Load>
                </Card>
                <Card title="Failed" to="/jobs/done?state=done">
                  <Text>
                    {last.jobs === 0
                      ? 'No finished jobs in the last 7 days.'
                      : `${last.failed} of ${last.jobs} jobs failed in the last 7 days.`}
                  </Text>
                </Card>
                <Card title="Run elsewhere" to="/jobs/elsewhere">
                  <Text>
                    Jobs that GitHub gave to a runner that is not crsp. Open the list to
                    see which runner each one used.
                  </Text>
                </Card>
              </CardGrid>
              <Text tone="muted">
                Each number is compared with the 7 days before.{' '}
                <TextLink to="/jobs/charts">Open the charts</TextLink> for longer ranges.
              </Text>
            </>
          );
        }}
      </Load>
    </Stack>
  );
}

function strip(items: readonly Finding[]): FindingItem[] {
  return ranked(items)
    .slice(0, 3)
    .map((f) => ({
      key: String(f.id),
      title: f.title,
      minutes: minutesWords(f.minutes_saved_week),
      fix: f.fix,
      to: findingPath(f),
      linkLabel: `Open: ${f.title}`,
    }));
}
