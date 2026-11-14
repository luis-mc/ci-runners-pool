// The "Add a machine" wizard (web-console 4.1 and 4.4, R5.17). Steps: Machine, Review, Joining, Done.
// Its behaviour comes from the shared wizard (UX-54); this page passes data only. The phase is read from the
// server: a stored join code that is still waiting with no live wait here reads Paused (UX-30).
import {
  Breadcrumbs,
  CodeBlock,
  Page,
  PageHeader,
  Facts,
  Message,
  ChoiceField,
  formatTimeLeft,
  formatNumber,
  formatSize,
  Text,
  Stack,
  Wizard,
  useNow,
  type WizardPhase,
} from '@crsp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { unwrap, useClient, type Schemas } from '../../api/api';

type JoinCode = Schemas['JoinCode'];
type Machine = Schemas['Machine'];
type OS = Schemas['OS'];

const STEPS = ['Machine', 'Review', 'Joining', 'Done'] as const;
const TTL_MINUTES = 15;

interface Props {
  /** The next action on Done, when the page has one (the first-run checklist goes on). */
  onDone?: (machine: Machine | undefined) => void;
}

export function AddMachineWizard({ onDone }: Props) {
  const client = useClient();
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const storedJoin = params.get('join');

  const [phase, setPhase] = useState<WizardPhase>('loading');
  const [step, setStep] = useState(0);
  const [os, setOs] = useState<OS>('linux');
  const [command, setCommand] = useState<string | undefined>(undefined);
  const [created, setCreated] = useState<
    { code: string; join: JoinCode; command: string } | undefined
  >(undefined);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [machine, setMachine] = useState<Machine | undefined>(undefined);
  const [stopping, setStopping] = useState(false);
  const known = useRef<Set<string>>(new Set());
  const live = useRef(false);

  const finish = useCallback(
    async (join: JoinCode, afterReload: boolean) => {
      if (join.machine_id) {
        try {
          setMachine(
            await unwrap(
              client.GET('/api/v1/machines/{machineId}', {
                params: { path: { machineId: join.machine_id } },
              }),
            ),
          );
        } catch {
          setMachine(undefined);
        }
      }
      setStep(3);
      setPhase(afterReload ? 'done-after-reload' : 'done');
    },
    [client],
  );

  // Reading the controller: the machines that exist now, and the join code a reload left behind.
  useEffect(() => {
    let on = true;
    void (async () => {
      try {
        const list = await unwrap(client.GET('/api/v1/machines'));
        if (!on) return;
        known.current = new Set(list.items.map((m) => m.id));
        if (storedJoin) {
          const join = await unwrap(
            client.GET('/api/v1/join-codes/{joinCodeId}', {
              params: { path: { joinCodeId: storedJoin } },
            }),
          );
          if (!on) return;
          if (join.state === 'joined') await finish(join, true);
          else if (join.state === 'waiting') {
            setStep(2);
            setPhase('paused');
          } else if (join.state === 'revoked') {
            setStep(3);
            setPhase('stopped');
          } else {
            setStep(3);
            setProblem('The join code ran out before the agent joined.');
            setPhase('failed');
          }
          return;
        }
        setPhase('first-run');
      } catch (e) {
        if (!on) return;
        setProblem(e instanceof Error ? e.message : 'The controller did not answer.');
        setPhase('failed');
      }
    })();
    return () => {
      on = false;
    };
  }, [client, storedJoin, finish]);

  // Planning: the install command for the chosen system.
  const toReview = async () => {
    setStep(1);
    setPhase('planning');
    try {
      const cmds = await unwrap(client.GET('/api/v1/install-command'));
      setCommand(cmds.items.find((c) => c.os === os)?.command ?? '');
      setPhase('ready-to-review');
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'The controller did not answer.');
      setPhase('failed');
    }
  };

  // Joining: make the one-time code, then wait for the agent. The code never goes in a URL (R6.4).
  const startJoining = async () => {
    setStep(2);
    setPhase('running');
    live.current = true;
    try {
      const made = await unwrap(
        client.POST('/api/v1/join-codes', { body: { ttl_minutes: TTL_MINUTES } }),
      );
      const forOs =
        made.commands.items.find((c) => c.os === os)?.command ?? command ?? '';
      setCreated({ code: made.code, join: made.join_code, command: forOs });
      const next = new URLSearchParams(params);
      next.set('join', made.join_code.id);
      setParams(next, { replace: true });
    } catch (e) {
      live.current = false;
      setProblem(e instanceof Error ? e.message : 'Could not make a join code.');
      setStep(3);
      setPhase('failed');
    }
  };

  useEffect(() => {
    if (phase !== 'running' || !created) return;
    const id = created.join.id;
    const timer = setInterval(() => {
      void unwrap(
        client.GET('/api/v1/join-codes/{joinCodeId}', {
          params: { path: { joinCodeId: id } },
        }),
      )
        .then(async (join) => {
          if (!live.current) return;
          if (join.state === 'joined') {
            live.current = false;
            await finish(join, false);
            if (onDone) onDone(undefined);
          } else if (join.state === 'expired') {
            live.current = false;
            setProblem('The join code ran out before the agent joined.');
            setStep(3);
            setPhase('failed');
          } else if (join.state === 'revoked') {
            live.current = false;
            setStep(3);
            setPhase('stopped');
          }
        })
        .catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [phase, created, client, finish, onDone]);

  const stop = async () => {
    if (!created) return;
    setStopping(true);
    live.current = false;
    try {
      await unwrap(
        client.DELETE('/api/v1/join-codes/{joinCodeId}', {
          params: { path: { joinCodeId: created.join.id } },
        }),
      );
    } catch {
      // The code may already be gone; the wizard still ends at Done.
    }
    setStopping(false);
    setStep(3);
    setPhase('stopped');
  };

  const startAgain = () => {
    const next = new URLSearchParams(params);
    next.delete('join');
    setParams(next, { replace: true });
    setCreated(undefined);
    setCommand(undefined);
    setMachine(undefined);
    setProblem(undefined);
    setStep(0);
    setPhase('first-run');
  };

  let body;
  if (step === 0) {
    body = (
      <ChoiceField
        label="Operating system of the machine"
        help="The machine runs the agent. Pick the system it has."
        value={os}
        onChange={(v) => setOs(v as OS)}
        choices={[
          { value: 'linux', label: 'Linux' },
          { value: 'windows', label: 'Windows' },
          { value: 'macos', label: 'macOS' },
        ]}
      />
    );
  } else if (step === 1) {
    body = (
      <Stack>
        <Text>
          Run this command on the machine. It joins the pool with a one-time code.
        </Text>
        <CodeBlock label="Install command" text={command ?? ''} />
        <Text tone="muted">
          The join code lasts {TTL_MINUTES} minutes and works once.
        </Text>
      </Stack>
    );
  } else if (step === 2) {
    const left = created ? Date.parse(created.join.expires_at) - now : undefined;
    body = (
      <Stack>
        {phase === 'paused' ? (
          <Message tone="needs-you">
            Paused. The wait for the agent ended when this page closed. Start again to
            make a new join code.
          </Message>
        ) : null}
        {created ? (
          <>
            <Text>Run this command on the machine now. The code shows once.</Text>
            <CodeBlock
              label="Install command with the join code"
              text={created.command}
            />
            <Facts
              items={[
                { name: 'Join code', value: created.code },
                {
                  name: 'Time left',
                  value: left === undefined ? '' : formatTimeLeft(left),
                },
              ]}
            />
          </>
        ) : (
          <Text>Making the join code.</Text>
        )}
      </Stack>
    );
  } else {
    body =
      phase === 'failed' ? (
        <Message tone="problem">
          The machine did not join. {problem ?? ''} Try again to make a new join code.
        </Message>
      ) : phase === 'stopped' ? (
        <Message tone="note">
          Stopped. The join code is withdrawn and no machine joined. Start again to make a
          new one.
        </Message>
      ) : (
        <Stack>
          <Message tone="done">The machine joined the pool.</Message>
          {machine ? (
            <Facts
              items={[
                { name: 'Name', value: machine.name },
                { name: 'System', value: `${machine.os} ${machine.arch}` },
                { name: 'CPU', value: machine.facts?.cpu_model ?? 'not reported' },
                {
                  name: 'Memory',
                  value: machine.facts?.memory_bytes
                    ? formatSize(machine.facts.memory_bytes)
                    : 'not reported',
                },
                {
                  name: 'Backends found',
                  value:
                    machine.backends
                      .filter((b) => b.present)
                      .map((b) => b.name)
                      .join(', ') || formatNumber(0),
                },
              ]}
            />
          ) : (
            <Facts items={[{ name: 'Machines joined', value: '1' }]} />
          )}
        </Stack>
      );
  }

  return (
    <Wizard
      name="Add a machine"
      steps={STEPS}
      current={step}
      phase={phase}
      reading="Reading the controller"
      progress={
        phase === 'running'
          ? {
              text: created
                ? `Waiting for the agent, ${formatTimeLeft(Date.parse(created.join.expires_at) - now)}`
                : 'Making the join code',
            }
          : undefined
      }
      canStop
      stopping={stopping}
      onStop={() => void stop()}
      onBack={() => {
        const i = Math.max(0, step - 1);
        setStep(i);
        setPhase(i === 0 ? 'first-run' : 'ready-to-review');
      }}
      onStep={(i) => {
        setStep(i);
        setPhase(i === 0 ? 'first-run' : 'ready-to-review');
      }}
      primary={
        step === 0
          ? { label: 'Next', onPress: () => void toReview() }
          : {
              label: 'Join a machine',
              busyLabel: 'Joining',
              onPress: () => void startJoining(),
            }
      }
      review={step === 1}
      onStartAgain={startAgain}
      onTryAgain={startAgain}
    >
      {body}
    </Wizard>
  );
}

export function AddMachinePage() {
  return (
    <Page frame="narrow">
      <Breadcrumbs
        trail={[{ to: '/machines', label: 'Machines' }, { label: 'Add a machine' }]}
      />
      <PageHeader title="Add a machine" />
      <AddMachineWizard />
    </Page>
  );
}
