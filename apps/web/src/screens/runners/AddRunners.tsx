// The "Add runners" wizard (web-console 4.5, R5.23, R5.19): Reading machines, Runners, Review, Registering,
// Done. Only machines whose system matches the chosen one can be picked; the others are greyed with the reason
// (UX-38). The stored plan id is in the address (?plan=).
import {
  Breadcrumbs,
  ChoiceField,
  Facts,
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
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { unwrap, useClient, type Schemas } from '../../api/api';
import {
  allRepositories,
  needsYes,
  planProgress,
  type Plan,
  type Repository,
} from '../repositories/plans';

const STEPS = ['Reading machines', 'Runners', 'Review', 'Registering', 'Done'] as const;
type OS = Schemas['OS'];

export function AddRunnersWizard() {
  const client = useClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const storedPlan = params.get('plan');

  const [phase, setPhase] = useState<WizardPhase>('loading');
  const [step, setStep] = useState(1);
  const [machines, setMachines] = useState<Schemas['Machine'][]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [os, setOs] = useState<OS>('linux');
  const [machineId, setMachineId] = useState('');
  const [count, setCount] = useState(1);
  const [labels, setLabels] = useState('self-hosted');
  const [scope, setScope] = useState<'repository' | 'organization'>('repository');
  const [repoId, setRepoId] = useState('');
  const [org, setOrg] = useState('');
  const [plan, setPlan] = useState<Plan | undefined>(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const settle = (p: Plan, afterReload: boolean) => {
    setPlan(p);
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
        const [m, r] = await Promise.all([
          unwrap(client.GET('/api/v1/machines')),
          allRepositories(client, { pool: 'on' }),
        ]);
        if (!on) return;
        setMachines(m.items);
        setRepos(r.items);
        const first = m.items.find((x) => x.os === 'linux') ?? m.items[0];
        if (first) {
          setOs(first.os);
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
  }, [client, storedPlan]);

  const supports = (m: Schemas['Machine']) => m.os === os;
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
            kind: 'persistent',
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
        await new Promise((r) => setTimeout(r, 1000));
        p = await unwrap(
          client.GET('/api/v1/runner-plans/{planId}', {
            params: { path: { planId: p.id } },
          }),
        );
        setPlan(p);
      }
      settle(p, false);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not register the runners.');
      setStep(4);
      setPhase('failed');
    }
  };

  const startAgain = () => {
    setParams(new URLSearchParams(), { replace: true });
    setPlan(undefined);
    setProblem(undefined);
    setStep(1);
    setPhase('first-run');
  };

  const prog = plan ? planProgress(plan) : { done: 0, total: 0 };

  let body;
  if (step <= 1) {
    body = (
      <Stack>
        {machines.length === 0 ? (
          <Message tone="needs-you">
            Add a machine first. Runners live on a machine.
          </Message>
        ) : null}
        <ChoiceField
          label="System"
          value={os}
          onChange={(v) => {
            setOs(v as OS);
            const m = machines.find((x) => x.os === v);
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
        <ChoiceField
          label="Scope"
          value={scope}
          onChange={(v) => setScope(v as 'repository' | 'organization')}
          choices={[
            { value: 'repository', label: 'One repository' },
            { value: 'organization', label: 'An organization' },
          ]}
        />
        {scope === 'repository' ? (
          <ChoiceField
            label="Repository"
            value={repoId}
            error={errors.repo}
            onChange={setRepoId}
            choices={repos.map((r) => ({ value: String(r.id), label: r.full_name }))}
          />
        ) : (
          <TextField
            label="Organization"
            value={org}
            error={errors.org}
            onChange={setOrg}
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
        <ul className="ds-list">
          {(plan?.steps ?? []).map((s) => (
            <li key={s.id}>{s.text}</li>
          ))}
        </ul>
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
    <Page frame="narrow">
      <Breadcrumbs
        trail={[{ to: '/runners', label: 'Runners' }, { label: 'Add runners' }]}
      />
      <PageHeader title="Add runners" />
      <AddRunnersWizard />
    </Page>
  );
}
