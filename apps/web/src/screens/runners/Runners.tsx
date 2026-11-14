// Runners (web-console 4.5, R5.23): live list with isolation named (UX-61), delete, replace a runner that is
// not managed.
import {
  Button,
  Chips,
  Empty,
  LinkButton,
  Message,
  Page,
  PageHeader,
  SearchBar,
  Stack,
  Status,
  Table,
  formatAgo,
  useNow,
  type Column,
  type StatusKind,
} from '@crsp/ui';
import { useState } from 'react';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useLoad, useQuestion } from '../../api/hooks';
import { useSession } from '../../auth/session';
import { useVersion } from '../../live/LiveProvider';
import { Ask, Load } from '../common';
import { needsYes } from '../repositories/plans';

type Runner = Schemas['Runner'];

/** UX-61: every runner names its isolation; a persistent runner also says its state is kept between jobs. */
export function isolationText(r: Pick<Runner, 'isolation' | 'keeps_state'>): string {
  return r.isolation === 'persistent' || r.keeps_state
    ? `${r.isolation}, state kept between jobs`
    : r.isolation;
}

export function runnerStatus(r: Runner): { kind: StatusKind; word: string } {
  switch (r.state) {
    case 'idle':
      return { kind: 'ok', word: 'idle' };
    case 'busy':
      return { kind: 'running', word: 'running' };
    case 'failed':
      return { kind: 'failed', word: 'failed' };
    case 'offline':
      return { kind: 'failed', word: 'offline' };
    default:
      return { kind: 'waiting', word: r.state };
  }
}

export function RunnersList() {
  const client = useClient();
  const session = useSession();
  const now = useNow();
  const v = useVersion('runners');
  const { result, reload } = useLoad(() => unwrap(client.GET('/api/v1/runners')), [v]);
  const [q, setQ] = useState('');
  const [os, setOs] = useState<'' | 'linux' | 'windows' | 'macos'>('');
  const [iso, setIso] = useState<'' | Schemas['Isolation']>('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const admin = session.can('admin');
  const why = session.whyNot('admin');

  const del = useQuestion(
    async () => {
      for (const id of picked) {
        await unwrap(
          client.DELETE('/api/v1/runners/{runnerId}', {
            params: { path: { runnerId: id }, query: { confirm: true } },
          }),
        );
      }
    },
    () => {
      setPicked(new Set());
      reload();
    },
  );

  const [replacing, setReplacing] = useState<Runner | undefined>(undefined);
  const replace = useQuestion(
    async () => {
      if (!replacing) return;
      const plan = await unwrap(
        client.POST('/api/v1/runners/{runnerId}/replace', {
          params: { path: { runnerId: replacing.id } },
        }),
      );
      await unwrap(
        client.POST('/api/v1/runner-plans/{planId}/apply', {
          params: { path: { planId: plan.id } },
          body: { approved_steps: needsYes(plan) },
        }),
      );
    },
    () => {
      setReplacing(undefined);
      reload();
    },
  );

  const columns: Column<Runner>[] = [
    { id: 'name', header: 'Name', cell: (r) => r.name, sort: (r) => r.name },
    {
      id: 'machine',
      header: 'Machine',
      cell: (r) => r.machine_id,
      sort: (r) => r.machine_id,
    },
    { id: 'os', header: 'System', cell: (r) => r.os, sort: (r) => r.os },
    { id: 'backend', header: 'Backend', cell: (r) => r.backend },
    {
      id: 'iso',
      header: 'Isolation',
      cell: (r) => isolationText(r),
      sort: (r) => r.isolation,
    },
    { id: 'labels', header: 'Labels', cell: (r) => r.labels.join(', ') },
    {
      id: 'state',
      header: 'State',
      cell: (r) => {
        const s = runnerStatus(r);
        return <Status kind={s.kind} word={s.word} />;
      },
      sort: (r) => r.state,
    },
    {
      id: 'job',
      header: 'Current job',
      cell: (r) =>
        r.current_job ? `${r.current_job.repository} ${r.current_job.job_name}` : 'none',
    },
    {
      id: 'age',
      header: 'Age',
      cell: (r) => (r.created_at ? formatAgo(r.created_at, now) : 'not known'),
      sort: (r) => r.created_at ?? '',
    },
    {
      id: 'managed',
      header: 'Managed',
      cell: (r) =>
        r.managed ? (
          'yes'
        ) : (
          <Button
            onPress={() => {
              replace.cancel();
              setReplacing(r);
              replace.ask(
                [
                  `Runner ${r.name} is replaced by one this pool manages.`,
                  `The old runner is removed after the new one is ready.`,
                ],
                r.current_job
                  ? [`${r.current_job.repository} ${r.current_job.job_name}`]
                  : [],
              );
            }}
            disabled={!admin}
            reason={why}
          >
            Replace
          </Button>
        ),
    },
  ];

  const chosen = (result.state === 'ready' ? result.data.items : []).filter((r) =>
    picked.has(r.id),
  );

  return (
    <Page>
      <PageHeader
        title="Runners"
        lead="Every runner, with where it runs and how it is isolated."
        action={
          admin ? (
            <LinkButton kind="primary" to="/runners/add">
              Add runners
            </LinkButton>
          ) : (
            <Button kind="primary" disabled reason={why}>
              Add runners
            </Button>
          )
        }
      />
      <Load result={result} what="runners" reload={reload}>
        {(data) => {
          const rows = data.items.filter(
            (r) =>
              (!os || r.os === os) &&
              (!iso || r.isolation === iso) &&
              `${r.name} ${r.machine_id} ${r.labels.join(' ')}`
                .toLowerCase()
                .includes(q.trim().toLowerCase()),
          );
          if (data.items.length === 0)
            return (
              <Empty
                title="No runners yet. Add runners to start."
                action={
                  admin ? (
                    <LinkButton to="/runners/add">Add runners</LinkButton>
                  ) : undefined
                }
              />
            );
          return (
            <Stack>
              <SearchBar value={q} onChange={setQ} label="Search runners" />
              <Chips
                label="System"
                options={[
                  { value: 'linux', label: 'Linux' },
                  { value: 'windows', label: 'Windows' },
                  { value: 'macos', label: 'macOS' },
                ]}
                value={os}
                onChange={setOs}
              />
              <Chips
                label="Isolation"
                options={[
                  { value: 'microVM', label: 'microVM' },
                  { value: 'VM', label: 'VM' },
                  { value: 'container', label: 'container' },
                  { value: 'persistent', label: 'persistent' },
                ]}
                value={iso}
                onChange={setIso}
              />
              {picked.size > 0 ? (
                <Button
                  kind="danger"
                  disabled={!admin}
                  reason={why}
                  onPress={() =>
                    del.ask(
                      chosen.map((r) => `Runner ${r.name}`),
                      chosen.flatMap((r) =>
                        r.current_job
                          ? [`${r.current_job.repository} ${r.current_job.job_name}`]
                          : [],
                      ),
                    )
                  }
                >
                  {`Delete ${chosen.length} ${chosen.length === 1 ? 'runner' : 'runners'}`}
                </Button>
              ) : null}
              {rows.length === 0 ? (
                <Message tone="note">
                  {data.items.length} runners are hidden by the search and the filters.
                  Clear them to see all.
                </Message>
              ) : (
                <Table
                  caption="Runners"
                  columns={columns}
                  rows={rows}
                  rowKey={(r) => r.id}
                  selected={picked}
                  onToggle={(k) =>
                    setPicked((p) => {
                      const n = new Set(p);
                      if (n.has(k)) n.delete(k);
                      else n.add(k);
                      return n;
                    })
                  }
                  toggleLabel={(r) => `Select ${r.name}`}
                />
              )}
            </Stack>
          );
        }}
      </Load>
      <Ask
        title="Delete these runners?"
        action="Delete"
        busyLabel="Deleting"
        q={del.question}
        busy={del.busy}
        error={del.error}
        onCancel={del.cancel}
        onConfirm={() => void del.confirm()}
      />
      <Ask
        title={`Replace ${replacing?.name ?? 'the runner'}?`}
        action="Replace"
        busyLabel="Replacing"
        q={replace.question}
        busy={replace.busy}
        error={replace.error}
        onCancel={() => {
          replace.cancel();
          setReplacing(undefined);
        }}
        onConfirm={() => void replace.confirm()}
      />
    </Page>
  );
}
