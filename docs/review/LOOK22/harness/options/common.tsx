// Shared by the three options of LOOK22: the live check, the Recommended size and the save call.
import { Message, type Tone } from '@crsp/ui';
import { useEffect, useRef, useState } from 'react';
import { unwrap, useClient, type Schemas } from '@app/api/api';

export type Machine = Schemas['Machine'];
export type Check = Schemas['PoolSizeCheck'];
export const MIN_GIB = 4;
export const MIN_CPUS = 2;
/** Room left under this many GiB after the pool is a warning, not an error. */
export const TIGHT_GIB = 3;

export const gib = (n: number) => `${Number(n.toFixed(1))} GiB`;
export const cpuWord = (n: number) => `${n} ${n === 1 ? 'CPU' : 'CPUs'}`;
export const sizeWords = (m: number, c: number) => `${gib(m)}, ${cpuWord(c)}`;

/**
 * Recommended (not computed by the controller today). From the figures the check already returns:
 *   memory = half of the room for the pool, rounded down to a whole GiB, at least 4 GiB
 *   CPUs   = half of the CPU budget, but no more than memory / 1.5 (the controller's GiB-per-CPU rule), at least 2
 */
export function recommended(c: Check | undefined): { mem: number; cpus: number } | undefined {
  if (!c || !c.known || c.room_gib === undefined || c.cpu_budget === undefined) return undefined;
  const mem = Math.max(MIN_GIB, Math.floor(c.room_gib / 2));
  const cpus = Math.max(MIN_CPUS, Math.min(Math.floor(c.cpu_budget / 2), Math.floor(mem / 1.5)));
  return { mem, cpus };
}

/** The budget figures, read once (a check of the saved size). */
export function useRoom(m: Machine): Check | undefined {
  const client = useClient();
  const [room, setRoom] = useState<Check | undefined>(undefined);
  useEffect(() => {
    let on = true;
    void unwrap(
      client.POST('/api/v1/machines/{machineId}/pool-size-check', {
        params: { path: { machineId: m.id } },
        body: { pool_memory_gib: m.settings.pool_memory_gib ?? MIN_GIB, pool_cpus: m.settings.pool_cpus ?? MIN_CPUS },
      }),
    )
      .then((c) => on && setRoom(c))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [m.id]);
  return room;
}

export interface Live {
  tone: Tone | 'busy';
  text: string;
  /** The save is allowed by the check (error: no; shrink: only with the yes). */
  saveable: boolean;
  shrink: boolean;
  check: Check | undefined;
}

/** The Review check, run live (250 ms after the last edit) for the size being edited. */
export function useLiveCheck(m: Machine, mem: number, cpus: number, on: boolean): Live {
  const client = useClient();
  const [check, setCheck] = useState<Check | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    if (!on) return;
    const n = ++seq.current;
    setBusy(true);
    const t = setTimeout(() => {
      void unwrap(
        client.POST('/api/v1/machines/{machineId}/pool-size-check', {
          params: { path: { machineId: m.id } },
          body: { pool_memory_gib: mem, pool_cpus: cpus },
        }),
      )
        .then((c) => n === seq.current && (setCheck(c), setBusy(false)))
        .catch(() => n === seq.current && (setCheck(undefined), setBusy(false)));
    }, 250);
    return () => clearTimeout(t);
  }, [m.id, mem, cpus, on]);
  return describe(check, busy, mem);
}

function describe(c: Check | undefined, busy: boolean, mem: number): Live {
  const none = { saveable: false, shrink: false, check: c };
  if (busy) return { ...none, tone: 'busy', text: 'Checking this size against the budget.' };
  if (!c) return { ...none, tone: 'needs-you', text: 'The size cannot be checked now.' };
  if (!c.known) return { ...none, tone: 'needs-you', text: `The size cannot be checked yet. ${c.why ?? ''}` };
  if (c.needs_shrink_confirm)
    return { tone: 'needs-you', text: 'This lowers the pool size. Jobs that need more than the new size wait or fail to start.', saveable: true, shrink: true, check: c };
  if (!c.ok) {
    const near = c.nearest.length ? ` Nearest that fits: ${c.nearest.join('; ')}.` : '';
    return { ...none, tone: 'problem', text: `More than the room for the pool. ${(c.reason ?? '').replace(/\.?$/, '.')}${near}` };
  }
  const left = (c.room_gib ?? 0) - mem;
  if (left < TIGHT_GIB)
    return { tone: 'needs-you', text: `Fits, but leaves ${gib(Math.max(left, 0))} for this PC.`, saveable: true, shrink: false, check: c };
  return { tone: 'done', text: `Fits the budget. Leaves ${gib(left)} for this PC.`, saveable: true, shrink: false, check: c };
}

export function LiveLine({ live }: { live: Live }) {
  if (live.tone === 'busy')
    return (
      <p role="status" className="ds-text" data-tone="muted">
        {live.text}
      </p>
    );
  return <Message tone={live.tone}>{live.text}</Message>;
}

/** The save call of the page's pattern: busy "Saving", then "Settings saved." or "Could not save." */
export function useSave(m: Machine, onChanged: () => void) {
  const client = useClient();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const run = async (mem: number, cpus: number, shrink: boolean) => {
    setBusy(true);
    setError(undefined);
    setSaved(undefined);
    try {
      await unwrap(
        client.PATCH('/api/v1/machines/{machineId}', {
          params: { path: { machineId: m.id } },
          body: { pool_memory_gib: mem, pool_cpus: cpus, ...(shrink ? { confirm_shrink: true } : {}) },
        }),
      );
      setSaved(`The pool size is ${sizeWords(mem, cpus)}.`);
      onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The controller did not answer.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, saved, error, run, clear: () => (setSaved(undefined), setError(undefined)) };
}
