// The pool size of a machine (web-console 4.4, machines R5.58, LOOK22): a plain section of the machine's page, not a
// wizard. Facts, a choice of three (half of the free room, three quarters of it, Custom), and a live check line that
// asks the controller 250 ms after the last edit. The size is part of the page's one Save (UX-71); a shrink still
// needs its own yes. The page passes data only; `usePoolSize` hands it the change count, Save and Cancel.
import {
  ChoiceField,
  CheckRow,
  Facts,
  Message,
  NumberField,
  Section,
  Stack,
  Text,
  Button,
  type Tone,
} from '@crsp/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useSession } from '../../auth/session';

type Machine = Schemas['Machine'];
type Check = Schemas['PoolSizeCheck'];

// The floors of machines R5.58: 4 GiB and 2 CPUs. 1.5 GiB per CPU.
export const MIN_GIB = 4;
export const MIN_CPUS = 2;
const GIB_PER_CPU = 1.5;
/** The check line asks the controller this long after the last edit (last answer wins). */
export const CHECK_DELAY_MS = 250;
/** A size that fits but leaves less than this for the rest of the PC is a warning. */
export const LEFT_WARNING_GIB = 3;

export const gib = (n: number) => `${Number(n.toFixed(1))} GiB`;
export const cpuWord = (n: number) => `${n} ${n === 1 ? 'CPU' : 'CPUs'}`;

export function sizeWords(mem: number | undefined, cpus: number | undefined): string {
  return mem && cpus ? `${gib(mem)} and ${cpuWord(cpus)}` : 'not set';
}

export type SizeChoice = 'half' | 'three' | 'custom';

export const choiceLabel = (
  kind: 'half' | 'three',
  r: { memory_gib: number; cpus: number },
) =>
  `Recommended: ${kind === 'half' ? 'half' : 'three quarters'} of the free room (${gib(r.memory_gib)}, ${cpuWord(r.cpus)})`;

/** How a recommended size was computed, in the words of the owner (D39). */
export const choiceHow = (kind: 'half' | 'three', c: Check): string =>
  `${kind === 'half' ? 'Half' : 'Three quarters'} of the ${gib(c.room_gib ?? 0)} free for the pool, rounded down to whole GiB. CPUs: the same share of the CPU budget (${c.cpu_budget ?? 0}), at most one per ${GIB_PER_CPU} GiB.`;

/** The size the controller would fit when the memory asked for is more than the room. */
export function fitSize(c: Check): { mem: number; cpus: number } | undefined {
  if (c.room_gib === undefined) return undefined;
  const mem = Math.floor(c.room_gib);
  if (mem < MIN_GIB) return undefined;
  const cpus = Math.max(
    MIN_CPUS,
    Math.min(Math.floor(mem / GIB_PER_CPU), c.cpu_budget ?? Infinity),
  );
  return { mem, cpus };
}

/** The choice that shows the size now: a recommended size when it is the one set, else Custom (when a size is set). */
export function currentChoice(
  room: Check | undefined,
  curMem: number,
  curCpus: number,
): SizeChoice | undefined {
  if (!curMem || !curCpus) return undefined;
  const is = (r: { memory_gib: number; cpus: number } | undefined) =>
    r !== undefined && r.memory_gib === curMem && r.cpus === curCpus;
  if (room?.known && is(room.recommended_half)) return 'half';
  if (room?.known && is(room.recommended_three_quarters)) return 'three';
  return 'custom';
}

export interface LiveLine {
  tone: Tone;
  text: string;
  /** "Use 10 GiB and 6 CPUs": sets both fields, saves nothing. */
  use?: { label: string; mem: number; cpus: number } | undefined;
  notes: string[];
}

/** The words of the check line for one answer of the controller (tones ok = done, warning = needs-you, error = problem). */
export function liveLine(
  c: Check,
  mem: number,
  cpus: number,
  curMem: number,
  curCpus: number,
): LiveLine {
  if (!c.known)
    return {
      tone: 'needs-you',
      text: `The size cannot be checked yet. ${c.why ?? ''} Try again when the agent has reported.`.replace(
        '  ',
        ' ',
      ),
      notes: [],
    };
  if (!c.ok) {
    if (c.short === 'memory' && c.room_gib !== undefined) {
      const fit = fitSize(c);
      const used = (c.memory_budget_gib ?? 0) - c.room_gib;
      const notes = ['The room moves with what else runs on this PC.'];
      if (fit && cpus !== fit.cpus)
        notes.push(`${cpuWord(fit.cpus)}: each CPU needs about 1.5 GiB.`);
      return {
        tone: 'problem',
        text: `${gib(mem)} is too much: only ${gib(c.room_gib)} is free for the pool right now (other programs use ${gib(used)}).${fit ? ` Use ${gib(fit.mem)} and ${cpuWord(fit.cpus)}?` : ''}`,
        use: fit
          ? {
              label: `Use ${gib(fit.mem)} and ${cpuWord(fit.cpus)}`,
              mem: fit.mem,
              cpus: fit.cpus,
            }
          : undefined,
        notes,
      };
    }
    return {
      tone: 'problem',
      text: `This size does not fit the budget. ${c.reason ?? ''}${c.nearest.length ? ` The nearest sizes that fit: ${c.nearest.join('; ')}.` : ''}`.trim(),
      notes: [],
    };
  }
  const shrinks = c.needs_shrink_confirm || mem < curMem || cpus < curCpus;
  if (shrinks)
    return {
      tone: 'needs-you',
      text: 'This lowers the pool size. Jobs that need more than the new size wait or fail to start.',
      notes: [],
    };
  const left = (c.room_gib ?? Infinity) - mem;
  if (left < LEFT_WARNING_GIB)
    return {
      tone: 'needs-you',
      text: `This size fits, but leaves ${gib(Math.max(left, 0))} for this PC.`,
      notes: [],
    };
  return { tone: 'done', text: 'This size fits the budget of the machine.', notes: [] };
}

export interface PoolSizeForm {
  /** 1 when the person changed the pool size, else 0. */
  changes: number;
  /** Why the page's Save must wait, or undefined. */
  hold: string | undefined;
  /** Sends the size. True when saved or nothing to save; false when it did not save (the section says why). */
  save: () => Promise<boolean>;
  reset: () => void;
  section: React.ReactNode;
}

/** The state of the pool size section. The page adds `changes` to its own and calls `save` from its one Save. */
export function usePoolSize(m: Machine, onChanged: () => void): PoolSizeForm {
  const client = useClient();
  const session = useSession();
  const admin = session.can('admin');
  const curMem = m.settings.pool_memory_gib ?? 0;
  const curCpus = m.settings.pool_cpus ?? 0;

  const [choice, setChoice] = useState<SizeChoice | undefined>(undefined);
  const [mem, setMem] = useState(curMem || MIN_GIB);
  const [cpus, setCpus] = useState(curCpus || MIN_CPUS);
  const [room, setRoom] = useState<Check | undefined>(undefined);
  const [roomTried, setRoomTried] = useState(false);
  const [check, setCheck] = useState<Check | undefined>(undefined);
  const [waiting, setWaiting] = useState(false);
  const [yes, setYes] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const mounted = useRef(true);
  const seq = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const runCheck = useCallback(
    (memGiB: number, poolCpus: number) =>
      unwrap(
        client.POST('/api/v1/machines/{machineId}/pool-size-check', {
          params: { path: { machineId: m.id } },
          body: { pool_memory_gib: memGiB, pool_cpus: poolCpus },
        }),
      ),
    [client, m.id],
  );

  // The room and the recommended sizes are read once with the size that is set (or the floor).
  useEffect(() => {
    let on = true;
    void runCheck(curMem || MIN_GIB, curCpus || MIN_CPUS)
      .then((c) => {
        if (!on) return;
        setRoom(c);
        setRoomTried(true);
      })
      .catch(() => on && setRoomTried(true));
    return () => {
      on = false;
    };
    // Read once for this machine.
  }, [m.id]);

  // Until the person picks, the group shows the size that is set (after the room is read, so it does not flip).
  const shown = choice ?? (roomTried ? currentChoice(room, curMem, curCpus) : undefined);
  const changed = choice !== undefined && (mem !== curMem || cpus !== curCpus);
  const tooLow = mem < MIN_GIB || cpus < MIN_CPUS;

  // The live check: 250 ms after the last edit, the last answer wins.
  useEffect(() => {
    seq.current += 1;
    const mine = seq.current;
    setYes(false);
    if (!changed || tooLow) {
      setCheck(undefined);
      setWaiting(false);
      return;
    }
    setWaiting(true);
    const timer = setTimeout(() => {
      runCheck(mem, cpus)
        .then((c) => {
          if (mounted.current && seq.current === mine) {
            setCheck(c);
            setWaiting(false);
          }
        })
        .catch((e: unknown) => {
          if (mounted.current && seq.current === mine) {
            setCheck({
              known: false,
              ok: false,
              needs_shrink_confirm: false,
              nearest: [],
              why: e instanceof Error ? e.message : 'The controller did not answer.',
              current_memory_gib: curMem,
              current_cpus: curCpus,
            });
            setWaiting(false);
          }
        });
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [changed, tooLow, mem, cpus, runCheck, curMem, curCpus]);

  const pick = (v: string) => {
    const c = v as SizeChoice;
    setChoice(c);
    setProblem(undefined);
    if (c === 'half' && room?.recommended_half) {
      setMem(room.recommended_half.memory_gib);
      setCpus(room.recommended_half.cpus);
    } else if (c === 'three' && room?.recommended_three_quarters) {
      setMem(room.recommended_three_quarters.memory_gib);
      setCpus(room.recommended_three_quarters.cpus);
    }
  };

  const line =
    check && changed && !waiting
      ? liveLine(check, mem, cpus, curMem, curCpus)
      : undefined;
  const needsYes = Boolean(
    changed &&
    check?.known &&
    check.ok &&
    line?.tone === 'needs-you' &&
    (check.needs_shrink_confirm || mem < curMem || cpus < curCpus),
  );

  let hold: string | undefined;
  if (changed) {
    if (!admin) hold = session.whyNot('admin');
    else if (tooLow)
      hold =
        mem < MIN_GIB
          ? `The pool needs at least ${MIN_GIB} GiB.`
          : `The pool needs at least ${MIN_CPUS} CPUs.`;
    else if (waiting || !check) hold = 'Reading the budget.';
    else if (!check.known) hold = 'The size cannot be checked yet.';
    else if (!check.ok) hold = 'This size does not fit. Change the pool size.';
    else if (needsYes && !yes) hold = 'Tick the box to confirm lowering the pool size.';
  }

  const save = async (): Promise<boolean> => {
    if (!changed) return true;
    setProblem(undefined);
    try {
      // The size is read again right before it is saved, so a change made meanwhile is never overwritten.
      const again = await runCheck(mem, cpus);
      if (!mounted.current) return false;
      if (again.current_memory_gib !== curMem || again.current_cpus !== curCpus) {
        setProblem(
          `The pool size changed to ${sizeWords(again.current_memory_gib, again.current_cpus)} while you edited. Nothing was saved.`,
        );
        onChanged();
        return false;
      }
      await unwrap(
        client.PATCH('/api/v1/machines/{machineId}', {
          params: { path: { machineId: m.id } },
          body: {
            pool_memory_gib: mem,
            pool_cpus: cpus,
            ...(again.needs_shrink_confirm ? { confirm_shrink: true } : {}),
          },
        }),
      );
      if (!mounted.current) return true;
      setChoice(undefined);
      setCheck(undefined);
      return true;
    } catch (e) {
      if (mounted.current)
        setProblem(
          `The pool size was not saved. ${e instanceof Error ? e.message : 'The controller did not answer.'} Try again.`,
        );
      return false;
    }
  };

  const reset = () => {
    setChoice(undefined);
    setMem(curMem || MIN_GIB);
    setCpus(curCpus || MIN_CPUS);
    setCheck(undefined);
    setProblem(undefined);
    setYes(false);
  };

  const roomKnown = Boolean(
    room?.known && room.recommended_half && room.recommended_three_quarters,
  );
  const unknown = 'The budget is not known yet.';
  const roomFacts = room?.known
    ? [
        ...(room.room_gib !== undefined
          ? [{ name: 'Room for the pool', value: gib(room.room_gib) }]
          : []),
        ...(room.cpu_budget !== undefined
          ? [{ name: 'CPU budget', value: cpuWord(room.cpu_budget) }]
          : []),
      ]
    : [{ name: 'Budget', value: 'not known yet' }];

  const section = (
    <Section title="Pool size">
      <Stack>
        <Facts
          items={[
            { name: 'Pool size now', value: sizeWords(curMem, curCpus) },
            ...roomFacts,
          ]}
        />
        <ChoiceField
          label="New pool size"
          value={shown ?? ''}
          onChange={pick}
          changed={changed}
          choices={[
            {
              value: 'half',
              label:
                roomKnown && room?.recommended_half
                  ? choiceLabel('half', room.recommended_half)
                  : 'Recommended: half of the free room',
              ...(roomKnown && room
                ? { description: choiceHow('half', room) }
                : { disabledReason: unknown }),
            },
            {
              value: 'three',
              label:
                roomKnown && room?.recommended_three_quarters
                  ? choiceLabel('three', room.recommended_three_quarters)
                  : 'Recommended: three quarters of the free room',
              ...(roomKnown && room
                ? { description: choiceHow('three', room) }
                : { disabledReason: unknown }),
            },
            {
              value: 'custom',
              label: 'Custom',
              description: 'Choose the memory and the CPUs yourself.',
              extra: (
                <Stack>
                  <NumberField
                    label="Pool memory"
                    help="Memory the pool may use on this machine, in GiB."
                    value={mem}
                    unit=" GiB"
                    min={MIN_GIB}
                    max={4096}
                    decimals={1}
                    changed={choice === 'custom' && mem !== curMem}
                    onChange={(v) => {
                      setChoice('custom');
                      setMem(v);
                    }}
                  />
                  <NumberField
                    label="Pool CPUs"
                    help="CPUs the pool may use on this machine."
                    value={cpus}
                    min={MIN_CPUS}
                    max={512}
                    changed={choice === 'custom' && cpus !== curCpus}
                    onChange={(v) => {
                      setChoice('custom');
                      setCpus(v);
                    }}
                  />
                </Stack>
              ),
            },
          ]}
        />
        {changed && tooLow ? (
          <Message tone="problem">
            {mem < MIN_GIB
              ? `The pool needs at least ${MIN_GIB} GiB.`
              : `The pool needs at least ${MIN_CPUS} CPUs.`}
          </Message>
        ) : null}
        {changed && !tooLow && !line ? (
          <Text tone="muted">Reading the budget of {m.name}.</Text>
        ) : null}
        {line ? (
          <Stack gap="tight">
            <Message
              tone={line.tone}
              action={
                line.use ? (
                  <Button
                    onPress={() => {
                      const u = line.use;
                      if (!u) return;
                      setChoice('custom');
                      setMem(u.mem);
                      setCpus(u.cpus);
                    }}
                  >
                    {line.use.label}
                  </Button>
                ) : undefined
              }
            >
              {line.text}
            </Message>
            {line.notes.map((n) => (
              <Text tone="muted" key={n}>
                {n}
              </Text>
            ))}
          </Stack>
        ) : null}
        {needsYes ? (
          <CheckRow label="Yes, lower the pool size" checked={yes} onChange={setYes} />
        ) : null}
        {problem ? <Message tone="problem">{problem}</Message> : null}
      </Stack>
    </Section>
  );

  return { changes: changed ? 1 : 0, hold, save, reset, section };
}
