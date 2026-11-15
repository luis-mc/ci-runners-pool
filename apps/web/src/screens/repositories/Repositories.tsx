// Repositories (web-console 4.3, R5.21): list with search and filters, selection, turn the pool on or off,
// and the policy of one repository.
import {
  Button,
  CheckRow,
  Chips,
  Cluster,
  Breadcrumbs,
  Empty,
  ErrorSummary,
  Facts,
  FormActions,
  LinkButton,
  Message,
  NumberField,
  Page,
  PageHeader,
  Pager,
  SearchBar,
  Section,
  Stack,
  Status,
  Table,
  TextAreaField,
  TextField,
  TextLink,
  formatPast,
  paginate,
  useNow,
  type Column,
  type StatusKind,
} from '@crsp/ui';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, unwrap, useClient } from '../../api/api';
import { useCommand, useLoad, useQuestion } from '../../api/hooks';
import { useSession } from '../../auth/session';
import { useVersion } from '../../live/LiveProvider';
import { Ask, Load } from '../common';
import { allRepositories, applyChanges, type Repository } from './plans';

const PAGE = 25;

export function variableStatus(r: Repository): { kind: StatusKind; word: string } {
  if (!r.pool_on) return { kind: 'off', word: 'not used' };
  const bad = r.variables.find((v) => v.status === 'missing' || v.status === 'wrong');
  if (bad)
    return {
      kind: 'failed',
      word: `${bad.status === 'missing' ? 'missing' : 'wrong'} variable`,
    };
  if (r.variables.some((v) => v.status === 'not_managed'))
    return { kind: 'info', word: 'not managed' };
  return { kind: 'ok', word: 'variables ok' };
}

export function RepositoriesList() {
  const client = useClient();
  const session = useSession();
  const navigate = useNavigate();
  const now = useNow();
  const v = useVersion('plans');
  const { result, reload } = useLoad(() => allRepositories(client), [v]);
  const [q, setQ] = useState('');
  const [pool, setPool] = useState<'' | 'on' | 'off'>('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const admin = session.can('admin');

  const offQ = useQuestion(
    async () => {
      const plan = await applyChanges(
        client,
        [...picked].map((id) => ({ repository_id: id, pool: 'off' as const })),
      );
      if (plan.state !== 'done') throw new Error('Not every repository was turned off.');
    },
    () => {
      setPicked(new Set());
      reload();
    },
  );

  const columns: Column<Repository>[] = [
    {
      id: 'name',
      header: 'Repository',
      cell: (r) => (
        <TextLink to={`/repositories/${r.owner}/${r.name}`}>{r.name}</TextLink>
      ),
      sort: (r) => r.name,
    },
    { id: 'owner', header: 'Owner', cell: (r) => r.owner, sort: (r) => r.owner },
    {
      id: 'pool',
      header: 'Pool',
      cell: (r) => (
        <Status kind={r.pool_on ? 'ok' : 'off'} word={r.pool_on ? 'on' : 'off'} />
      ),
      sort: (r) => String(r.pool_on),
    },
    { id: 'labels', header: 'Labels', cell: (r) => r.policy.labels.join(', ') || 'none' },
    {
      id: 'max',
      header: 'Parallel jobs',
      cell: (r) => r.policy.max_parallel_jobs,
      sort: (r) => r.policy.max_parallel_jobs,
    },
    {
      id: 'prio',
      header: 'Priority',
      cell: (r) => r.policy.priority,
      sort: (r) => r.policy.priority,
    },
    {
      id: 'vars',
      header: 'Variables',
      cell: (r) => {
        const s = variableStatus(r);
        return <Status kind={s.kind} word={s.word} />;
      },
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Repositories"
        lead="Choose which repositories use the pool, and with which limits."
        action={
          admin ? (
            <LinkButton kind="primary" to="/repositories/turn-on">
              Turn on the pool
            </LinkButton>
          ) : (
            <Button kind="primary" disabled reason={session.whyNot('admin')}>
              Turn on the pool
            </Button>
          )
        }
      />
      <Load result={result} what="repositories" reload={reload}>
        {(data) => {
          const filtered = data.items.filter(
            (r) =>
              (!pool || (pool === 'on') === r.pool_on) &&
              r.full_name.toLowerCase().includes(q.trim().toLowerCase()),
          );
          const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
          const shown = paginate(filtered, Math.min(page, pages), PAGE);
          const selected = new Set([...picked].map(String));
          const chosen = data.items.filter((r) => picked.has(r.id));
          const noAdmin = chosen.filter((r) => !r.user_is_github_admin);
          if (data.items.length === 0)
            return (
              <Empty
                title="No repositories yet. Install the App on a repository to start."
                action={<InstallAppButton />}
              />
            );
          return (
            <Stack>
              {data.stale.stale ? (
                <Message tone="needs-you">
                  GitHub is not answering. The list is the last copy
                  {data.stale.as_of ? `, from ${formatPast(data.stale.as_of, now)}` : ''}.
                </Message>
              ) : null}
              <SearchBar
                value={q}
                onChange={(x) => {
                  setQ(x);
                  setPage(1);
                }}
                label="Search repositories"
              />
              <Chips
                label="Pool"
                options={[
                  { value: 'on', label: 'Pool on' },
                  { value: 'off', label: 'Pool off' },
                ]}
                value={pool}
                onChange={(x) => {
                  setPool(x);
                  setPage(1);
                }}
              />
              <Cluster>
                <Button onPress={() => setPicked(new Set(filtered.map((r) => r.id)))}>
                  {`Select all ${filtered.length}`}
                </Button>
                <Button
                  onPress={() => setPicked(new Set())}
                  disabled={picked.size === 0}
                  reason="Nothing is selected."
                >
                  Clear
                </Button>
                <InstallAppButton />
              </Cluster>
              {picked.size > 0 ? (
                <Cluster>
                  <Button
                    kind="primary"
                    disabled={!admin || noAdmin.length > 0}
                    reason={
                      !admin
                        ? session.whyNot('admin')
                        : noAdmin.length > 0
                          ? `You need admin rights on ${noAdmin.map((r) => r.full_name).join(', ')} in GitHub.`
                          : undefined
                    }
                    onPress={() =>
                      void navigate(
                        `/repositories/turn-on?${chosen.map((r) => `repo=${r.id}`).join('&')}`,
                      )
                    }
                  >
                    {`Turn on ${chosen.length} ${chosen.length === 1 ? 'repository' : 'repositories'}`}
                  </Button>
                  <Button
                    kind="danger"
                    disabled={!admin}
                    reason={session.whyNot('admin')}
                    onPress={() =>
                      offQ.ask(
                        chosen.flatMap((r) => [
                          `${r.full_name}: pool off`,
                          ...r.variables.map((x) => `${r.full_name}: variable ${x.name}`),
                        ]),
                      )
                    }
                  >
                    {`Turn off ${chosen.length} ${chosen.length === 1 ? 'repository' : 'repositories'}`}
                  </Button>
                </Cluster>
              ) : null}
              {filtered.length === 0 ? (
                <Message tone="note">
                  {data.items.length} repositories are hidden by the search and the
                  filter. Clear them to see all.
                </Message>
              ) : (
                <Table
                  caption="Repositories"
                  columns={columns}
                  rows={shown}
                  rowKey={(r) => String(r.id)}
                  selected={selected}
                  onToggle={(key) =>
                    setPicked((p) => {
                      const n = new Set(p);
                      const id = Number(key);
                      if (n.has(id)) n.delete(id);
                      else n.add(id);
                      return n;
                    })
                  }
                  toggleLabel={(r) => `Select ${r.full_name}`}
                />
              )}
              <Pager
                page={Math.min(page, pages)}
                pages={pages}
                onPage={setPage}
                label="Repository pages"
              />
            </Stack>
          );
        }}
      </Load>
      <Ask
        title="Turn off these repositories?"
        action="Turn off"
        busyLabel="Turning off"
        q={offQ.question}
        busy={offQ.busy}
        error={offQ.error}
        onCancel={offQ.cancel}
        onConfirm={() => void offQ.confirm()}
      />
    </Page>
  );
}

/** Adding a repository that is not listed opens GitHub's App install page (getAppInstallUrl). */
function InstallAppButton() {
  const client = useClient();
  const session = useSession();
  const open = useCommand(async () => {
    const r = await unwrap(client.GET('/api/v1/github/install-url'));
    window.open(r.url, '_blank', 'noopener');
  });
  return (
    <span>
      <Button
        onPress={() => void open.run()}
        busy={open.busy}
        busyLabel="Opening"
        disabled={!session.can('admin')}
        reason={session.whyNot('admin')}
      >
        Add a repository
      </Button>
      {open.error ? (
        <Message tone="problem">Could not open GitHub. {open.error}</Message>
      ) : null}
    </span>
  );
}

export function RepositoryDetail() {
  const { owner = '', name = '' } = useParams();
  const client = useClient();
  const v = useVersion('plans');
  const { result, reload } = useLoad(async () => {
    const list = await unwrap(
      client.GET('/api/v1/github/repositories', {
        params: { query: { q: name, limit: 100 } },
      }),
    );
    const hit = list.items.find((r) => r.owner === owner && r.name === name);
    if (!hit)
      throw new ApiError(
        'not_found',
        `${owner}/${name} is not listed. Install the App on it.`,
        404,
      );
    return unwrap(
      client.GET('/api/v1/repositories/{repositoryId}', {
        params: { path: { repositoryId: hit.id } },
      }),
    );
  }, [owner, name, v]);
  return (
    <Page>
      <Breadcrumbs
        trail={[
          { to: '/repositories', label: 'Repositories' },
          { label: `${owner}/${name}` },
        ]}
      />
      <Load result={result} what="the repository" reload={reload}>
        {(r) => <RepositoryBody r={r} onChanged={reload} />}
      </Load>
    </Page>
  );
}

function RepositoryBody({ r, onChanged }: { r: Repository; onChanged: () => void }) {
  const client = useClient();
  const session = useSession();
  const navigate = useNavigate();
  const admin = session.can('admin');
  const p = r.policy;
  const [labels, setLabels] = useState(p.labels.join(', '));
  const [groups, setGroups] = useState(p.runner_groups.join(', '));
  const [max, setMax] = useState(p.max_parallel_jobs);
  const [priority, setPriority] = useState(p.priority);
  const [forks, setForks] = useState(p.allow_fork_pull_requests);
  const [light, setLight] = useState(p.light_runner);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const split = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  const body = useMemo(
    () => ({
      labels: split(labels),
      runner_groups: split(groups),
      max_parallel_jobs: max,
      priority,
      allow_fork_pull_requests: forks,
      light_runner: light,
    }),
    [labels, groups, max, priority, forks, light],
  );

  const forkQ = useQuestion(
    () =>
      unwrap(
        client.PATCH('/api/v1/repositories/{repositoryId}/policy', {
          params: { path: { repositoryId: r.id } },
          body: { ...body, confirm_fork_risk: true },
        }),
      ),
    () => {
      setSaved(true);
      onChanged();
    },
  );
  const save = useCommand(async () => {
    const problems: string[] = [];
    if (max < 1) problems.push('Maximum parallel jobs must be at least 1.');
    if (split(labels).length === 0) problems.push('Add at least one label.');
    setErrors(problems);
    if (problems.length) return;
    if (forks && !p.allow_fork_pull_requests) {
      forkQ.ask([
        'Jobs from public forks run on your machines with your repository variables in reach.',
      ]);
      return;
    }
    await unwrap(
      client.PATCH('/api/v1/repositories/{repositoryId}/policy', {
        params: { path: { repositoryId: r.id } },
        body,
      }),
    );
    setSaved(true);
    onChanged();
  });

  const offQ = useQuestion(async () => {
    const plan = await applyChanges(client, [
      { repository_id: r.id, pool: 'off' as const },
    ]);
    if (plan.state !== 'done') throw new Error('The pool was not turned off.');
  }, onChanged);

  const vs = variableStatus(r);
  return (
    <>
      <PageHeader
        title={r.full_name}
        lead={`${r.visibility} repository`}
        action={
          r.pool_on ? (
            <Button
              kind="danger"
              disabled={!admin}
              reason={session.whyNot('admin')}
              onPress={() =>
                offQ.ask([
                  `${r.full_name}: pool off`,
                  ...r.variables.map((x) => `Variable ${x.name}`),
                ])
              }
            >
              Turn off the pool
            </Button>
          ) : (
            <Button
              kind="primary"
              disabled={!admin || !r.user_is_github_admin}
              reason={
                !admin
                  ? session.whyNot('admin')
                  : !r.user_is_github_admin
                    ? 'You need admin rights on this repository in GitHub.'
                    : undefined
              }
              onPress={() => void navigate(`/repositories/turn-on?repo=${r.id}`)}
            >
              Turn on the pool
            </Button>
          )
        }
      />
      <Section title="State">
        <Facts
          items={[
            {
              name: 'Pool',
              value: (
                <Status kind={r.pool_on ? 'ok' : 'off'} word={r.pool_on ? 'on' : 'off'} />
              ),
            },
            { name: 'Variables', value: <Status kind={vs.kind} word={vs.word} /> },
            ...r.variables.map((x) => ({
              name: x.name,
              value: x.status.replace('_', ' '),
            })),
          ]}
        />
      </Section>
      <Section title="Policy">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save.run();
          }}
        >
          <Stack>
            <ErrorSummary errors={errors} />
            <TextField
              label="Labels"
              help="Separate labels with commas."
              value={labels}
              onChange={setLabels}
              width="full"
            />
            <TextField
              label="Runner groups"
              optional
              value={groups}
              onChange={setGroups}
              width="full"
            />
            <Cluster>
              <NumberField
                label="Maximum parallel jobs"
                value={max}
                min={1}
                max={64}
                onChange={setMax}
              />
              <NumberField
                label="Priority"
                value={priority}
                min={0}
                max={100}
                onChange={setPriority}
              />
            </Cluster>
            <CheckRow
              label="Run jobs from public forks"
              checked={forks}
              onChange={setForks}
            />
            <CheckRow
              label="Keep a light runner for short jobs"
              checked={light}
              onChange={setLight}
            />
            <Message tone="note">
              A light runner is kept free for jobs that last seconds, so they do not wait
              behind a long build. A workflow uses it with runs-on:{' '}
              {'${{ vars.RUNS_ON_LIGHT }}'}.
            </Message>
            {forks ? (
              <Message tone="needs-you">
                Jobs from public forks run code you did not write. Save asks once more
                before this takes effect.
              </Message>
            ) : null}
            {saved ? <Message tone="done">Policy saved.</Message> : null}
            {save.error ? (
              <Message tone="problem">Could not save. {save.error}</Message>
            ) : null}
            <FormActions>
              <Button onPress={() => void navigate('/repositories')}>Cancel</Button>
              <Button
                kind="primary"
                submit
                busy={save.busy}
                busyLabel="Saving"
                disabled={!admin}
                reason={session.whyNot('admin')}
              >
                Save
              </Button>
            </FormActions>
          </Stack>
        </form>
      </Section>
      <Section title="Extra packages">
        <ExtraPackages r={r} onChanged={onChanged} />
      </Section>
      <Ask
        title="Allow jobs from public forks?"
        action="Allow"
        busyLabel="Saving"
        q={forkQ.question}
        busy={forkQ.busy}
        error={forkQ.error}
        onCancel={forkQ.cancel}
        onConfirm={() => void forkQ.confirm()}
      />
      <Ask
        title={`Turn off ${r.full_name}?`}
        action="Turn off"
        busyLabel="Turning off"
        q={offQ.question}
        busy={offQ.busy}
        error={offQ.error}
        onCancel={offQ.cancel}
        onConfirm={() => void offQ.confirm()}
      />
    </>
  );
}

const PACKAGE_NAME = /^[A-Za-z0-9][A-Za-z0-9+.-]*$/;

/** The first mistake of a package list, with its line number, as the controller words it (runners R5.51). */
export function packageMistakes(text: string): string[] {
  const out: string[] = [];
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((raw, i) => {
      const line = raw.trim();
      if (line === '' || line.startsWith('#') || PACKAGE_NAME.test(line)) return;
      out.push(
        `Line ${i + 1}: ${line} is not a package name. Use letters, digits and + - . only, and do not start with -.`,
      );
    });
  return out;
}

/** The extra distribution packages of the repository's pool image, one per line (runners R5.51). */
function ExtraPackages({ r, onChanged }: { r: Repository; onChanged: () => void }) {
  const client = useClient();
  const session = useSession();
  const admin = session.can('admin');
  const start = (r.policy.extra_packages ?? []).join('\n');
  const [text, setText] = useState(start);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const save = useCommand(async () => {
    setSaved(false);
    const problems = packageMistakes(text);
    setErrors(problems);
    if (problems.length) return;
    const list = await unwrap(
      client.PUT('/api/v1/repositories/{repositoryId}/extra-packages', {
        params: { path: { repositoryId: r.id } },
        body: { text },
      }),
    );
    setText(list.text);
    setSaved(true);
    onChanged();
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
        <TextAreaField
          label="Extra packages"
          help="Distribution packages added to the pool image, one name per line."
          value={text}
          onChange={(x) => {
            setText(x);
            setSaved(false);
          }}
          rows={6}
          width="full"
          mono
          optional
          error={errors[0]}
        />
        <Message tone="note">
          A changed list builds a new image aside. Running jobs keep the old image until
          they end.
        </Message>
        {saved ? <Message tone="done">Extra packages saved.</Message> : null}
        {save.error ? (
          <Message tone="problem">Could not save the packages. {save.error}</Message>
        ) : null}
        <FormActions>
          <Button
            onPress={() => {
              setText(start);
              setErrors([]);
              setSaved(false);
            }}
          >
            Undo changes
          </Button>
          <Button
            kind="primary"
            submit
            busy={save.busy}
            busyLabel="Saving"
            disabled={!admin}
            reason={session.whyNot('admin')}
          >
            Save packages
          </Button>
        </FormActions>
      </Stack>
    </form>
  );
}
