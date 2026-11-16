// The "Add runners" wizard (web-console 4.5, R5.23, R5.19): Reading machines, Runners, Review, Registering,
// Done. Only machines whose system matches the chosen one can be picked; the others are greyed with the reason
// (UX-38). The stored plan id is in the address (?plan=).
import {
  BulletList,
  Breadcrumbs,
  ChoiceField,
  Facts,
  LinkButton,
  Message,
  NumberField,
  Page,
  PageHeader,
  Stack,
  Text,
  TextField,
  Wizard,
  type WizardPhase,
} from '@crsp/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TIMING } from '../../timing';
import { ApiError, errorText, unwrap, useClient, type Schemas } from '../../api/api';
import { useMounted } from '../../api/mounted';
import { InstallAppButton } from '../repositories/InstallApp';
import {
  allRepositories,
  needsYes,
  planProgress,
  type Plan,
  type Repository,
} from '../repositories/plans';

const STEPS = ['Reading machines', 'Runners', 'Review', 'Registering', 'Done'] as const;
type OS = Schemas['OS'];

/** A machine takes runners of its own system, and Linux runners too when its
 * container engine runs Linux containers (Docker Desktop on WSL2; runners R5.47). */
export function machineSupports(m: Schemas['Machine'], os: OS): boolean {
  return (
    m.os === os || (os === 'linux' && m.os === 'windows' && m.container_os === 'linux')
  );
}

/** The Linux runner of a Windows machine is a container runner, so it is ephemeral. */
export function runnerKind(
  m: Schemas['Machine'] | undefined,
  os: OS,
): 'persistent' | 'ephemeral' {
  return m && m.os !== os ? 'ephemeral' : 'persistent';
}

const RUNS_ON: Record<OS, string> = {
  linux: 'RUNS_ON_LINUX',
  windows: 'RUNS_ON_WINDOWS',
  macos: 'RUNS_ON_MACOS',
};

/**
 * The labels a repository's workflows ask for on this system: the RUNS_ON_* variable the pool wrote (it holds
 * the pool label too, such as crsp-home), else the labels of its policy, else the plain self-hosted label.
 */
export function defaultLabels(
  repo: Pick<Repository, 'variables' | 'policy'> | undefined,
  os: OS,
): string {
  const v = repo?.variables.find((x) => x.name === RUNS_ON[os] && x.value);
  if (v?.value) {
    try {
      const list: unknown = JSON.parse(v.value);
      if (Array.isArray(list)) {
        const labels = list.filter((x): x is string => typeof x === 'string');
        if (labels.length > 0) return labels.join(', ');
      }
    } catch {
      // A value that is not a list falls through to the policy.
    }
  }
  const policy = repo?.policy.labels ?? [];
  return policy.length > 0 ? policy.join(', ') : 'self-hosted';
}

export function AddRunnersWizard() {
  const client = useClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const storedPlan = useRef(params.get('plan')).current;

  const [phase, setPhase] = useState<WizardPhase>('loading');
  const [step, setStep] = useState(1);
  const [machines, setMachines] = useState<Schemas['Machine'][]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [os, setOs] = useState<OS>('linux');
  const [machineId, setMachineId] = useState('');
  const [count, setCount] = useState(1);
  const [labels, setLabelsText] = useState('self-hosted');
  // Labels follow the repository's own variables until the user writes their own (finding 12).
  const [labelsEdited, setLabelsEdited] = useState(false);
  const setLabels = (v: string) => {
    setLabelsEdited(true);
    setLabelsText(v);
  };
  const [orgs, setOrgs] = useState<string[]>([]);
  const [again, setAgain] = useState(0);
  const [scope, setScope] = useState<'repository' | 'organization'>('repository');
  const [repoId, setRepoId] = useState('');
  const [org, setOrg] = useState('');
  const [plan, setPlan] = useState<Plan | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const settle = (p: Plan, afterReload: boolean) => {
    setPlan(p);
    setStopping(false);
    setStep(4);
    if (p.state === 'done') setPhase(afterReload ? 'done-after-reload' : 'done');
    else if (p.state === 'stopped') setPhase('stopped');
    else {
      setProblem(p.steps.find((s) => s.state === 'failed')?.error ?? 'A step failed.');
      setPhase('failed');
    }
  };

  useEffect(() => {
    let on = true;
    void (async () => {
      try {
        const [m, r, ins] = await Promise.all([
          unwrap(client.GET('/api/v1/machines')),
          allRepositories(client, { pool: 'on' }),
          unwrap(client.GET('/api/v1/github/installations')).catch(() => ({ items: [] })),
        ]);
        if (!on) return;
        setMachines(m.items);
        setRepos(r.items);
        // Only an organization the App is installed on can own organization runners (finding 10).
        setOrgs(
          ins.items
            .filter((i) => i.account_type === 'Organization' && !i.suspended)
            .map((i) => i.account_login),
        );
        // One repository is the only choice: it is chosen (finding 11).
        if (r.items.length === 1) setRepoId(String(r.items[0]!.id));
        const first = m.items.find((x) => machineSupports(x, 'linux')) ?? m.items[0];
        if (first) {
          setOs(machineSupports(first, 'linux') ? 'linux' : first.os);
          setMachineId(first.id);
        }
        if (storedPlan) {
          const p = await unwrap(
            client.GET('/api/v1/runner-plans/{planId}', {
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
  }, [client, storedPlan, again]);

  const labelsRepo =
    scope === 'repository'
      ? repos.find((r) => String(r.id) === repoId)
      : repos.find((r) => r.owner === org && r.variables.length > 0);
  const wanted = defaultLabels(labelsRepo, os);
  useEffect(() => {
    if (!labelsEdited) setLabelsText(wanted);
  }, [wanted, labelsEdited]);
  const supports = (m: Schemas['Machine']) => machineSupports(m, os);
  const labelList = labels
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const toReview = async () => {
    const e: Record<string, string> = {};
    if (!machineId || !machines.some((m) => m.id === machineId && supports(m)))
      e.machine = 'Pick a machine that runs this system.';
    if (count < 1) e.count = 'Add at least 1 runner.';
    if (scope === 'organization' && !org.trim()) e.org = 'Write the organization.';
    if (scope === 'repository' && !repoId) e.repo = 'Pick a repository.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep(2);
    setPhase('planning');
    try {
      const p = await unwrap(
        client.POST('/api/v1/runner-plans', {
          body: {
            os,
            kind: runnerKind(
              machines.find((m) => m.id === machineId),
              os,
            ),
            machine_id: machineId,
            count,
            labels: labelList,
            scope:
              scope === 'organization'
                ? { kind: 'organization', organization: org.trim() }
                : { kind: 'repository', repository_id: Number(repoId) },
          },
        }),
      );
      setPlan(p);
      setPhase('ready-to-review');
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not plan the runners.');
      setStep(4);
      setPhase('failed');
    }
  };

  const { mounted, sleep } = useMounted();
  const apply = async () => {
    if (!plan) return;
    setStep(3);
    setPhase('running');
    try {
      let p = await unwrap(
        client.POST('/api/v1/runner-plans/{planId}/apply', {
          params: { path: { planId: plan.id } },
          body: { approved_steps: needsYes(plan) },
        }),
      );
      const next = new URLSearchParams(params);
      next.set('plan', p.id);
      setParams(next, { replace: true });
      setPlan(p);
      while (p.state === 'applying' || p.state === 'planned') {
        if (!(await sleep(TIMING.planPollMs))) {
          return;
        }
        p = await unwrap(
          client.GET('/api/v1/runner-plans/{planId}', {
            params: { path: { planId: p.id } },
          }),
        );
        if (!mounted.current) {
          return;
        }
        setPlan(p);
      }
      settle(p, false);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not register the runners.');
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
        client.POST('/api/v1/runner-plans/{planId}/stop', {
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
    setParams(new URLSearchParams(), { replace: true });
    setPlan(undefined);
    setProblem(undefined);
    setStep(1);
    setPhase('first-run');
  };

  const picked = machines.find((m) => m.id === machineId);
  const containerRunner =
    picked !== undefined && picked.os !== os && machineSupports(picked, os);

  const prog = plan ? planProgress(plan) : { done: 0, total: 0 };

  let body;
  if (step <= 1) {
    body = (
      <Stack>
        {machines.length === 0 ? (
          <Message
            tone="needs-you"
            action={<LinkButton to="/machines/add">Add a machine</LinkButton>}
          >
            Add a machine first. Runners live on a machine.
          </Message>
        ) : null}
        <ChoiceField
          label="System"
          value={os}
          onChange={(v) => {
            setOs(v as OS);
            const m = machines.find((x) => machineSupports(x, v as OS));
            setMachineId(m?.id ?? '');
          }}
          choices={[
            { value: 'linux', label: 'Linux' },
            { value: 'windows', label: 'Windows' },
            { value: 'macos', label: 'macOS' },
          ]}
        />
        <ChoiceField
          label="Machine"
          value={machineId}
          error={errors.machine}
          onChange={setMachineId}
          choices={machines.map((m) => ({
            value: m.id,
            label: m.name,
            ...(supports(m)
              ? {}
              : { disabledReason: `This machine runs ${m.os}, not ${os}.` }),
          }))}
        />
        {containerRunner ? (
          <Message tone="note">
            Linux runners on this Windows machine run in containers, through Docker. The
            container backend must be allowed on the machine.
          </Message>
        ) : null}
        <NumberField
          label="Number of runners"
          value={count}
          min={1}
          max={32}
          onChange={setCount}
          {...(errors.count ? { error: errors.count } : {})}
        />
        <TextField
          label="Labels"
          help="Separate labels with commas."
          value={labels}
          onChange={setLabels}
          width="full"
        />
        {orgs.length > 0 ? (
          <ChoiceField
            label="Scope"
            value={scope}
            onChange={(v) => {
              setScope(v as 'repository' | 'organization');
              if (v === 'organization' && !org) setOrg(orgs[0] ?? '');
            }}
            choices={[
              { value: 'repository', label: 'One repository' },
              { value: 'organization', label: 'An organization' },
            ]}
          />
        ) : (
          <Message
            tone="note"
            action={
              <InstallAppButton
                label="Install the App on an organization"
                onReturn={() => setAgain((n) => n + 1)}
              />
            }
          >
            Runners are added to one repository. An organization appears here when the App
            is installed on one.
          </Message>
        )}
        {scope === 'repository' || orgs.length === 0 ? (
          <ChoiceField
            label="Repository"
            help={
              repos.length === 0
                ? 'No repository uses the pool yet. Turn the pool on first.'
                : undefined
            }
            value={repoId}
            error={errors.repo}
            onChange={setRepoId}
            choices={repos.map((r) => ({ value: String(r.id), label: r.full_name }))}
          />
        ) : (
          <ChoiceField
            label="Organization"
            value={org}
            error={errors.org}
            onChange={setOrg}
            choices={orgs.map((o) => ({ value: o, label: o }))}
          />
        )}
      </Stack>
    );
  } else if (step === 2) {
    body = (
      <Stack>
        <Text>
          {count} {count === 1 ? 'runner' : 'runners'} on{' '}
          {machines.find((m) => m.id === machineId)?.name ?? 'the machine'}. These steps
          run:
        </Text>
        <BulletList items={(plan?.steps ?? []).map((s) => s.text)} />
      </Stack>
    );
  } else if (step === 3) {
    body = (
      <Stack>
        {phase === 'paused' ? (
          <Message tone="needs-you">
            Paused. The page closed while runners were registering. Start again to plan
            what is left.
          </Message>
        ) : null}
        {stopError ? <Message tone="problem">Could not stop. {stopError}</Message> : null}
        <Facts
          items={(plan?.steps ?? []).map((s) => ({ name: s.text, value: s.state }))}
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
        {phase === 'failed' ? (
          <Message tone="problem">
            The runners were not all added. {problem ?? ''} Try again.
          </Message>
        ) : null}
        {phase === 'stopped' ? (
          <Message tone="note">
            Stopped. {done.length} steps were done and {left.length} are left.
          </Message>
        ) : null}
        {phase === 'done' || phase === 'done-after-reload' ? (
          <Message tone="done">
            {done.length} {done.length === 1 ? 'step' : 'steps'} done. The runners are
            added.
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
            ...(plan ? [] : [{ name: 'Runners added', value: '0' }]),
          ]}
        />
      </Stack>
    );
  }

  return (
    <Wizard
      name="Add runners"
      steps={STEPS}
      current={phase === 'loading' ? 0 : step}
      firstStep={1}
      phase={phase}
      reading="Reading machines"
      progress={
        phase === 'running'
          ? {
              text: `Registering ${Math.min(prog.done + 1, Math.max(prog.total, 1))} of ${prog.total}${prog.current ? `: ${prog.current}` : ''}`,
              value: prog.done,
              max: Math.max(prog.total, 1),
            }
          : undefined
      }
      canStop={phase === 'running' && Boolean(plan)}
      stopping={stopping}
      onStop={() => void stop()}
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
          ? {
              label: 'Next',
              onPress: () => void toReview(),
              disabled: machines.length === 0,
              reason: 'Add a machine first.',
            }
          : {
              label: `Add ${count} ${count === 1 ? 'runner' : 'runners'}`,
              busyLabel: 'Registering',
              onPress: () => void apply(),
            }
      }
      review={step === 2}
      onStartAgain={startAgain}
      onTryAgain={startAgain}
      donePrimary={{ label: 'Open Runners', onPress: () => void navigate('/runners') }}
    >
      {body}
    </Wizard>
  );
}

export function AddRunnersPage() {
  return (
    <Page>
      <Breadcrumbs
        trail={[{ to: '/runners', label: 'Runners' }, { label: 'Add runners' }]}
      />
      <PageHeader title="Add runners" />
      <AddRunnersWizard />
    </Page>
  );
}
