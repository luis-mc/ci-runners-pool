// Settings (web-console 4.9, R5.27, R5.28): Users and roles, Appearance, Retention, Backups. Settings hold
// configuration only (UX-52). Each sub-page is a form that ends with Cancel and Save (UX-24), or a switch or
// one-choice list saved at once (UX-22).
import {
  Button,
  ChoiceField,
  Cluster,
  Dialog,
  Empty,
  ErrorSummary,
  Facts,
  FormActions,
  Message,
  NumberField,
  Page,
  PageHeader,
  Section,
  Stack,
  Status,
  Table,
  Tabs,
  TextField,
  TimePicker,
  formatDateTime,
  formatSize,
  type Column,
} from '@crsp/ui';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useCommand, useLoad, useQuestion } from '../../api/hooks';
import { useSession } from '../../auth/session';
import { Ask, Load } from '../common';

type User = Schemas['User'];

const TABS = [
  { id: 'users', label: 'Users and roles' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'retention', label: 'Retention' },
  { id: 'backups', label: 'Backups' },
  { id: 'updates', label: 'Updates' },
];

export function SettingsLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current =
    TABS.find((t) => pathname.startsWith(`/settings/${t.id}`))?.id ?? 'users';
  return (
    <Page>
      <PageHeader title="Settings" lead="Configuration only." />
      <Tabs
        label="Settings"
        tabs={TABS}
        current={current}
        onChange={(id) => void navigate(`/settings/${id}`)}
      />
      <Outlet />
    </Page>
  );
}

export function UsersSettings() {
  const client = useClient();
  const session = useSession();
  const owner = session.can('owner');
  const { result, reload } = useLoad(
    () =>
      owner
        ? unwrap(client.GET('/api/v1/users'))
        : Promise.resolve({ items: [] as User[] }),
    [owner],
  );
  const [login, setLogin] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [errors, setErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState<User | undefined>(undefined);
  const [newRole, setNewRole] = useState<Schemas['Role']>('viewer');
  const [target, setTarget] = useState<User | undefined>(undefined);

  const add = useCommand(async () => {
    const problems: string[] = [];
    if (!login.trim()) problems.push('Write the GitHub login to add.');
    setErrors(problems);
    if (problems.length) return;
    await unwrap(client.POST('/api/v1/users', { body: { login: login.trim(), role } }));
    setLogin('');
    reload();
  });
  const change = useCommand(async () => {
    if (!editing) return;
    await unwrap(
      client.PATCH('/api/v1/users/{userId}', {
        params: { path: { userId: editing.id } },
        body: { role: newRole },
      }),
    );
    setEditing(undefined);
    reload();
  });
  const remove = useQuestion(
    async () => {
      if (!target) return;
      await unwrap(
        client.DELETE('/api/v1/users/{userId}', {
          params: { path: { userId: target.id } },
        }),
      );
    },
    () => {
      setTarget(undefined);
      reload();
    },
  );

  const columns: Column<User>[] = [
    { id: 'login', header: 'GitHub login', cell: (u) => u.login, sort: (u) => u.login },
    { id: 'role', header: 'Role', cell: (u) => u.role, sort: (u) => u.role },
    { id: 'by', header: 'Added by', cell: (u) => u.added_by ?? 'the first sign-in' },
    {
      id: 'at',
      header: 'Added at',
      cell: (u) => formatDateTime(u.added_at),
      sort: (u) => u.added_at,
    },
    {
      id: 'last',
      header: 'Last sign-in',
      cell: (u) => (u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : 'never'),
    },
    {
      id: 'do',
      header: 'Actions',
      cell: (u) =>
        u.role === 'owner' ? (
          'The owner'
        ) : (
          <Cluster>
            <Button
              onPress={() => {
                setEditing(u);
                setNewRole(u.role);
              }}
            >
              Edit
            </Button>
            <Button
              kind="danger"
              onPress={() => {
                setTarget(u);
                remove.ask([`User ${u.login} can no longer sign in.`]);
              }}
            >
              Remove
            </Button>
          </Cluster>
        ),
    },
  ];

  if (!owner)
    return (
      <Message tone="needs-you">
        Only the owner can see and change users. Ask the owner to add or change one.
      </Message>
    );

  return (
    <Stack>
      <Section title="Users and roles">
        <Load result={result} what="users" reload={reload}>
          {(data) =>
            data.items.length <= 1 ? (
              <>
                <Table
                  caption="Users"
                  columns={columns}
                  rows={data.items}
                  rowKey={(u) => String(u.id)}
                />
                <Empty title="No other users yet. Add a GitHub login to let someone in." />
              </>
            ) : (
              <Table
                caption="Users"
                columns={columns}
                rows={data.items}
                rowKey={(u) => String(u.id)}
              />
            )
          }
        </Load>
      </Section>
      <Section title="Add a user">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void add.run();
          }}
        >
          <Stack>
            <ErrorSummary errors={errors} />
            <TextField label="GitHub login" value={login} onChange={setLogin} />
            <ChoiceField
              label="Role"
              value={role}
              onChange={(v) => setRole(v as 'admin' | 'viewer')}
              choices={[
                { value: 'viewer', label: 'Viewer: reads everything, changes nothing' },
                {
                  value: 'admin',
                  label: 'Admin: changes repositories, machines and runners',
                },
              ]}
            />
            {add.error ? (
              <Message tone="problem">Could not add the user. {add.error}</Message>
            ) : null}
            <FormActions>
              <Button onPress={() => setLogin('')}>Cancel</Button>
              <Button kind="primary" submit busy={add.busy} busyLabel="Adding">
                Add
              </Button>
            </FormActions>
          </Stack>
        </form>
      </Section>
      {editing ? (
        <Dialog
          title={`Edit ${editing.login}`}
          onClose={() => setEditing(undefined)}
          primary={{
            label: 'Save',
            onPress: () => void change.run(),
            busy: change.busy,
            busyLabel: 'Saving',
          }}
        >
          <ChoiceField
            label="Role"
            value={newRole}
            onChange={(v) => setNewRole(v as Schemas['Role'])}
            choices={[
              { value: 'viewer', label: 'Viewer' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          {change.error ? (
            <Message tone="problem">Could not save. {change.error}</Message>
          ) : null}
        </Dialog>
      ) : null}
      <Ask
        title={`Remove ${target?.login ?? 'the user'}?`}
        action="Remove"
        busyLabel="Removing"
        q={remove.question}
        busy={remove.busy}
        error={remove.error}
        onCancel={() => {
          remove.cancel();
          setTarget(undefined);
        }}
        onConfirm={() => void remove.confirm()}
      />
    </Stack>
  );
}

export function applyTheme(theme: Schemas['Theme']): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/** Loads the user's theme once signed in and applies it (UX-60). */
export function ThemeApplier() {
  const client = useClient();
  useEffect(() => {
    let on = true;
    unwrap(client.GET('/api/v1/me/preferences'))
      .then((p) => on && applyTheme(p.theme))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [client]);
  return null;
}

export function AppearanceSettings() {
  const client = useClient();
  const { result, reload } = useLoad(
    () => unwrap(client.GET('/api/v1/me/preferences')),
    [],
  );
  const save = useCommand(async (theme: Schemas['Theme']) => {
    const p = await unwrap(client.PUT('/api/v1/me/preferences', { body: { theme } }));
    applyTheme(p.theme);
    reload();
  });
  return (
    <Section title="Appearance">
      <Load result={result} what="your theme" reload={reload}>
        {(p) => (
          <Stack>
            <ChoiceField
              label="Theme"
              help="System follows your device. The choice is saved at once."
              value={p.theme}
              onChange={(v) => void save.run(v as Schemas['Theme'])}
              choices={[
                { value: 'system', label: 'System' },
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
            />
            {save.busy ? <Message tone="note">Saving the theme.</Message> : null}
            {save.error ? (
              <Message tone="problem">Could not save the theme. {save.error}</Message>
            ) : null}
          </Stack>
        )}
      </Load>
    </Section>
  );
}

export function RetentionSettings() {
  const client = useClient();
  const session = useSession();
  const { result, reload } = useLoad(() => unwrap(client.GET('/api/v1/settings')), []);
  return (
    <Section title="Retention">
      <Load result={result} what="retention" reload={reload}>
        {(s) => (
          <RetentionForm
            s={s}
            onSaved={reload}
            canEdit={session.can('owner')}
            why={session.whyNot('owner')}
          />
        )}
      </Load>
    </Section>
  );
}

function RetentionForm({
  s,
  onSaved,
  canEdit,
  why,
}: {
  s: Schemas['Settings'];
  onSaved: () => void;
  canEdit: boolean;
  why: string | undefined;
}) {
  const client = useClient();
  const [jobs, setJobs] = useState(s.retention_job_history_days ?? 90);
  const [logs, setLogs] = useState(s.retention_logs_days ?? 14);
  const [mib, setMib] = useState(s.retention_logs_mib_per_machine ?? 500);
  const [audit, setAudit] = useState(s.retention_audit_days ?? 365);
  const [raw, setRaw] = useState(s.retention_load_raw_hours ?? 48);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const save = useCommand(async () => {
    const p: string[] = [];
    for (const [n, v] of [
      ['Job history', jobs],
      ['Logs', logs],
      ['Audit log', audit],
    ] as const)
      if (v < 1) p.push(`${n} must be kept at least 1 day.`);
    setErrors(p);
    if (p.length) return;
    await unwrap(
      client.PATCH('/api/v1/settings', {
        body: {
          retention_job_history_days: jobs,
          retention_logs_days: logs,
          retention_logs_mib_per_machine: mib,
          retention_audit_days: audit,
          retention_load_raw_hours: raw,
        },
      }),
    );
    setSaved(true);
    onSaved();
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save.run();
      }}
    >
      <Stack>
        <ErrorSummary errors={errors} />
        <Cluster>
          <NumberField
            label="Job history"
            value={jobs}
            unit=" days"
            min={1}
            max={3650}
            onChange={setJobs}
          />
          <NumberField
            label="Logs"
            value={logs}
            unit=" days"
            min={1}
            max={3650}
            onChange={setLogs}
          />
          <NumberField
            label="Logs per machine"
            value={mib}
            unit=" MiB"
            min={1}
            max={100000}
            onChange={setMib}
          />
          <NumberField
            label="Audit log"
            value={audit}
            unit=" days"
            min={1}
            max={3650}
            onChange={setAudit}
          />
          <NumberField
            label="Raw load samples"
            value={raw}
            unit=" h"
            min={1}
            max={720}
            onChange={setRaw}
          />
        </Cluster>
        {saved ? <Message tone="done">Retention saved.</Message> : null}
        {save.error ? (
          <Message tone="problem">Could not save. {save.error}</Message>
        ) : null}
        <FormActions>
          <Button onPress={onSaved}>Cancel</Button>
          <Button
            kind="primary"
            submit
            busy={save.busy}
            busyLabel="Saving"
            disabled={!canEdit}
            reason={why}
          >
            Save
          </Button>
        </FormActions>
      </Stack>
    </form>
  );
}

export function BackupsSettings() {
  const client = useClient();
  const session = useSession();
  const { result, reload } = useLoad(() => unwrap(client.GET('/api/v1/backups')), []);
  const settings = useLoad(() => unwrap(client.GET('/api/v1/settings')), []);
  const admin = session.can('admin');
  const run = useCommand(async () => {
    await unwrap(client.POST('/api/v1/backups'));
    reload();
  });
  const [time, setTime] = useState<string | null>(null);
  const [keep, setKeep] = useState<number | undefined>(undefined);
  const saved = settings.result.state === 'ready' ? settings.result.data : undefined;
  const shownTime = time ?? saved?.backup_time_local ?? '03:00';
  const shownKeep = keep ?? saved?.backup_keep_days ?? 14;
  const save = useCommand(async () => {
    await unwrap(
      client.PATCH('/api/v1/settings', {
        body: { backup_time_local: shownTime, backup_keep_days: shownKeep },
      }),
    );
    settings.reload();
  });
  const cols: Column<Schemas['Backup']>[] = [
    { id: 'file', header: 'File', cell: (b) => b.file },
    {
      id: 'at',
      header: 'Made',
      cell: (b) => formatDateTime(b.created_at),
      sort: (b) => b.created_at,
    },
    {
      id: 'size',
      header: 'Size',
      cell: (b) => (b.size_bytes ? formatSize(b.size_bytes) : 'not known'),
    },
    {
      id: 'state',
      header: 'State',
      cell: (b) => (
        <Status
          kind={b.state === 'good' ? 'ok' : b.state === 'failed' ? 'failed' : 'running'}
          word={b.state === 'good' ? 'ok' : b.state}
        />
      ),
    },
  ];
  return (
    <Stack>
      <Section title="Backups">
        <Cluster>
          <Button
            kind="primary"
            onPress={() => void run.run()}
            busy={run.busy}
            busyLabel="Backing up"
            disabled={!admin}
            reason={session.whyNot('admin')}
          >
            Back up now
          </Button>
        </Cluster>
        {run.error ? (
          <Message tone="problem">Could not back up. {run.error}</Message>
        ) : null}
        <Load result={result} what="backups" reload={reload}>
          {(d) => (
            <Stack>
              {d.items.length === 0 ? (
                <Empty title="No backups yet. Back up now to make the first one." />
              ) : (
                <Table
                  caption="Backups"
                  columns={cols}
                  rows={d.items}
                  rowKey={(b) => b.id}
                />
              )}
              {d.last_drill ? (
                <Facts
                  items={[
                    {
                      name: 'Last restore drill',
                      value: JSON.stringify(d.last_drill).length ? 'ran' : '',
                    },
                  ]}
                />
              ) : null}
            </Stack>
          )}
        </Load>
      </Section>
      <Section title="Schedule">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save.run();
          }}
        >
          <Stack>
            <TimePicker label="Backup time" value={shownTime} onChange={setTime} />
            <NumberField
              label="Keep backups"
              value={shownKeep}
              unit=" days"
              min={1}
              max={3650}
              onChange={setKeep}
            />
            {save.error ? (
              <Message tone="problem">Could not save. {save.error}</Message>
            ) : null}
            <FormActions>
              <Button
                onPress={() => {
                  setTime(null);
                  setKeep(undefined);
                }}
              >
                Cancel
              </Button>
              <Button
                kind="primary"
                submit
                busy={save.busy}
                busyLabel="Saving"
                disabled={!session.can('owner')}
                reason={session.whyNot('owner')}
              >
                Save
              </Button>
            </FormActions>
          </Stack>
        </form>
      </Section>
    </Stack>
  );
}
