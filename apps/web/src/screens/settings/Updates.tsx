// Settings, Updates (operations R5.11 to R5.18, tray R5.15 to R5.18): the version, the newest stable release,
// the Automatic updates switch (saved at once, UX-22), and the Review step that asks the yes before an update
// or a restart. Nothing here stops a running job: the machine drains first.
import {
  Breadcrumbs,
  BulletList,
  Button,
  Cluster,
  Facts,
  Message,
  Page,
  PageHeader,
  Section,
  Stack,
  Switch,
  Text,
  Wizard,
  formatDateTime,
  type WizardPhase,
} from '@crsp/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useCommand, useLoad } from '../../api/hooks';
import { useSession } from '../../auth/session';
import { TIMING } from '../../timing';
import { Load } from '../common';
import { settingsPath } from './sections';

type UpdateStatus = Schemas['UpdateStatus'];
type UpdateJob = Schemas['UpdateJob'];

const IN_PROGRESS: readonly UpdateStatus['state'][] = [
  'waiting_for_jobs',
  'downloading',
  'installing',
  'restarting',
];

export function jobLine(j: UpdateJob): string {
  return `${j.repository}${j.workflow ? ` ${j.workflow}` : ''}, run ${j.run_id}, job ${j.job}`;
}

// The idle state is two real cases; say the one that is true (a newer release waits, or nothing is newer).
function idleWord(s: UpdateStatus): string {
  if (s.update_available)
    return `Version ${s.latest_version ?? ''} is waiting for your yes`.replace('  ', ' ');
  return s.latest_version ? 'Up to date' : 'Not looked for yet';
}

const STATE_WORDS: Record<Exclude<UpdateStatus['state'], 'idle'>, string> = {
  checking: 'Looking for updates',
  waiting_for_jobs: 'Waiting for running jobs to end',
  downloading: 'Downloading and checking the release',
  installing: 'Installing',
  restarting: 'Restarting the service',
  failed: 'Failed',
};

function stateWord(s: UpdateStatus): string {
  return s.state === 'idle' ? idleWord(s) : STATE_WORDS[s.state];
}

export function UpdatesSettings() {
  const client = useClient();
  const session = useSession();
  const navigate = useNavigate();
  const { result, reload } = useLoad(() => unwrap(client.GET('/api/v1/update')), []);
  const toggle = useCommand(async (on: boolean) => {
    await unwrap(client.PATCH('/api/v1/settings', { body: { auto_update: on } }));
    reload();
  });
  const look = useCommand(async () => {
    await unwrap(client.POST('/api/v1/update/check'));
    reload();
  });
  return (
    <Section title="Updates">
      <Load result={result} what="the update status" reload={reload}>
        {(u) => (
          <Stack>
            <Facts
              items={[
                { name: 'Version', value: u.current_version },
                {
                  name: 'Newest stable release',
                  value: u.latest_version ?? 'Not looked for yet',
                },
                { name: 'State', value: stateWord(u) },
                ...(u.checked_at
                  ? [{ name: 'Last look', value: formatDateTime(u.checked_at) }]
                  : []),
              ]}
            />
            <Switch
              label="Automatic updates"
              on={u.auto_update}
              busy={toggle.busy}
              disabledReason={session.whyNot('owner')}
              onChange={(on) => void toggle.run(on)}
            />
            <Text>
              {u.auto_update
                ? 'On: the regular check installs a newer stable release by itself once the running jobs have ended. Looking for updates yourself only looks.'
                : 'Off: a newer stable release waits for your yes on the Review step.'}
            </Text>
            {u.state === 'failed' && u.error ? (
              <Message tone="problem">{u.error}</Message>
            ) : null}
            {toggle.error ? (
              <Message tone="problem">
                Could not save Automatic updates. {toggle.error}
              </Message>
            ) : null}
            {look.error ? (
              <Message tone="problem">Could not look for updates. {look.error}</Message>
            ) : null}
            <Cluster>
              <Button
                onPress={() => void look.run()}
                busy={look.busy}
                busyLabel="Looking"
                disabled={!session.can('admin')}
                reason={session.whyNot('admin')}
              >
                Look for updates
              </Button>
              {u.update_available ? (
                <Button
                  onPress={() => void navigate('/settings/updates/review?kind=update')}
                  disabled={!session.can('admin')}
                  reason={session.whyNot('admin')}
                >
                  {`Update to ${u.latest_version ?? ''}`}
                </Button>
              ) : null}
              <Button
                onPress={() => void navigate('/settings/updates/review?kind=restart')}
                disabled={!session.can('admin')}
                reason={session.whyNot('admin')}
              >
                Restart the service
              </Button>
            </Cluster>
          </Stack>
        )}
      </Load>
    </Section>
  );
}

// ------------------------------------------------------------------------------------------ the Review step

type Kind = 'update' | 'restart';

/** The Review step of an update or a restart: reads, Review, the work (drain, install), Done. */
export function UpdateWizard() {
  const client = useClient();
  const [params, setParams] = useSearchParams();
  const kind: Kind = params.get('kind') === 'restart' ? 'restart' : 'update';
  // Set once the yes is given, so a reload can tell a stored run from a fresh page.
  const startedTo = useRef(params.get('to')).current;
  const wasStarted = useRef(params.get('started') === '1').current;
  const navigate = useNavigate();

  const [phase, setPhase] = useState<WizardPhase>('loading');
  const [status, setStatus] = useState<UpdateStatus | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [lostService, setLostService] = useState(false);
  const polling = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const working = kind === 'update' ? 'Updating' : 'Restarting';
  const STEPS = ['Reading the service', 'Review', working, 'Done'] as const;

  const settle = (u: UpdateStatus, afterReload: boolean) => {
    setStatus(u);
    if (IN_PROGRESS.includes(u.state)) {
      setPhase(afterReload ? 'paused' : 'running');
    } else if (u.state === 'failed') {
      setProblem(u.error ?? 'The service did not say why.');
      setPhase('failed');
    } else if (wasStarted) {
      if (kind === 'update' && startedTo && u.current_version !== startedTo) {
        setProblem(`The service still runs ${u.current_version}, not ${startedTo}.`);
        setPhase('failed');
      } else setPhase(afterReload ? 'done-after-reload' : 'done');
    } else if (kind === 'update' && !u.update_available) {
      setPhase(u.latest_version ? 'stopped' : 'first-run');
    } else setPhase('ready-to-review');
  };

  useEffect(() => {
    let on = true;
    unwrap(client.GET('/api/v1/update'))
      .then((u) => on && settle(u, true))
      .catch((e: unknown) => {
        if (!on) return;
        setProblem(e instanceof Error ? e.message : 'The service did not answer.');
        setPhase('failed');
      });
    return () => {
      on = false;
    };
    // The stored run is read once, when the page opens.
  }, [client]);

  const follow = async (target: string | undefined) => {
    if (polling.current) return;
    polling.current = true;
    setPhase('running');
    let lost = false;
    while (mounted.current) {
      await new Promise((r) => setTimeout(r, TIMING.planPollMs));
      if (!mounted.current) break;
      try {
        const u = await unwrap(client.GET('/api/v1/update'));
        setStatus(u);
        if (u.state === 'failed') {
          setProblem(u.error ?? 'The service did not say why.');
          setPhase('failed');
          break;
        }
        const finished =
          !IN_PROGRESS.includes(u.state) &&
          (kind === 'update' ? u.current_version === target : lost || u.state === 'idle');
        if (finished) {
          setLostService(false);
          setPhase('done');
          break;
        }
        lost = false;
        setLostService(false);
      } catch {
        // The service stops to install and comes back: keep following.
        lost = true;
        setLostService(true);
      }
    }
    polling.current = false;
  };

  const start = async () => {
    setPhase('running');
    try {
      const u = await unwrap(
        kind === 'update'
          ? client.POST('/api/v1/update/apply', {
              params: { query: { confirmed: true } },
            })
          : client.POST('/api/v1/service/restart', {
              params: { query: { confirmed: true } },
            }),
      );
      setStatus(u);
      const next = new URLSearchParams(params);
      next.set('started', '1');
      if (kind === 'update' && u.latest_version) next.set('to', u.latest_version);
      setParams(next, { replace: true });
      void follow(u.latest_version);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not start.');
      setPhase('failed');
    }
  };

  const startAgain = () => {
    setParams(new URLSearchParams({ kind }), { replace: true });
    setProblem(undefined);
    setPhase('loading');
    unwrap(client.GET('/api/v1/update'))
      .then((u) => {
        setStatus(u);
        if (IN_PROGRESS.includes(u.state)) void follow(u.latest_version);
        else
          setPhase(
            kind === 'update' && !u.update_available ? 'stopped' : 'ready-to-review',
          );
      })
      .catch((e: unknown) => {
        setProblem(e instanceof Error ? e.message : 'The service did not answer.');
        setPhase('failed');
      });
  };

  const jobs = status?.running_jobs ?? [];
  const minutes = status?.drain_timeout_minutes;
  const target = status?.latest_version ?? '';
  const step =
    phase === 'loading'
      ? 0
      : phase === 'running' || phase === 'paused' || phase === 'failed'
        ? 2
        : phase === 'done' || phase === 'done-after-reload'
          ? 3
          : 1;

  let body;
  if (phase === 'first-run') {
    body = (
      <Message tone="needs-you">
        The service has not looked for a release yet. Look for updates to go on.
      </Message>
    );
  } else if (phase === 'planning') {
    body = <Message tone="note">Looking for a newer stable release.</Message>;
  } else if (phase === 'stopped') {
    body = (
      <Message tone="note">
        Stopped. Nothing changed: {status?.current_version} is the newest stable release.
      </Message>
    );
  } else if (phase === 'ready-to-review') {
    body = (
      <Stack>
        <Text>
          {kind === 'update'
            ? `Update ${status?.current_version} to ${target}. This machine takes no new jobs, waits for the running jobs to end${minutes ? ` (up to ${minutes} minutes)` : ''}, then installs and restarts the service. No running job is stopped.`
            : `Restart the service. This machine takes no new jobs, waits for the running jobs to end${minutes ? ` (up to ${minutes} minutes)` : ''}, then restarts. No running job is stopped.`}
        </Text>
        {jobs.length > 0 ? (
          <Stack>
            <Text>These jobs run now and are waited for:</Text>
            <BulletList items={jobs.map(jobLine)} />
          </Stack>
        ) : (
          <Message tone="note">No job runs on this machine now.</Message>
        )}
      </Stack>
    );
  } else if (phase === 'running' || phase === 'paused') {
    body = (
      <Stack>
        {phase === 'paused' ? (
          <Message tone="needs-you">
            Paused. The page closed while the service{' '}
            {kind === 'update' ? 'updated' : 'restarted'}. It goes on without this page.
            Start again to follow it.
          </Message>
        ) : null}
        {lostService ? (
          <Message tone="note">
            The service is restarting. This page waits for it.
          </Message>
        ) : null}
        <Facts
          items={[
            { name: 'State', value: status ? stateWord(status) : 'Starting' },
            { name: 'Jobs still running', value: String(jobs.length) },
            ...jobs.map((j) => ({ name: jobLine(j), value: 'running' })),
          ]}
        />
      </Stack>
    );
  } else if (phase === 'failed') {
    body = (
      <Message tone="problem">
        {kind === 'update' ? 'The update did not finish.' : 'The restart did not finish.'}{' '}
        {problem ?? ''} The running version stays. Try again.
      </Message>
    );
  } else if (phase === 'done' || phase === 'done-after-reload') {
    body = (
      <Stack>
        <Message tone="done">
          {kind === 'update'
            ? `The service runs ${status?.current_version}.`
            : 'The service restarted.'}
        </Message>
        <Facts
          items={[
            { name: 'Version', value: status?.current_version ?? '' },
            { name: 'Jobs stopped', value: '0' },
          ]}
        />
      </Stack>
    );
  } else {
    body = null;
  }

  const primary =
    phase === 'first-run'
      ? {
          label: 'Look for updates',
          busyLabel: 'Looking',
          onPress: () => {
            setPhase('planning');
            unwrap(client.POST('/api/v1/update/check'))
              .then((u) => settle(u, false))
              .catch((e: unknown) => {
                setProblem(e instanceof Error ? e.message : 'Could not look.');
                setPhase('failed');
              });
          },
        }
      : {
          label: kind === 'update' ? `Update to ${target}` : 'Restart the service',
          busyLabel: working,
          onPress: () => void start(),
        };

  return (
    <Wizard
      name={kind === 'update' ? 'Update' : 'Restart the service'}
      steps={STEPS}
      current={step}
      firstStep={1}
      phase={phase}
      reading="Reading the service"
      progress={
        phase === 'running'
          ? {
              text: status
                ? `${stateWord(status)}${jobs.length ? `: ${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} left` : ''}`
                : 'Starting',
            }
          : undefined
      }
      onBack={() => void navigate(settingsPath('updates'))}
      primary={primary}
      review={phase === 'ready-to-review'}
      onStartAgain={startAgain}
      onTryAgain={startAgain}
      donePrimary={{
        label: 'Open Updates',
        onPress: () => void navigate(settingsPath('updates')),
      }}
    >
      {body}
    </Wizard>
  );
}

export function UpdateReviewPage() {
  const [params] = useSearchParams();
  const restart = params.get('kind') === 'restart';
  return (
    <Page>
      <Breadcrumbs
        trail={[{ to: settingsPath('updates'), label: 'Updates' }, { label: 'Review' }]}
      />
      <PageHeader title={restart ? 'Restart the service' : 'Update'} />
      <UpdateWizard />
    </Page>
  );
}
