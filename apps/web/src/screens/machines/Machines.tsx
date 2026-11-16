// Machines (web-console 4.4, R5.22): list, detail, budget, slots, drain, resume, remove.
import {
  Button,
  Cluster,
  Chips,
  CheckRow,
  Empty,
  ErrorSummary,
  Facts,
  FieldGrid,
  FormActions,
  LinkButton,
  Message,
  NumberField,
  Page,
  PageHeader,
  ListToolbar,
  SearchBar,
  Section,
  Stack,
  Status,
  Table,
  Breadcrumbs,
  Text,
  TextLink,
  formatPast,
  formatPercent,
  formatSize,
  useNow,
  type Column,
} from '@crsp/ui';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useCommand, useLoad, useQuestion } from '../../api/hooks';
import { useMachines } from '../../api/machines';
import { useSession } from '../../auth/session';
import { useVersion } from '../../live/LiveProvider';
import { Ask, Load } from '../common';
import { machineStatus } from '../overview/Overview';
import { MachineDockerDiskSection } from './MachineDockerDisk';
import { MachinePolicySection, PolicyStatus } from './MachinePolicy';
import { PoolSizeWizard } from './PoolSize';
import { RecoverySection } from './Recovery';

type Machine = Schemas['Machine'];

const STATES = [
  { value: 'active', label: 'Online' },
  { value: 'draining', label: 'Draining' },
  { value: 'drained', label: 'Drained' },
] as const;

export function MachinesList() {
  const session = useSession();
  const now = useNow();
  const { result, reload } = useMachines();
  const [q, setQ] = useState('');
  const [state, setState] = useState<'' | 'active' | 'draining' | 'drained'>('');

  const columns: Column<Machine>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (m) => <TextLink to={`/machines/${m.id}`}>{m.name}</TextLink>,
      sort: (m) => m.name,
    },
    { id: 'os', header: 'System', cell: (m) => systemText(m), sort: (m) => m.os },
    {
      id: 'state',
      header: 'State',
      cell: (m) => {
        const s = machineStatus(m);
        return <Status kind={s.kind} word={s.word} />;
      },
      sort: (m) => machineStatus(m).word,
    },
    {
      id: 'takes',
      header: 'Takes jobs',
      cell: (m) => <PolicyStatus m={m} />,
      sort: (m) => (m.accepting === false ? 1 : 0),
    },
    {
      id: 'backends',
      header: 'Backends',
      cell: (m) =>
        m.backends
          .filter((b) => b.allowed && b.usable)
          .map((b) => b.name)
          .join(', ') || 'none',
    },
    {
      id: 'load',
      header: 'Load',
      cell: (m) =>
        m.load
          ? `memory ${m.load.memory_pct === undefined ? 'not known' : formatPercent(m.load.memory_pct)}, CPU ${m.load.cpu_pct === undefined ? 'not known' : formatPercent(m.load.cpu_pct)}`
          : 'not known',
    },
    {
      id: 'slots',
      header: 'Slots',
      cell: (m) => `${m.slots_used} of ${m.settings.job_slots}`,
    },
    {
      id: 'seen',
      header: 'Last seen',
      cell: (m) => formatPast(m.last_seen_at, now),
      sort: (m) => m.last_seen_at,
    },
  ];

  const addAction = (
    <Cluster>
      {session.can('admin') ? (
        <LinkButton to="/machines/add" kind="primary">
          Add a machine
        </LinkButton>
      ) : (
        <Button kind="primary" disabled reason={session.whyNot('admin')}>
          Add a machine
        </Button>
      )}
    </Cluster>
  );

  return (
    <Page>
      <PageHeader
        title="Machines"
        lead="What each machine gives the pool."
        action={addAction}
      />
      <Load result={result} what="machines" reload={reload}>
        {(data) => {
          const rows = data.items.filter(
            (m) =>
              (!state || m.state === state) &&
              m.name.toLowerCase().includes(q.trim().toLowerCase()),
          );
          if (data.items.length === 0)
            return (
              <Empty
                title="No machines yet. Add a machine to start."
                action={
                  session.can('admin') ? (
                    <LinkButton to="/machines/add">Add a machine</LinkButton>
                  ) : undefined
                }
              />
            );
          return (
            <Stack>
              <ListToolbar
                label="Machines"
                search={<SearchBar value={q} onChange={setQ} label="Search machines" />}
                filters={
                  <Chips
                    label="State"
                    options={STATES}
                    value={state}
                    onChange={setState}
                  />
                }
                count={`${rows.length} ${rows.length === 1 ? 'machine' : 'machines'}`}
              />
              {rows.length === 0 ? (
                <Message
                  tone="note"
                  action={
                    <Button
                      onPress={() => {
                        setQ('');
                        setState('');
                      }}
                    >
                      Clear search and filter
                    </Button>
                  }
                >
                  {data.items.length} machines are hidden by the search and the filter.
                  Clear them to see all.
                </Message>
              ) : (
                <Table
                  caption="Machines"
                  columns={columns}
                  rows={rows}
                  rowKey={(m) => m.id}
                />
              )}
            </Stack>
          );
        }}
      </Load>
    </Page>
  );
}

export function MachineDetail() {
  const { id = '' } = useParams();
  const client = useClient();
  const v = useVersion('machines');
  const { result, reload } = useLoad(
    () =>
      unwrap(
        client.GET('/api/v1/machines/{machineId}', {
          params: { path: { machineId: id } },
        }),
      ),
    [id, v],
  );
  return (
    <Page>
      <Breadcrumbs
        trail={[
          { to: '/machines', label: 'Machines' },
          { label: result.state === 'ready' ? result.data.name : 'Machine' },
        ]}
      />
      <Load result={result} what="the machine" reload={reload}>
        {(m) => <MachineBody m={m} onChanged={reload} />}
      </Load>
    </Page>
  );
}

function MachineBody({ m, onChanged }: { m: Machine; onChanged: () => void }) {
  const client = useClient();
  const session = useSession();
  const navigate = useNavigate();
  const admin = session.can('admin');
  const why = session.whyNot('admin');
  const s = machineStatus(m);
  const jobs = (m.running_jobs ?? []).map((j) => `${j.repository} ${j.job_name}`);

  const [mem, setMem] = useState(m.settings.budget_memory_pct);
  const [cpu, setCpu] = useState(m.settings.budget_cpu_pct);
  const [slots, setSlots] = useState(m.settings.job_slots);
  const [drain, setDrain] = useState(m.settings.drain_timeout_minutes);
  const [allowed, setAllowed] = useState<string[]>(m.settings.allowed_backends);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const body = useMemo(
    () => ({
      budget_memory_pct: mem,
      budget_cpu_pct: cpu,
      job_slots: slots,
      drain_timeout_minutes: drain,
      allowed_backends: allowed as Schemas['BackendName'][],
    }),
    [mem, cpu, slots, drain, allowed],
  );

  const saveAsk = useQuestion(
    () =>
      unwrap(
        client.PATCH('/api/v1/machines/{machineId}', {
          params: { path: { machineId: m.id } },
          body: { ...body, confirm: true },
        }),
      ),
    () => {
      setSaved(true);
      onChanged();
    },
  );
  const save = useCommand(async () => {
    const problems: string[] = [];
    if (mem < 1 || mem > 100) problems.push('Memory budget must be from 1% to 100%.');
    if (cpu < 1 || cpu > 100) problems.push('CPU budget must be from 1% to 100%.');
    if (slots < 1) problems.push('Job slots must be at least 1.');
    setErrors(problems);
    if (problems.length) return;
    try {
      await unwrap(
        client.PATCH('/api/v1/machines/{machineId}', {
          params: { path: { machineId: m.id } },
          body,
        }),
      );
      setSaved(true);
      onChanged();
    } catch (e) {
      if (
        e instanceof Error &&
        'code' in e &&
        (e as { code: string }).code === 'needs_confirmation'
      ) {
        saveAsk.ask(
          [`Settings of ${m.name} change and its runners restart.`],
          ((e as { details?: { text?: string }[] }).details ?? []).map(
            (d) => d.text ?? '',
          ),
        );
        return;
      }
      throw e;
    }
  });

  const drainQ = useQuestion(
    () =>
      unwrap(
        client.POST('/api/v1/machines/{machineId}/drain', {
          params: { path: { machineId: m.id } },
          body: {},
        }),
      ),
    onChanged,
  );
  const resume = useCommand(async () => {
    await unwrap(
      client.POST('/api/v1/machines/{machineId}/resume', {
        params: { path: { machineId: m.id }, query: { confirm: true } },
      }),
    );
    onChanged();
  });
  const removeQ = useQuestion(
    () =>
      unwrap(
        client.DELETE('/api/v1/machines/{machineId}', {
          params: { path: { machineId: m.id }, query: { confirm: true } },
        }),
      ),
    () => void navigate('/machines'),
  );

  const untickedUsable = m.backends.filter((b) => b.usable && !allowed.includes(b.name));
  const f = m.facts;
  return (
    <>
      <PageHeader
        title={m.name}
        lead={`${m.os} ${m.arch}`}
        action={
          m.state === 'drained' || m.state === 'draining' ? (
            <Button
              kind="primary"
              onPress={() => void resume.run()}
              busy={resume.busy}
              busyLabel="Resuming"
              disabled={!admin}
              reason={why}
            >
              Resume
            </Button>
          ) : (
            <Button
              kind="primary"
              onPress={() => drainQ.ask([`${m.name} stops taking new jobs.`], jobs)}
              disabled={!admin}
              reason={why}
            >
              Drain
            </Button>
          )
        }
      />
      {resume.error ? (
        <Message tone="problem">Could not resume. {resume.error}</Message>
      ) : null}
      {m.pending_change ? <DrainHolder change={m.pending_change} /> : null}
      <Section title="Facts">
        <Facts
          items={[
            { name: 'State', value: <Status kind={s.kind} word={s.word} /> },
            { name: 'Last seen', value: formatPast(m.last_seen_at) },
            { name: 'Slots in use', value: `${m.slots_used} of ${m.settings.job_slots}` },
            ...(f?.cpu_model
              ? [{ name: 'CPU', value: `${f.cpu_model}, ${f.cores ?? '?'} cores` }]
              : []),
            ...(f?.memory_bytes
              ? [{ name: 'Memory', value: formatSize(f.memory_bytes) }]
              : []),
            ...(f?.agent_version ? [{ name: 'Agent', value: f.agent_version }] : []),
          ]}
        />
      </Section>
      <RecoverySection m={m} onChanged={onChanged} />
      <MachinePolicySection m={m} onChanged={onChanged} />
      <MachineDockerDiskSection m={m} onChanged={onChanged} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run();
        }}
      >
        <Stack gap="loose">
          <ErrorSummary errors={errors} />
          <Section title="Backends">
            <Stack gap="tight">
              {untickedUsable.length > 0 ? (
                <Message
                  tone="needs-you"
                  action={
                    <Button
                      onPress={() =>
                        setAllowed((a) => [...a, ...untickedUsable.map((b) => b.name)])
                      }
                    >
                      {`Tick ${untickedUsable.map((b) => b.name).join(', ')}`}
                    </Button>
                  }
                >
                  {`${untickedUsable.map((b) => b.name).join(', ')} ${untickedUsable.length === 1 ? 'is' : 'are'} installed and works on this machine, but is not turned on. Tick it and press Save so this machine can run its runners.`}
                </Message>
              ) : null}
              {m.backends.map((b) => (
                <CheckRow
                  key={b.name}
                  label={b.name}
                  checked={allowed.includes(b.name)}
                  onChange={(c) =>
                    setAllowed((a) =>
                      c ? [...a, b.name] : a.filter((x) => x !== b.name),
                    )
                  }
                  // The reason is written once (UX-1): the lock text, or for a viewer the admin-only one.
                  help={b.usable ? (b.version ?? '') : ''}
                  {...(!admin || !b.usable
                    ? { disabledReason: !admin ? why : (b.reason ?? 'Not usable here.') }
                    : {})}
                />
              ))}
            </Stack>
          </Section>
          <Section title="Budget and slots">
            <FieldGrid>
              <NumberField
                label="Memory budget"
                value={mem}
                unit="%"
                min={1}
                max={100}
                onChange={setMem}
              />
              <NumberField
                label="CPU budget"
                value={cpu}
                unit="%"
                min={1}
                max={100}
                onChange={setCpu}
              />
              <NumberField
                label="Job slots"
                value={slots}
                min={1}
                max={64}
                onChange={setSlots}
              />
              <NumberField
                label="Drain timeout"
                value={drain}
                unit=" min"
                min={1}
                max={1440}
                onChange={setDrain}
              />
            </FieldGrid>
          </Section>
          {saved ? <Message tone="done">Settings saved.</Message> : null}
          {save.error ? (
            <Message tone="problem">Could not save. {save.error} Try again.</Message>
          ) : null}
          <FormActions>
            <Button onPress={() => void navigate('/machines')}>Cancel</Button>
            <Button
              kind="primary"
              submit
              busy={save.busy}
              busyLabel="Saving"
              disabled={!admin}
              reason={why}
            >
              Save
            </Button>
          </FormActions>
        </Stack>
      </form>
      <Section title="Pool size">
        <PoolSizeWizard m={m} onChanged={onChanged} />
      </Section>
      <Section title="Remove this machine">
        <Text tone="muted">
          Removing takes the machine and its runners out of the pool. Jobs that run there
          finish first. The agent stays installed on the machine.
        </Text>
        <Cluster>
          <Button
            kind="danger"
            onPress={() => removeQ.ask([`Machine ${m.name}`, `Its runners`], jobs)}
            disabled={!admin}
            reason={why}
          >
            Remove
          </Button>
        </Cluster>
      </Section>
      <Ask
        title={`Drain ${m.name}?`}
        action="Drain"
        busyLabel="Draining"
        q={drainQ.question}
        busy={drainQ.busy}
        error={drainQ.error}
        onCancel={drainQ.cancel}
        onConfirm={() => void drainQ.confirm()}
      />
      <Ask
        title={`Remove ${m.name}?`}
        action="Remove"
        busyLabel="Removing"
        q={removeQ.question}
        busy={removeQ.busy}
        error={removeQ.error}
        onCancel={removeQ.cancel}
        onConfirm={() => void removeQ.confirm()}
      />
      <Ask
        title="Save these settings?"
        action="Save"
        busyLabel="Saving"
        q={saveAsk.question}
        busy={saveAsk.busy}
        error={saveAsk.error}
        onCancel={saveAsk.cancel}
        onConfirm={() => void saveAsk.confirm()}
      />
    </>
  );
}

function minutes(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

/** The job that holds a drain, how long it runs and its usual time (machines R5.55, R5.56). */
function DrainHolder({ change }: { change: Schemas['MachineChange'] }) {
  const h = change.holder;
  const waiting = change.waiting_for ?? [];
  if (waiting.length === 0) return null;
  const j = h?.job ?? waiting[0]!;
  const runner = j.runner_name ? ` on ${j.runner_name}` : '';
  return (
    <Section title="Waiting for a drain">
      <Stack gap="tight">
        <Facts
          items={[
            { name: 'Holding it', value: `${j.repository} ${j.job_name}${runner}` },
            ...(h ? [{ name: 'Running for', value: minutes(h.running_seconds) }] : []),
            ...(h?.usual_seconds
              ? [{ name: 'Usually', value: minutes(h.usual_seconds) }]
              : []),
            { name: 'Jobs it waits for', value: String(waiting.length) },
          ]}
        />
        {h?.over_usual ? (
          <Message tone="problem">
            This job runs far past its usual time. crsp never stops a job. Wait longer, or
            cancel the change with Resume.
          </Message>
        ) : null}
        {change.choices?.length && !h?.over_usual ? (
          <Message tone="note">
            The drain timeout passed. crsp never stops a job. Wait longer, or cancel the
            change with Resume.
          </Message>
        ) : null}
      </Stack>
    </Section>
  );
}

const OS_WORD: Record<string, string> = {
  linux: 'Linux',
  windows: 'Windows',
  macos: 'macOS',
};

/** The System column: the system and arch, or, when the engine runs another
 * system's containers (Docker Desktop on WSL2), "Windows, runs Linux containers". */
export function systemText(m: Schemas['Machine']): string {
  if (m.container_os && m.container_os !== m.os) {
    return `${OS_WORD[m.os] ?? m.os}, runs ${OS_WORD[m.container_os] ?? m.container_os} containers`;
  }
  return `${m.os} ${m.arch}`;
}
