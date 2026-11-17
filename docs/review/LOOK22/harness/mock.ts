// The mocked controller of the harness: the same MockApi the component tests use, plus a pool-size check that
// follows internal/poolsize/budget.go (floor, CPU budget, memory room, 1.5 GiB per CPU, shrink needs a yes).
import { MockApi, machine, signedIn } from '@app/testing/mock';

export const FIG = { total: 31.7, outside: 16.4, budget: 26.9, room: 10.5, cpuBudget: 19 };
const trim = (f: number) => String(Number(f.toFixed(1)));

export function check(mem: number, cpus: number, cur: { mem: number; cpus: number }) {
  const base = {
    known: true,
    ok: false,
    needs_shrink_confirm: false,
    nearest: [] as string[],
    total_gib: FIG.total,
    used_outside_gib: FIG.outside,
    memory_budget_gib: FIG.budget,
    room_gib: FIG.room,
    cpu_budget: FIG.cpuBudget,
    decided: 'fits',
    current_memory_gib: cur.mem,
    current_cpus: cur.cpus,
  };
  const refuse = (short: string, decided: string, reason: string, nearest: string[]) => ({
    ...base,
    short,
    decided,
    reason,
    nearest,
  });
  if (mem < 4 || cpus < 2)
    return refuse('floor', 'floor', 'the pool needs at least 4 GiB and 2 CPUs', [
      '4 GiB with 2 CPUs is the smallest pool',
    ]);
  if (cpus > FIG.cpuBudget)
    return refuse('cpu', 'CPU budget', `${cpus} CPUs is above the CPU budget of ${FIG.cpuBudget}`, [
      `${FIG.cpuBudget} CPUs fits the CPU budget`,
    ]);
  if (mem > FIG.room)
    return refuse(
      'memory',
      'memory budget',
      `${trim(mem)} GiB is above the memory room: 85% of ${trim(FIG.total)} GiB is ${trim(FIG.budget)} GiB, less ${trim(FIG.outside)} GiB used outside WSL and guests leaves ${trim(FIG.room)} GiB`,
      [`${trim(Math.floor(FIG.room * 2) / 2)} GiB fits ${Math.floor(FIG.room / 1.5)} CPUs`],
    );
  if (cpus * 1.5 > mem + 1e-9)
    return refuse('ratio', '1.5 GiB per CPU', `${trim(mem)} GiB fits ${Math.floor(mem / 1.5)} CPUs; ${cpus} CPUs needs ${trim(Math.ceil(cpus * 3 - 1e-9) / 2)} GiB`, [
      `${trim(mem)} GiB fits ${Math.floor(mem / 1.5)} CPUs`,
    ]);
  const shrinks = (cur.mem > 0 && mem < cur.mem) || (cur.cpus > 0 && cpus < cur.cpus);
  return { ...base, ok: !shrinks, needs_shrink_confirm: shrinks };
}

/** MODE: `hold` keeps the save request open (the "saving" screenshot); `slow` answers checks after 400 ms. */
export function makeApi(hold: boolean): MockApi {
  const state = { mem: 4, cpus: 2 };
  const current = () => {
    const m = machine({ name: 'build-1' });
    m.settings = { ...m.settings, pool_memory_gib: state.mem, pool_cpus: state.cpus };
    return m;
  };
  return signedIn()
    .on('GET', '/api/v1/machines/:id', () => current())
    .on('POST', '/api/v1/machines/:id/pool-size-check', (c) => {
      const b = c.body as { pool_memory_gib: number; pool_cpus: number };
      return check(b.pool_memory_gib, b.pool_cpus, { mem: state.mem, cpus: state.cpus });
    })
    .on('PATCH', '/api/v1/machines/:id', async (c) => {
      const b = c.body as { pool_memory_gib?: number; pool_cpus?: number };
      if (hold) await new Promise(() => undefined);
      await new Promise((r) => setTimeout(r, 300));
      if (b.pool_memory_gib) state.mem = b.pool_memory_gib;
      if (b.pool_cpus) state.cpus = b.pool_cpus;
      return current();
    });
}
