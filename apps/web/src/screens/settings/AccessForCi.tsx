// Settings > Access for CI (web-console R5.90, R5.91; github-integration R5.82 to R5.84). An access credential lets a
// CI job read what `crsp parity check` needs and nothing else. It is made, listed and revoked here, shown once, and
// the action "Set up parity for this repository" writes it to a repository through the GitHub App, so nobody copies
// a value. Only shared parts of @crsp/ui are used (UX-9, UX-22, UX-24, UX-26, UX-38, UX-62).
import {
  Button,
  ChoiceField,
  Cluster,
  CodeBlock,
  Dialog,
  Empty,
  ErrorSummary,
  ExternalButton,
  Facts,
  FormActions,
  Message,
  Section,
  Stack,
  Status,
  Table,
  TextField,
  formatDateTime,
  type Column,
} from '@crsp/ui';
import { useState } from 'react';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useCommand, useLoad, useQuestion, type Loaded } from '../../api/hooks';
import { useSession } from '../../auth/session';
import { Ask, Load } from '../common';

type Credential = Schemas['AccessCredential'];
type Setup = Schemas['ParitySetup'];
type Address = Schemas['ParityAddress'];

const PERMISSION_WORDS: Record<string, string> = {
  secrets: 'Secrets (write)',
  actions_variables: 'Variables (write)',
};

function httpsOnly(url: string | undefined): string | undefined {
  return url?.startsWith('https://github.com/') ? url : undefined;
}

export function AccessForCiSettings() {
  const session = useSession();
  const admin = session.can('admin');
  if (!admin)
    return (
      <Message tone="needs-you">
        Only an admin can make, see or revoke access for CI. Ask an admin to do it.
      </Message>
    );
  return (
    <Stack>
      <AccessCredentials />
      <ParitySetupAction />
    </Stack>
  );
}

function AccessCredentials() {
  const client = useClient();
  const { result, reload } = useLoad(
    () => unwrap(client.GET('/api/v1/access-credentials')),
    [],
  );
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [shown, setShown] = useState<{ value: string; name: string } | undefined>(
    undefined,
  );
  const [target, setTarget] = useState<Credential | undefined>(undefined);

  const make = useCommand(async () => {
    const problems: string[] = [];
    if (!name.trim()) problems.push('Write a name for the access, such as "parity CI".');
    setErrors(problems);
    if (problems.length) return;
    const made = await unwrap(
      client.POST('/api/v1/access-credentials', {
        body: { name: name.trim(), scope: 'parity' },
      }),
    );
    setShown({ value: made.value, name: made.info.name });
    setName('');
    reload();
  });
  const revoke = useQuestion(
    async () => {
      if (!target) return;
      await unwrap(
        client.DELETE('/api/v1/access-credentials/{credentialId}', {
          params: { path: { credentialId: target.id } },
        }),
      );
    },
    () => {
      setTarget(undefined);
      reload();
    },
  );

  const columns: Column<Credential>[] = [
    { id: 'name', header: 'Name', cell: (c) => c.name, sort: (c) => c.name },
    { id: 'scope', header: 'Can do', cell: () => 'Read only: the checks of parity' },
    { id: 'by', header: 'Made by', cell: (c) => c.created_by },
    {
      id: 'at',
      header: 'Made',
      cell: (c) => formatDateTime(c.created_at),
      sort: (c) => c.created_at,
    },
    {
      id: 'used',
      header: 'Last used',
      cell: (c) => (c.last_used_at ? formatDateTime(c.last_used_at) : 'never'),
    },
    {
      id: 'state',
      header: 'State',
      cell: (c) =>
        c.revoked_at ? (
          <Status kind="off" word="revoked" />
        ) : (
          <Status kind="ok" word="live" />
        ),
    },
    {
      id: 'do',
      header: 'Actions',
      cell: (c) =>
        c.revoked_at ? (
          'Revoked'
        ) : (
          <Button
            kind="danger"
            onPress={() => {
              setTarget(c);
              revoke.ask([
                `Access ${c.name} stops working at once. A CI job that uses it is refused.`,
              ]);
            }}
          >
            Revoke
          </Button>
        ),
    },
  ];

  return (
    <Stack>
      <Section title="Access for CI">
        <Message tone="note">
          An access for CI is a value a CI job uses to read the pool. It can read the
          runners and run the doctor, which is all that the parity check needs. It cannot
          change a machine, a runner, a setting or a user.
        </Message>
        <Load result={result} what="access for CI" reload={reload}>
          {(d) =>
            d.items.length === 0 ? (
              <Empty title="No access yet. Set up parity for a repository below, or make one here." />
            ) : (
              <Table
                caption="Access for CI"
                columns={columns}
                rows={d.items}
                rowKey={(c) => c.id}
              />
            )
          }
        </Load>
      </Section>
      <Section title="Make an access">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void make.run();
          }}
        >
          <Stack>
            <ErrorSummary errors={errors} />
            <TextField label="Name" value={name} onChange={setName} />
            <ChoiceField
              label="What it can do"
              value="parity"
              onChange={() => undefined}
              choices={[
                {
                  value: 'parity',
                  label: 'Parity: read the runners and run the doctor, nothing else',
                },
              ]}
            />
            {make.error ? (
              <Message tone="problem">Could not make the access. {make.error}</Message>
            ) : null}
            <FormActions>
              <Button
                onPress={() => {
                  setName('');
                  setErrors([]);
                }}
              >
                Cancel
              </Button>
              <Button kind="primary" submit busy={make.busy} busyLabel="Making">
                Make
              </Button>
            </FormActions>
          </Stack>
        </form>
      </Section>
      {shown ? (
        <Dialog
          title={`Access ${shown.name} is made`}
          onClose={() => setShown(undefined)}
          cancelLabel="I have it"
        >
          <Stack>
            <Message tone="needs-you">
              This is the only time the value is shown. crsp keeps no copy of it. Copy it
              now, or revoke this access and make another.
            </Message>
            <CodeBlock label="Access value" text={shown.value} />
          </Stack>
        </Dialog>
      ) : null}
      <Ask
        title={`Revoke ${target?.name ?? 'the access'}?`}
        action="Revoke"
        busyLabel="Revoking"
        q={revoke.question}
        busy={revoke.busy}
        error={revoke.error}
        onCancel={() => {
          revoke.cancel();
          setTarget(undefined);
        }}
        onConfirm={() => void revoke.confirm()}
      />
    </Stack>
  );
}

function ParitySetupAction() {
  const client = useClient();
  const session = useSession();
  const { result, reload } = useLoad(
    () =>
      unwrap(
        client.GET('/api/v1/github/repositories', { params: { query: { limit: 200 } } }),
      ),
    [],
  );
  const address = useLoad(() => unwrap(client.GET('/api/v1/parity-address')), []);
  const needsAddress =
    address.result.state === 'ready' && address.result.data.status === 'needs_address';
  const [repo, setRepo] = useState('');
  const [outcome, setOutcome] = useState<
    { repo: string; setup: Setup; names: string } | undefined
  >(undefined);

  const run = useCommand(async (id: number, full: string) => {
    setOutcome(undefined);
    const setup = await unwrap(
      client.POST('/api/v1/repositories/{repositoryId}/parity-setup', {
        params: { path: { repositoryId: id } },
        body: {},
      }),
    );
    setOutcome({ repo: full, setup, names: full });
    reload();
  });

  return (
    <Section title="Set up parity for a repository">
      <Stack>
        <Load result={result} what="repositories" reload={reload}>
          {(d) => {
            if (d.items.length === 0)
              return (
                <Empty title="No repository yet. Install the App on a repository first (Repositories)." />
              );
            const chosen = d.items.find((r) => String(r.id) === repo);
            return (
              <Stack>
                <Message tone="note">
                  crsp writes the access as the secret CRSP_ACCESS, and its address and
                  certificate fingerprint as the variables CRSP_URL and
                  CRSP_CA_FINGERPRINT, to the repository through the GitHub App. You copy
                  nothing. The parity workflow reads them.
                </Message>
                <AddressCheck load={address} />
                <ChoiceField
                  label="Repository"
                  value={repo}
                  onChange={(v) => {
                    setRepo(v);
                    setOutcome(undefined);
                  }}
                  choices={d.items.map((r) => ({
                    value: String(r.id),
                    label: r.full_name,
                  }))}
                />
                <Cluster>
                  <Button
                    kind="primary"
                    busy={run.busy}
                    busyLabel="Setting up"
                    disabled={!chosen || !session.can('admin') || needsAddress}
                    reason={
                      session.whyNot('admin') ??
                      (needsAddress
                        ? 'The controller has no address a runner can reach. Fix it first.'
                        : chosen
                          ? undefined
                          : 'Choose a repository first.')
                    }
                    onPress={() => {
                      if (chosen) void run.run(chosen.id, chosen.full_name);
                    }}
                  >
                    Set up parity for this repository
                  </Button>
                </Cluster>
              </Stack>
            );
          }}
        </Load>
        {run.error ? (
          <Message tone="problem">
            Could not set up parity. Nothing was left behind. {run.error}
          </Message>
        ) : null}
        {outcome?.setup.status === 'done' ? (
          <Message tone="done">
            Parity is set up for {outcome.repo}. The workflow can run now.
          </Message>
        ) : null}
        {outcome?.setup.status === 'needs_address' ? (
          <NeedsAddress
            problem={outcome.setup.address_problem}
            setting={outcome.setup.address_setting}
          />
        ) : null}
        {outcome?.setup.status === 'needs_permission' ? (
          <NeedsPermission repo={outcome.repo} setup={outcome.setup} />
        ) : null}
      </Stack>
    </Section>
  );
}

function NeedsPermission({ repo, setup }: { repo: string; setup: Setup }) {
  const missing = (setup.missing_permissions ?? []).map((p) => PERMISSION_WORDS[p] ?? p);
  const appUrl = httpsOnly(setup.app_permissions_url);
  const installUrl = httpsOnly(setup.installation_url);
  return (
    <Message tone="needs-you">
      <Stack>
        <span>
          The GitHub App cannot write to {repo} yet. It needs: {missing.join(', ')}.
          Nothing was made. Grant it on GitHub, then press the button again.
        </span>
        <Facts
          items={[
            {
              name: '1. Ask for it',
              value: 'On the App page, under Repository permissions, set the access.',
            },
            {
              name: '2. Accept it',
              value: 'On the installation page, press Accept new permissions.',
            },
          ]}
        />
        <Cluster>
          {appUrl ? (
            <ExternalButton href={appUrl}>Open the App permissions</ExternalButton>
          ) : null}
          {installUrl ? (
            <ExternalButton href={installUrl}>Open the installation</ExternalButton>
          ) : null}
        </Cluster>
      </Stack>
    </Message>
  );
}

function NeedsAddress({
  problem,
  setting,
}: {
  problem?: string | undefined;
  setting?: string | undefined;
}) {
  return (
    <Message tone="needs-you">
      <Stack>
        <span>
          Nothing was made. A runner on another machine or in a container cannot reach
          this controller yet. {problem ?? ''}
        </span>
        {setting ? <Facts items={[{ name: 'Setting to fix', value: setting }]} /> : null}
      </Stack>
    </Message>
  );
}

function AddressCheck({
  load,
}: {
  load: { result: Loaded<Address>; reload: () => void };
}) {
  return (
    <Load result={load.result} what="the address of the controller" reload={load.reload}>
      {(a) =>
        a.status === 'needs_address' ? (
          <NeedsAddress problem={a.problem} setting={a.setting} />
        ) : (
          <Stack>
            <Facts
              items={[{ name: 'Address written as CRSP_URL', value: a.url ?? '' }]}
            />
            {a.status === 'ok' ? (
              <Message tone="done">
                The controller answers at this address over https with its own
                certificate.
              </Message>
            ) : (
              <Message tone="problem">
                {a.problem ?? 'The controller did not answer at this address.'} A runner
                that cannot reach it cannot run the parity checks.
              </Message>
            )}
          </Stack>
        )
      }
    </Load>
  );
}
