// The pool size of a machine (web-console 4.4, machines R5.58): a wizard on the machine's page. Steps: Size,
// Review, Saving, Done. Review shows the budget check and the nearest size that fits; a size below the current
// one needs its own yes. The page passes data only; the shared wizard owns the steps, locks and busy state.
import {
  BulletList,
  CheckRow,
  ErrorSummary,
  Facts,
  Message,
  NumberField,
  Stack,
  Text,
  Wizard,
  type WizardPhase,
} from '@crsp/ui';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useSession } from '../../auth/session';

type Machine = Schemas['Machine'];
type Check = Schemas['PoolSizeCheck'];

const STEPS = ['Size', 'Review', 'Saving', 'Done'] as const;
const PARAM = 'pool_size';

// The floors of machines R5.58: 4 GiB and 2 CPUs.
const MIN_GIB = 4;
const MIN_CPUS = 2;

export const gib = (n: number) => `${Number(n.toFixed(1))} GiB`;
export const cpuWord = (n: number) => `${n} ${n === 1 ? 'CPU' : 'CPUs'}`;

export function sizeWords(mem: number | undefined, cpus: number | undefined): string {
  return mem && cpus ? `${gib(mem)} and ${cpuWord(cpus)}` : 'not set';
}

export function PoolSizeWizard({ m, onChanged }: { m: Machine; onChanged: () => void }) {
  const client = useClient();
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const stored = useRef(params.get(PARAM)).current;
  const admin = session.can('admin');

  const curMem = m.settings.pool_memory_gib ?? 0;
  const curCpus = m.settings.pool_cpus ?? 0;
  const [mem, setMem] = useState(curMem || MIN_GIB);
  const [cpus, setCpus] = useState(curCpus || MIN_CPUS);
  const [phase, setPhase] = useState<WizardPhase>(
    stored === 'saving' ? 'paused' : stored === 'saved' ? 'done-after-reload' : 'loading',
  );
  const [step, setStep] = useState(stored === 'saving' ? 2 : stored === 'saved' ? 3 : 0);
  const [check, setCheck] = useState<Check | undefined>(undefined);
  const [yes, setYes] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [left, setLeft] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState<{ mem: number; cpus: number } | undefined>(
    undefined,
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The budget is read once when the form opens, so the Size step shows the room the pool has (R5.58).
  const [room, setRoom] = useState<Check | undefined>(undefined);
  useEffect(() => {
    if (stored) return;
    let on = true;
    void unwrap(
      client.POST('/api/v1/machines/{machineId}/pool-size-check', {
        params: { path: { machineId: m.id } },
        body: { pool_memory_gib: curMem || MIN_GIB, pool_cpus: curCpus || MIN_CPUS },
      }),
    )
      .then((c) => on && setRoom(c))
      .catch(() => undefined)
      .finally(() => on && setPhase((p) => (p === 'loading' ? 'first-run' : p)));
    return () => {
      on = false;
    };
    // Read once for this machine.
  }, [m.id]);

  const mark = (value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(PARAM, value);
    else next.delete(PARAM);
    setParams(next, { replace: true });
  };

  const runCheck = () =>
    unwrap(
      client.POST('/api/v1/machines/{machineId}/pool-size-check', {
        params: { path: { machineId: m.id } },
        body: { pool_memory_gib: mem, pool_cpus: cpus },
      }),
    );

  const toReview = async () => {
    const problems: string[] = [];
    if (mem < MIN_GIB) problems.push(`The pool needs at least ${MIN_GIB} GiB.`);
    if (cpus < MIN_CPUS) problems.push(`The pool needs at least ${MIN_CPUS} CPUs.`);
    if (mem === curMem && cpus === curCpus)
      problems.push('This is the size that is set now. Change it to review.');
    setErrors(problems);
    if (problems.length) return;
    setStep(1);
    setPhase('planning');
    setYes(false);
    try {
      const c = await runCheck();
      if (!mounted.current) return;
      setCheck(c);
      setPhase('ready-to-review');
    } catch (e) {
      if (!mounted.current) return;
      setProblem(e instanceof Error ? e.message : 'The controller did not answer.');
      setStep(3);
      setPhase('failed');
    }
  };

  const save = async () => {
    if (!check) return;
    setStep(2);
    setPhase('running');
    mark('saving');
    try {
      // The size is read again right before it is saved, so a change made meanwhile is never overwritten.
      const again = await runCheck();
      if (!mounted.current) return;
      if (
        again.current_memory_gib !== check.current_memory_gib ||
        again.current_cpus !== check.current_cpus
      ) {
        setLeft(
          `The pool size changed to ${sizeWords(again.current_memory_gib, again.current_cpus)} while you reviewed.`,
        );
        mark(undefined);
        setStep(3);
        setPhase('stopped');
        onChanged();
        return;
      }
      await unwrap(
        client.PATCH('/api/v1/machines/{machineId}', {
          params: { path: { machineId: m.id } },
          body: {
            pool_memory_gib: mem,
            pool_cpus: cpus,
            ...(check.needs_shrink_confirm ? { confirm_shrink: true } : {}),
          },
        }),
      );
      if (!mounted.current) return;
      setSaved({ mem, cpus });
      mark('saved');
      setStep(3);
      setPhase('done');
      onChanged();
    } catch (e) {
      if (!mounted.current) return;
      mark(undefined);
      setProblem(e instanceof Error ? e.message : 'The controller did not answer.');
      setStep(3);
      setPhase('failed');
    }
  };

  const startAgain = () => {
    mark(undefined);
    setCheck(undefined);
    setProblem(undefined);
    setLeft(undefined);
    setErrors([]);
    setYes(false);
    setMem(curMem || MIN_GIB);
    setCpus(curCpus || MIN_CPUS);
    setStep(0);
    setPhase('first-run');
  };

  const sizing = sizingFacts(check);
  const roomFacts = sizingFacts(room);

  let body;
  if (step === 0) {
    body = (
      <Stack>
        <Facts
          items={[
            { name: 'Pool size now', value: sizeWords(curMem, curCpus) },
            ...roomFacts,
            ...(roomFacts.length === 0
              ? [{ name: 'Budget', value: 'not known yet; Review says when it is' }]
              : []),
          ]}
        />
        <ErrorSummary errors={errors} />
        <NumberField
          label="Pool memory"
          help="Memory the pool may use on this machine, in GiB."
          value={mem}
          unit=" GiB"
          min={MIN_GIB}
          max={4096}
          decimals={1}
          onChange={setMem}
        />
        <NumberField
          label="Pool CPUs"
          help="CPUs the pool may use on this machine."
          value={cpus}
          min={MIN_CPUS}
          max={512}
          onChange={setCpus}
        />
      </Stack>
    );
  } else if (step === 1) {
    body = !check ? (
      <Text>Reading the budget of {m.name}.</Text>
    ) : !check.known ? (
      <Message tone="needs-you">
        The size cannot be checked yet. {check.why ?? ''} Try again when the agent has
        reported.
      </Message>
    ) : (
      <Stack>
        <Text>
          {`The pool of ${m.name} changes from ${sizeWords(check.current_memory_gib, check.current_cpus)} to ${gib(mem)} and ${cpuWord(cpus)}.`}
        </Text>
        {check.ok ? (
          <Message tone="done">This size fits the budget of the machine.</Message>
        ) : (
          <>
            <Message tone="problem">
              This size does not fit the budget. {check.reason ?? ''}
            </Message>
            {check.nearest.length > 0 ? (
              <>
                <Text>The nearest sizes that fit:</Text>
                <BulletList items={check.nearest} />
              </>
            ) : null}
          </>
        )}
        {sizing.length > 0 ? <Facts items={sizing} /> : null}
        {check.ok && check.needs_shrink_confirm ? (
          <>
            <Message tone="needs-you">
              This lowers the pool size. Jobs that need more than the new size wait or
              fail to start.
            </Message>
            <CheckRow label="Yes, lower the pool size" checked={yes} onChange={setYes} />
          </>
        ) : null}
      </Stack>
    );
  } else if (step === 2) {
    body = (
      <Stack>
        {phase === 'paused' ? (
          <Message tone="needs-you">
            Paused. The page closed while the size was saving. Start again to read the
            size that is set.
          </Message>
        ) : null}
        <Facts items={[{ name: 'Pool size now', value: sizeWords(curMem, curCpus) }]} />
      </Stack>
    );
  } else {
    body = (
      <Stack>
        {phase === 'failed' ? (
          <Message tone="problem">
            The pool size was not saved. {problem ?? ''} Try again.
          </Message>
        ) : null}
        {phase === 'stopped' ? (
          <Message tone="note">Stopped. Nothing was saved. {left ?? ''}</Message>
        ) : null}
        {phase === 'done' || phase === 'done-after-reload' ? (
          <Message tone="done">
            {`The pool size is ${sizeWords(saved?.mem ?? curMem, saved?.cpus ?? curCpus)}.`}
          </Message>
        ) : null}
        <Facts
          items={[
            { name: 'Pool size now', value: sizeWords(curMem, curCpus) },
            ...(phase === 'failed' || phase === 'stopped'
              ? [{ name: 'Asked for', value: sizeWords(mem, cpus) }]
              : []),
          ]}
        />
      </Stack>
    );
  }

  const blocked = !admin
    ? session.whyNot('admin')
    : step === 1 && phase === 'planning'
      ? 'Reading the budget.'
      : step === 1 && check && !check.known
        ? 'The size cannot be checked yet.'
        : step === 1 && check && !check.ok
          ? 'This size does not fit. Go back and change it.'
          : step === 1 && check?.needs_shrink_confirm && !yes
            ? 'Tick the box to confirm lowering the pool size.'
            : undefined;

  return (
    <Wizard
      name="Pool size"
      steps={STEPS}
      current={step}
      firstStep={0}
      phase={phase}
      reading={`Reading the budget of ${m.name}`}
      progress={
        phase === 'running' ? { text: `Saving the pool size of ${m.name}` } : undefined
      }
      onBack={() => {
        setStep(0);
        setPhase('first-run');
      }}
      onStep={(i) => {
        if (i === 0) {
          setStep(0);
          setPhase('first-run');
        }
      }}
      primary={
        step === 0
          ? {
              label: 'Review',
              onPress: () => void toReview(),
              disabled: !admin,
              reason: admin ? undefined : session.whyNot('admin'),
            }
          : {
              label: `Save ${gib(mem)} and ${cpuWord(cpus)}`,
              busyLabel: 'Saving',
              onPress: () => void save(),
              disabled: blocked !== undefined,
              reason: blocked,
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

function sizingFacts(c: Check | undefined) {
  if (!c || !c.known) return [];
  return [
    ...(c.total_gib !== undefined
      ? [{ name: 'Memory of the machine', value: gib(c.total_gib) }]
      : []),
    ...(c.used_outside_gib !== undefined
      ? [{ name: 'Used outside the pool', value: gib(c.used_outside_gib) }]
      : []),
    ...(c.memory_budget_gib !== undefined
      ? [{ name: 'Memory budget', value: gib(c.memory_budget_gib) }]
      : []),
    ...(c.room_gib !== undefined
      ? [{ name: 'Room for the pool', value: gib(c.room_gib) }]
      : []),
    ...(c.cpu_budget !== undefined
      ? [{ name: 'CPU budget', value: cpuWord(c.cpu_budget) }]
      : []),
    ...(c.decided && c.decided !== 'fits'
      ? [{ name: 'Decided by', value: c.decided }]
      : []),
  ];
}
