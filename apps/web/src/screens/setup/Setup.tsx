// Sign-in and first run: the setup page (web-console 4.1, R5.14..R5.19). Without a setup link it says how to
// get one. With one it shows the three first-run wizards in order; a later one is greyed until the one before
// it is done (UX-5).
import {
  Button,
  ChoiceField,
  ExternalButton,
  Facts,
  Loading,
  Failed,
  Message,
  Page,
  PageHeader,
  Section,
  Stack,
  Text,
  TextField,
  Wizard,
  postForm,
  type WizardPhase,
} from '@crsp/ui';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useLoad } from '../../api/hooks';
import { signInUrl, useSession } from '../../auth/session';
import { AddMachineWizard } from '../machines/AddMachine';
import { TurnOnPoolWizard } from '../repositories/TurnOnPool';

type SetupState = Schemas['SetupState'];

const CONNECT_STEPS = [
  'Reading the controller',
  'Account',
  'Review',
  'Creating the App',
  'Done',
] as const;

// The words for the error code GitHub's redirect brings back (content: Connect GitHub words).
const HALF_MADE =
  'GitHub made the App, but crsp could not save it. Open the App on GitHub and delete it (App settings, Advanced, Delete GitHub App). Then start again.';

export function messageFor(code: string, hasAppUrl: boolean): string {
  if (hasAppUrl) return HALF_MADE;
  switch (code) {
    case 'unavailable':
      return 'crsp could not save the App because the OS secret store is not available. See the doctor. Then start again.';
    case 'github_unavailable':
      return 'GitHub could not be reached. Nothing was changed. Try again.';
    case 'bad_request':
      return 'The link back from GitHub did not work. It ran out or was used already. Start again.';
    case 'conflict':
      return 'An App is already set up.';
    default:
      return 'The App was not created. Start again.';
  }
}

// Only a GitHub page is offered as a link; the controller checks it too.
function safeAppUrl(v: string | null): string | undefined {
  if (!v) return undefined;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.host === 'github.com' && !u.username
      ? u.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function ConnectGithubWizard({
  state,
  onDone,
}: {
  state?: SetupState | undefined;
  onDone: () => void;
}) {
  const client = useClient();
  const [params, setParams] = useSearchParams();
  const flow = params.get('app');
  const [phase, setPhase] = useState<WizardPhase>('loading');
  const [step, setStep] = useState(1);
  const [type, setType] = useState<'user' | 'organization'>('user');
  const [org, setOrg] = useState('');
  const [name, setName] = useState('crsp-home');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const seen = useRef(false);
  // The error the redirect from GitHub brought; read once, then cleared from the address.
  const [back] = useState(() => ({
    code: params.get('error'),
    appUrl: safeAppUrl(params.get('app_url')),
  }));

  useEffect(() => {
    if (seen.current || !state) return;
    seen.current = true;
    if (state.has_app) {
      setStep(4);
      if (flow === 'created') {
        setPhase('done');
        const next = new URLSearchParams(params);
        next.delete('app');
        setParams(next, { replace: true });
      } else setPhase('done-after-reload');
      return;
    }
    if (back.code) {
      setStep(4);
      setProblem(messageFor(back.code, back.appUrl !== undefined));
      setPhase('failed');
      const next = new URLSearchParams(params);
      next.delete('error');
      next.delete('app_url');
      next.delete('app');
      setParams(next, { replace: true });
    } else if (flow === 'started') {
      setStep(3);
      setPhase('paused');
    } else if (flow === 'cancelled') {
      setStep(4);
      setPhase('stopped');
    } else if (flow === 'failed') {
      setStep(4);
      setProblem('GitHub did not create the App.');
      setPhase('failed');
    } else {
      setStep(1);
      setPhase('first-run');
    }
  }, [state, flow, params, setParams, back]);

  const toReview = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Write a name for the App.';
    if (type === 'organization' && !org.trim()) e.org = 'Write the organization.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep(2);
    setPhase('planning');
    try {
      // Read the controller once more: an App that exists already must not be made twice.
      const now = await unwrap(client.GET('/api/v1/setup'));
      if (now.has_app) {
        setStep(4);
        setPhase('done-after-reload');
        return;
      }
      setPhase('ready-to-review');
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'The controller did not answer.');
      setStep(4);
      setPhase('failed');
    }
  };

  const create = async () => {
    setStep(3);
    setPhase('running');
    try {
      const form = await unwrap(
        client.POST('/api/v1/setup/github-app', {
          body: {
            account_type: type,
            ...(type === 'organization' ? { organization: org.trim() } : {}),
            app_name: name.trim(),
            console_urls: [window.location.origin],
          },
        }),
      );
      const next = new URLSearchParams(params);
      next.set('app', 'started');
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}?${next.toString()}`,
      );
      postForm(form.post_url, {
        manifest: JSON.stringify(form.manifest),
        state: form.state,
      });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not start.');
      setStep(4);
      setPhase('failed');
    }
  };

  const startAgain = () => {
    setParams(new URLSearchParams(), { replace: true });
    setProblem(undefined);
    setStep(1);
    setPhase('first-run');
  };

  const app = state?.app;
  let body;
  if (step <= 1)
    body = (
      <Stack>
        <ChoiceField
          label="Account"
          help="The GitHub account that owns the App."
          value={type}
          onChange={(v) => setType(v as 'user' | 'organization')}
          choices={[
            { value: 'user', label: 'My personal account' },
            { value: 'organization', label: 'An organization' },
          ]}
        />
        {type === 'organization' ? (
          <TextField
            label="Organization"
            value={org}
            error={errors.org}
            onChange={setOrg}
          />
        ) : null}
        <TextField
          label="App name"
          help="GitHub App names are unique across GitHub. If GitHub says the name is taken, delete the old App or choose another name."
          value={name}
          error={errors.name}
          onChange={setName}
        />
      </Stack>
    );
  else if (step === 2)
    body = (
      <Stack>
        <Facts
          items={[
            { name: 'App name', value: name },
            { name: 'Account', value: type === 'user' ? 'your personal account' : org },
          ]}
        />
        <Text tone="muted">
          GitHub shows the permissions the App asks for before it creates the App.
        </Text>
      </Stack>
    );
  else if (step === 3)
    body = (
      <Stack>
        {phase === 'paused' ? (
          <Message tone="needs-you">
            Paused. You left for GitHub and the App was not created. Start again to go
            back to GitHub.
          </Message>
        ) : (
          <Text>
            Off to GitHub with the App manifest. GitHub brings you back here with the
            App's keys.
          </Text>
        )}
      </Stack>
    );
  else
    body =
      phase === 'failed' ? (
        <Stack>
          <Message tone="problem">
            {back.code
              ? (problem ?? '')
              : `The App was not created. ${problem ?? ''} Try again.`}
          </Message>
          {back.appUrl ? (
            <ExternalButton href={back.appUrl}>Open the App on GitHub</ExternalButton>
          ) : null}
        </Stack>
      ) : phase === 'stopped' ? (
        <Message tone="note">
          Stopped. GitHub did not create the App. Start again to go back to GitHub.
        </Message>
      ) : (
        <Stack>
          <Message tone="done">The GitHub App is created.</Message>
          <Facts
            items={[
              { name: 'App', value: app?.slug ?? 'created' },
              { name: 'Account', value: app?.owner_login ?? 'not reported' },
              {
                name: 'Permissions',
                value: app?.permissions
                  ? Object.keys(app.permissions).join(', ') || 'none'
                  : 'as GitHub gave',
              },
            ]}
          />
        </Stack>
      );

  return (
    <Wizard
      name="Connect GitHub"
      steps={CONNECT_STEPS}
      current={phase === 'loading' ? 0 : step}
      firstStep={1}
      phase={phase}
      reading="Reading the controller"
      onBack={() => {
        setStep(1);
        setPhase('first-run');
      }}
      onStep={(i) => {
        if (i === 1) {
          setStep(1);
          setPhase('first-run');
        }
      }}
      primary={
        step <= 1
          ? { label: 'Next', onPress: () => void toReview() }
          : {
              label: 'Create the App',
              busyLabel: 'Creating the App',
              onPress: () => void create(),
            }
      }
      review={step === 2}
      onStartAgain={startAgain}
      onTryAgain={startAgain}
      donePrimary={{
        label: 'Sign in with GitHub',
        onPress: () => {
          onDone();
          window.location.assign(signInUrl('/setup'));
        },
      }}
    >
      {body}
    </Wizard>
  );
}

export function SetupPage() {
  const client = useClient();
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const code = params.get('code');
  const redeemed = useRef(false);
  const [redeemError, setRedeemError] = useState<string | undefined>(undefined);
  const { result, reload } = useLoad(async () => {
    if (code && !redeemed.current) {
      redeemed.current = true;
      try {
        const s = await unwrap(client.POST('/api/v1/setup/redeem', { body: { code } }));
        const next = new URLSearchParams(params);
        next.delete('code');
        setParams(next, { replace: true });
        return s;
      } catch (e) {
        setRedeemError(e instanceof Error ? e.message : 'The setup link did not work.');
      }
    }
    return unwrap(client.GET('/api/v1/setup'));
  }, [code]);

  return (
    <main>
      <Page frame="narrow">
        <PageHeader
          title="Set up the pool"
          lead="From a fresh controller to a first green job."
        />
        {redeemError ? (
          <Message tone="problem">
            The setup link did not work. {redeemError} Get a new link from the tray's Open
            or `crsp open`.
          </Message>
        ) : null}
        {result.state === 'loading' ? <Loading what="Reading the controller" /> : null}
        {result.state === 'failed' ? (
          <Failed
            what="Could not load the setup page."
            why={`${result.error.message} Try again.`}
            action={<Button onPress={reload}>Try again</Button>}
          />
        ) : null}
        {result.state === 'ready' ? (
          <Checklist
            state={result.data}
            signedIn={session.state.status === 'ready'}
            reload={reload}
          />
        ) : null}
      </Page>
    </main>
  );
}

function Checklist({
  state,
  signedIn,
  reload,
}: {
  state: SetupState;
  signedIn: boolean;
  reload: () => void;
}) {
  const [params] = useSearchParams();
  const link = state.setup_link_redeemed || params.has('code');
  if (!state.has_app && !link)
    return (
      <Section title="Get a setup link">
        <Text>
          This controller has no GitHub App yet. Open the setup page through a setup link:
          use Open in the tray, or run `crsp open` on the controller's machine.
        </Text>
      </Section>
    );
  const s = state.steps;
  const order = [
    { id: 'connect', title: 'Connect GitHub', done: s.connect_github === 'done' },
    { id: 'machine', title: 'Add the first machine', done: s.first_machine === 'done' },
    {
      id: 'repo',
      title: 'Turn on the first repository',
      done: s.first_repository === 'done',
    },
  ];
  const current = order.findIndex((o) => !o.done);
  return (
    <Stack>
      {order.map((o, i) => (
        <Section key={o.id} title={o.title}>
          {o.id === 'connect' && (i === current || (o.done && !signedIn)) ? (
            <ConnectGithubWizard state={state} onDone={reload} />
          ) : o.id === 'machine' && o.done && signedIn ? (
            <FirstMachineDone onDone={reload} />
          ) : o.done && i !== current ? (
            <Message tone="done">{o.title} is done.</Message>
          ) : i > current && current !== -1 ? (
            <Text tone="muted">
              This waits for {order[i - 1]?.title ?? 'the step before'}.
            </Text>
          ) : o.id === 'connect' ? (
            <ConnectGithubWizard state={state} onDone={reload} />
          ) : !signedIn ? (
            <Stack>
              <Text>Sign in with GitHub to go on.</Text>
              <Button
                kind="primary"
                onPress={() => window.location.assign(signInUrl('/setup'))}
              >
                Sign in with GitHub
              </Button>
            </Stack>
          ) : o.id === 'machine' ? (
            <AddMachineWizard onDone={reload} />
          ) : (
            <TurnOnPoolWizard onDone={reload} />
          )}
        </Section>
      ))}
    </Stack>
  );
}

/**
 * The first-machine step when a machine is in the pool. The controller runs its own agent, so on a
 * fresh install this PC is that machine (machines R5.1): it shows as done by name, and the command
 * path stays behind "Add another machine" for other computers.
 */
export function FirstMachineDone({ onDone }: { onDone: () => void }) {
  const client = useClient();
  const { result } = useLoad(() => unwrap(client.GET('/api/v1/machines')), []);
  const [adding, setAdding] = useState(false);
  const own =
    result.state === 'ready' ? result.data.items.find((m) => m.is_controller) : undefined;
  const host = own ? (own.facts?.host_name ?? own.name) : undefined;
  return (
    <Stack>
      <Message tone="done">
        {host ? `This PC, ${host}, is in the pool.` : 'Add the first machine is done.'}
      </Message>
      {adding ? (
        <AddMachineWizard onDone={onDone} />
      ) : (
        <Button onPress={() => setAdding(true)}>Add another machine</Button>
      )}
    </Stack>
  );
}
