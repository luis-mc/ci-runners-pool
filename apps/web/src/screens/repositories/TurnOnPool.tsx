// The "Turn on the pool" wizard (web-console 4.1 and 4.3, R5.18). Steps: Reading repositories, Repositories,
// Review, Turning on, Done. The plan is shown at Review, applied, and Done shows what was really done. The
// stored plan id is in the address (?plan=), so Done after a reload reads the outcome from the server.
import {
  BulletList,
  Breadcrumbs,
  Cluster,
  Button,
  LinkButton,
  Facts,
  Message,
  Page,
  PageHeader,
  Stack,
  Table,
  Text,
  Wizard,
  type Column,
  type WizardPhase,
} from '@crsp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TIMING } from '../../timing';
import { ApiError, errorText, unwrap, useClient } from '../../api/api';
import { useMounted } from '../../api/mounted';
import { useLiveState } from '../../live/LiveProvider';
import { InstallAppButton } from './InstallApp';
import {
  allRepositories,
  needsYes,
  planProgress,
  type Plan,
  type Repository,
} from './plans';

/** Why light runners appear when the pool is turned on (scheduling R5.65). */
export const LIGHT_RUNNER_WHY =
  'Turning the pool on also makes one light runner per system, on a machine that is up. Jobs that last seconds use it, so they do not wait behind a long build. Turn it off for a repository on its page.';
export const LIGHT_RUNNER_DONE =
  'The pool made light runners for short jobs. They show in Runners.';

const STEPS = [
  'Reading repositories',
  'Repositories',
  'Review',
  'Turning on',
  'Done',
] as const;

export function TurnOnPoolWizard({ onDone }: { onDone?: () => void }) {
  const client = useClient();
  const [params, setParams] = useSearchParams();
  const live = useLiveState();
  const storedPlan = useRef(params.get('plan')).current;
  const preselected = params.getAll('repo').map(Number);

  const [phase, setPhase] = useState<WizardPhase>('loading');
  const [step, setStep] = useState(1);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set(preselected));
  const [plan, setPlan] = useState<Plan | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | undefined>(undefined);
  const running = useRef(false);

  const settle = useCallback((p: Plan, afterReload: boolean) => {
    setPlan(p);
    setStopping(false);
    setStep(4);
    if (p.state === 'done') setPhase(afterReload ? 'done-after-reload' : 'done');
    else if (p.state === 'stopped') setPhase('stopped');
    else {
      setProblem(
        p.state === 'stale'
          ? 'The plan went out of date before it ended.'
          : (p.steps.find((s) => s.state === 'failed')?.error ?? 'A step failed.'),
      );
      setPhase('failed');
    }
  }, []);

  useEffect(() => {
    let on = true;
    void (async () => {
      try {
        const all = await allRepositories(client, { pool: 'off' });
        if (!on) return;
        setRepos(all.items);
        // One repository that can be turned on is already chosen (nothing else could be).
        const open = all.items.filter((r) => r.user_is_github_admin);
        if (preselected.length === 0 && open.length === 1 && !storedPlan)
          setPicked(new Set(open.map((r) => r.id)));
        if (storedPlan) {
          const p = await unwrap(
            client.GET('/api/v1/repository-plans/{planId}', {
              params: { path: { planId: storedPlan } },
            }),
          );
          if (!on) return;
          if (p.state === 'applying') {
            setPlan(p);
            setStep(3);
            setPhase('paused');
          } else settle(p, true);
          return;
        }
        setStep(1);
        setPhase('first-run');
      } catch (e) {
        if (!on) return;
        setProblem(e instanceof Error ? e.message : 'The controller did not answer.');
        setStep(4);
        setPhase('failed');
      }
    })();
    return () => {
      on = false;
    };
  }, [client, storedPlan, settle]);

  // Back from GitHub's install page: read the repositories again and keep what is ticked.
  const readAgain = useCallback(async () => {
    try {
      const all = await allRepositories(client, { pool: 'off' });
      setRepos(all.items);
      const open = all.items.filter((r) => r.user_is_github_admin);
      setPicked((p) => (p.size === 0 && open.length === 1 ? new Set([open[0]!.id]) : p));
    } catch {
      // The old list stays; the user can press the button again.
    }
  }, [client]);

  const eligible = repos.filter((r) => r.user_is_github_admin);
  const blocked = repos.filter((r) => !r.user_is_github_admin);
  const chosen = eligible.filter((r) => picked.has(r.id));

  const toReview = async () => {
    setStep(2);
    setPhase('planning');
    try {
      const p = await unwrap(
        client.POST('/api/v1/repository-plans', {
          body: {
            changes: chosen.map((r) => ({ repository_id: r.id, pool: 'on' as const })),
          },
        }),
      );
      setPlan(p);
      setPhase('ready-to-review');
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not plan the change.');
      setStep(4);
      setPhase('failed');
    }
  };

  const { mounted, sleep } = useMounted();
  const apply = async () => {
    if (!plan) return;
    setStep(3);
    setPhase('running');
    running.current = true;
    try {
      let p = await unwrap(
        client.POST('/api/v1/repository-plans/{planId}/apply', {
          params: { path: { planId: plan.id } },
          body: { approved_steps: needsYes(plan) },
        }),
      );
      const next = new URLSearchParams(params);
      next.delete('repo');
      next.set('plan', p.id);
      setParams(next, { replace: true });
      setPlan(p);
      while (p.state === 'applying' || p.state === 'planned') {
        if (!(await sleep(TIMING.planPollMs))) {
          running.current = false;
          return;
        }
        p = await unwrap(
          client.GET('/api/v1/repository-plans/{planId}', {
            params: { path: { planId: p.id } },
          }),
        );
        if (!mounted.current) {
          running.current = false;
          return;
        }
        setPlan(p);
      }
      running.current = false;
      settle(p, false);
      onDone?.();
    } catch (e) {
      running.current = false;
      setProblem(e instanceof Error ? e.message : 'Could not apply the plan.');
      setStep(4);
      setPhase('failed');
    }
  };

  // Stop (web-console 11, UX-30): the step that runs finishes, no later step starts, and the wizard ends
  // at Done saying what was done and what is left. The plan's own state tells when it has ended.
  const stop = async () => {
    if (!plan) return;
    setStopping(true);
    setStopError(undefined);
    try {
      await unwrap(
        client.POST('/api/v1/repository-plans/{planId}/stop', {
          params: { path: { planId: plan.id } },
        }),
      );
    } catch (e) {
      // 409: the plan has already ended; the next read shows how.
      if (!(e instanceof ApiError && e.status === 409)) {
        setStopError(errorText(e));
        setStopping(false);
      }
    }
  };

  const startAgain = () => {
    const next = new URLSearchParams();
    setParams(next, { replace: true });
    setPicked(new Set());
    setPlan(undefined);
    setProblem(undefined);
    setStep(1);
    setPhase('first-run');
  };

  // A live plan event keeps the work step current between polls (UX-19: one source of truth).
  const liveEvent = plan ? live.progress[`plan:${plan.id}`] : undefined;
  const shown = liveEvent?.plan ?? plan;
  const prog = shown ? planProgress(shown) : { done: 0, total: 0 };

  const cols: Column<Repository>[] = [
    {
      id: 'name',
      header: 'Repository',
      cell: (r) => r.full_name,
      sort: (r) => r.full_name,
    },
    { id: 'vis', header: 'Visibility', cell: (r) => r.visibility },
  ];

  let body;
  if (step <= 1) {
    body = (
      <Stack>
        <Text>Choose the repositories that should use the pool.</Text>
        {eligible.length === 0 ? (
          <Message
            tone="needs-you"
            action={
              <Cluster>
                <InstallAppButton
                  label="Install the App on a repository"
                  onReturn={() => void readAgain()}
                />
                <LinkButton to="/repositories">Open Repositories</LinkButton>
              </Cluster>
            }
          >
            {blocked.length > 0
              ? 'No repository is free for you to turn on. Install the App on a repository you own, or ask an owner of the others to turn them on.'
              : 'No repository is waiting. Install the App on a repository to turn the pool on for it, or open Repositories to see the ones that already use it.'}
          </Message>
        ) : (
          <>
            <Cluster>
              <Button onPress={() => setPicked(new Set(eligible.map((r) => r.id)))}>
                {`Select all ${eligible.length}`}
              </Button>
              <Button
                onPress={() => setPicked(new Set())}
                disabled={picked.size === 0}
                reason="Nothing is selected."
              >
                Clear
              </Button>
            </Cluster>
            <Table
              caption="Repositories to turn on"
              columns={cols}
              rows={eligible}
              rowKey={(r) => String(r.id)}
              selected={new Set([...picked].map(String))}
              onToggle={(k) =>
                setPicked((p) => {
                  const n = new Set(p);
                  const id = Number(k);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  return n;
                })
              }
              toggleLabel={(r) => `Select ${r.full_name}`}
            />
          </>
        )}
        {blocked.length > 0 ? (
          <Message tone="note">
            {blocked.length} {blocked.length === 1 ? 'repository is' : 'repositories are'}{' '}
            not listed: you need admin rights on {blocked.length === 1 ? 'it' : 'them'} in
            GitHub. Ask an owner to give you admin rights, then open this page again.
          </Message>
        ) : null}
      </Stack>
    );
  } else if (step === 2) {
    body = (
      <Stack>
        <Text>
          {chosen.length} {chosen.length === 1 ? 'repository' : 'repositories'} will use
          the pool. These steps run:
        </Text>
        <BulletList
          items={(plan?.steps ?? []).map(
            (s) => `${s.text}${s.needs_yes ? ' (needs your yes)' : ''}`,
          )}
        />
        <Message tone="note">{LIGHT_RUNNER_WHY}</Message>
      </Stack>
    );
  } else if (step === 3) {
    body = (
      <Stack>
        {phase === 'paused' ? (
          <Message tone="needs-you">
            Paused. The page closed while the plan ran. Start again to plan what is left.
          </Message>
        ) : null}
        {stopError ? <Message tone="problem">Could not stop. {stopError}</Message> : null}
        <Facts
          items={(shown?.steps ?? []).map((s) => ({
            name: s.text,
            value: s.state,
          }))}
        />
      </Stack>
    );
  } else {
    const done = plan?.steps.filter((s) => s.state === 'done') ?? [];
    const failed = plan?.steps.filter((s) => s.state === 'failed') ?? [];
    const left =
      plan?.steps.filter((s) => s.state !== 'done' && s.state !== 'failed') ?? [];
    body = (
      <Stack>
        {phase === 'failed' && !plan ? (
          <Message tone="problem">
            The pool was not turned on. {problem ?? ''} Try again.
          </Message>
        ) : null}
        {phase === 'stopped' ? (
          <Message tone="note">
            Stopped. {done.length} steps were done and {left.length} are left.
          </Message>
        ) : null}
        {phase === 'failed' && plan ? (
          <Message tone="problem">
            {failed.length} {failed.length === 1 ? 'step' : 'steps'} failed.{' '}
            {problem ?? ''} {done.length} done, {left.length} left. Try again to repeat
            the failed steps.
          </Message>
        ) : null}
        {phase === 'done' || phase === 'done-after-reload' ? (
          <Message tone="done">
            The pool is on. {done.length} {done.length === 1 ? 'step' : 'steps'} done.{' '}
            {LIGHT_RUNNER_DONE}
          </Message>
        ) : null}
        <Facts
          items={[
            ...done.map((s) => ({ name: s.text, value: 'done' })),
            ...failed.map((s) => ({
              name: s.text,
              value: `failed: ${s.error ?? 'no reason given'}`,
            })),
            ...left.map((s) => ({ name: s.text, value: 'left' })),
            ...(plan ? [] : [{ name: 'Repositories turned on', value: '0' }]),
          ]}
        />
      </Stack>
    );
  }

  const navigate = useNavigate();
  return (
    <Wizard
      name="Turn on the pool"
      steps={STEPS}
      current={phase === 'loading' ? 0 : step}
      firstStep={1}
      phase={phase}
      reading="Reading repositories"
      progress={
        phase === 'running'
          ? {
              text: `Turning on ${Math.min(prog.done + 1, Math.max(prog.total, 1))} of ${prog.total}${prog.current ? `: ${prog.current}` : ''}`,
              value: prog.done,
              max: Math.max(prog.total, 1),
            }
          : undefined
      }
      canStop={phase === 'running' && Boolean(plan)}
      stopping={stopping}
      onStop={() => void stop()}
      onBack={() => {
        const i = Math.max(1, step - 1);
        setStep(i);
        setPhase(i === 1 ? 'first-run' : 'ready-to-review');
      }}
      onStep={(i) => {
        if (i >= 1 && i <= 2) {
          setStep(i);
          setPhase(i === 1 ? 'first-run' : 'ready-to-review');
        }
      }}
      primary={
        step <= 1
          ? {
              label: 'Next',
              onPress: () => void toReview(),
              disabled: chosen.length === 0,
              reason: 'Tick the repositories to turn on.',
            }
          : {
              label: `Turn on ${chosen.length} ${chosen.length === 1 ? 'repository' : 'repositories'}`,
              busyLabel: 'Turning on',
              onPress: () => void apply(),
            }
      }
      review={step === 2}
      onStartAgain={startAgain}
      onTryAgain={startAgain}
      {...(onDone
        ? {}
        : {
            donePrimary: {
              label: 'Open Repositories',
              onPress: () => void navigate('/repositories'),
            },
          })}
    >
      {body}
    </Wizard>
  );
}

export function TurnOnPoolPage() {
  return (
    <Page>
      <Breadcrumbs
        trail={[
          { to: '/repositories', label: 'Repositories' },
          { label: 'Turn on the pool' },
        ]}
      />
      <PageHeader title="Turn on the pool" />
      <TurnOnPoolWizard />
    </Page>
  );
}
