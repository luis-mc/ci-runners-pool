// Doctor (web-console 4.8, R5.26): findings grouped by area with a status word (UX-58), what is wrong and its fix,
// the time of the last run (UX-53), and "Run the doctor" as the one primary (UX-4). It is busy while the run lasts
// and shows its progress (UX-13, UX-29); the busy state is the server's run state, not a timer (UX-19).
import {
  Badge,
  Button,
  CodeBlock,
  Cluster,
  Empty,
  LinkButton,
  Message,
  Page,
  PageHeader,
  Progress,
  Section,
  Stack,
  Status,
  Table,
  Text,
  formatCount,
  formatPast,
  useNow,
  type Column,
  type StatusKind,
} from '@crsp/ui';
import { useEffect, useState } from 'react';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useCommand, useLoad } from '../../api/hooks';
import { useSession } from '../../auth/session';
import { useVersion } from '../../live/LiveProvider';
import { Load } from '../common';

type Finding = Schemas['DoctorFinding'];
type Run = Schemas['DoctorRun'];
type Severity = Schemas['Severity'];

/** How often a running run is asked again when no live event came. */
export const POLL_MS = 3000;

/** The areas of the screen, in order; a check id starts with its area (doctor spec). */
const AREAS: [string, string][] = [
  ['machine', 'Machines'],
  ['backend', 'Backends'],
  ['runner', 'Runners'],
  ['github', 'GitHub registration'],
  ['repo', 'Repository variables'],
  ['workflow', 'Workflow labels'],
  ['controller', 'Controller'],
];

export function areaOf(check: string): string {
  const prefix = check.split('.')[0] ?? check;
  return (
    AREAS.find(([p]) => p === prefix)?.[1] ??
    prefix.charAt(0).toUpperCase() + prefix.slice(1)
  );
}

/** UX-58: every severity is a word, a glyph and a colour. */
export function severityStatus(s: Severity): { kind: StatusKind; word: string } {
  switch (s) {
    case 'ok':
      return { kind: 'ok', word: 'ok' };
    case 'fail':
      return { kind: 'failed', word: 'failed' };
    case 'warn':
      return { kind: 'waiting', word: 'warning' };
    case 'skip':
      return { kind: 'off', word: 'skipped' };
    default:
      return { kind: 'info', word: 'info' };
  }
}

const isProblem = (f: Finding) => f.severity === 'fail' || f.severity === 'warn';

/** The groups in screen order, each with the findings that are not simply ok. */
export function groupFindings(
  items: readonly Finding[],
): { area: string; items: Finding[] }[] {
  const order = [...AREAS.map(([, name]) => name)];
  const groups = new Map<string, Finding[]>();
  for (const f of items) {
    if (f.severity === 'ok') continue;
    const area = areaOf(f.check);
    groups.set(area, [...(groups.get(area) ?? []), f]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const x = order.indexOf(a);
      const y = order.indexOf(b);
      return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || a.localeCompare(b);
    })
    .map(([area, list]) => ({ area, items: list }));
}

export function DoctorScreen() {
  const client = useClient();
  const session = useSession();
  const now = useNow();
  const v = useVersion('doctor');
  const admin = session.can('admin');
  const why = session.whyNot('admin');
  const { result, reload } = useLoad(
    () => unwrap(client.GET('/api/v1/doctor/findings', { params: { query: {} } })),
    [v],
  );
  const [run, setRun] = useState<Run | undefined>(undefined);
  const start = useCommand(async () => {
    const r = await unwrap(client.POST('/api/v1/doctor/runs', { body: {} }));
    setRun(r);
    return r;
  });
  const running = run?.state === 'running';

  // The run's own state is read from the server: on every live doctor event, and on a slow poll as a fallback.
  const runId = run?.id;
  useEffect(() => {
    if (!runId || !running) return;
    let live = true;
    const ask = () =>
      unwrap(client.GET('/api/v1/doctor/runs/{runId}', { params: { path: { runId } } }))
        .then((r) => {
          if (!live) return;
          setRun(r);
          if (r.state !== 'running') reload();
        })
        .catch(() => undefined);
    void ask();
    const timer = setInterval(() => void ask(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
    // `v` makes a live doctor event ask again at once.
  }, [runId, running, v, client]);

  const columns: Column<Finding>[] = [
    {
      id: 'status',
      header: 'Status',
      cell: (f) => {
        const s = severityStatus(f.severity);
        return <Status kind={s.kind} word={s.word} />;
      },
      sort: (f) => f.severity,
    },
    {
      id: 'what',
      header: 'What is wrong',
      cell: (f) => (
        <Stack gap="tight">
          <span>{f.title}</span>
          <Text tone="muted">{f.subject.name}</Text>
          {f.detail ? <Text tone="muted">{f.detail}</Text> : null}
        </Stack>
      ),
    },
    {
      id: 'fix',
      header: 'Fix',
      cell: (f) => (
        <Stack gap="tight">
          <span>{f.fix.text}</span>
          {f.fix.command ? <CodeBlock text={f.fix.command} label="Fix command" /> : null}
          {f.fix.link?.startsWith('/') ? (
            <Cluster>
              <LinkButton to={f.fix.link}>Open</LinkButton>
            </Cluster>
          ) : null}
          {f.needs_admin && !admin ? <Badge>needs admin</Badge> : null}
        </Stack>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Doctor"
        lead="Every problem the pool has, with its fix."
        action={
          <Button
            kind="primary"
            busy={running || start.busy}
            busyLabel="Running the doctor"
            disabled={!admin}
            reason={why}
            onPress={() => void start.run()}
          >
            Run the doctor
          </Button>
        }
      />
      {start.error ? (
        <Message tone="problem">
          Could not run the doctor. {start.error} Try again.
        </Message>
      ) : null}
      {running ? (
        <Stack gap="tight">
          <Text>
            Running the doctor.{' '}
            {formatCount(
              Object.values(run?.counts ?? {}).reduce((a, b) => a + b, 0),
              'check',
            )}{' '}
            done so far.
          </Text>
          <Progress label="Running the doctor" />
        </Stack>
      ) : null}
      {run?.state === 'failed' ? (
        <Message tone="problem">
          The doctor run failed. Run the doctor again. If it fails again, look at the
          controller log.
        </Message>
      ) : null}
      <Load result={result} what="the doctor findings" reload={reload}>
        {(data) => {
          const groups = groupFindings(data.items);
          const problems = data.items.filter(isProblem);
          if (data.items.length === 0 && !data.last_run_at)
            return (
              <Section title="Findings">
                <Empty title="No checks have run yet. Use Run the doctor at the top to look for problems." />
              </Section>
            );
          const last = data.last_run_at ? formatPast(data.last_run_at, now) : undefined;
          return (
            <Stack>
              {last ? <Text tone="muted">{`Last run ${last}.`}</Text> : null}
              {problems.length === 0 ? (
                <Message tone="done">
                  No problems found.{last ? ` The doctor ran ${last}.` : ''}
                </Message>
              ) : (
                <Message tone="needs-you">
                  {`${formatCount(problems.length, 'problem')} found. Each one has its fix below.`}
                </Message>
              )}
              {groups.map((g) => (
                <Section key={g.area} title={g.area}>
                  <Table
                    caption={g.area}
                    columns={columns}
                    rows={g.items}
                    rowKey={(f) => `${f.check}:${f.subject.id}`}
                  />
                </Section>
              ))}
            </Stack>
          );
        }}
      </Load>
    </Page>
  );
}
