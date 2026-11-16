// R5.22: the machines screen lists machines, edits budget and slots, drains, resumes and removes.
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { apiError, machine, renderApp, signedIn, viewer } from '../../testing/mock';

afterEach(cleanup);

const running = [
  {
    id: 9,
    repository: 'octo/app',
    run_id: 1,
    run_attempt: 1,
    github_job_id: 1,
    job_name: 'e2e',
    labels: [],
    state: 'running' as const,
  },
];

describe('Machines list', () => {
  it('lists machines with state word, backends, load and slots', async () => {
    const api = signedIn().on('GET', '/api/v1/machines', {
      items: [
        machine(),
        machine({ id: 'm2', name: 'win-1', os: 'windows', online: false }),
      ],
    });
    renderApp(api, '/machines');
    const table = await screen.findByRole('table', { name: 'Machines' });
    expect(within(table).getByText('online')).toBeTruthy();
    expect(within(table).getByText('offline')).toBeTruthy();
    expect(within(table).getAllByText('1 of 4').length).toBe(2);
    expect(within(table).getAllByText('docker').length).toBe(2);
    expect(within(table).getAllByText(/memory 40%, CPU 20%/).length).toBe(2);
  });

  it('says "Windows, runs Linux containers" for a Windows machine with Linux containers', async () => {
    const api = signedIn().on('GET', '/api/v1/machines', {
      items: [machine({ id: 'm2', name: 'win-1', os: 'windows', container_os: 'linux' })],
    });
    renderApp(api, '/machines');
    const table = await screen.findByRole('table', { name: 'Machines' });
    expect(within(table).getByText('Windows, runs Linux containers')).toBeTruthy();
  });

  it('searches and filters, and says how many are hidden', async () => {
    const api = signedIn().on('GET', '/api/v1/machines', {
      items: [machine(), machine({ id: 'm2', name: 'win-1', state: 'drained' })],
    });
    renderApp(api, '/machines');
    await screen.findByRole('table', { name: 'Machines' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Search machines' }), {
      target: { value: 'win' },
    });
    expect(screen.queryByRole('link', { name: 'build-1' })).toBeNull();
    expect(screen.getByRole('link', { name: 'win-1' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search machines' }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText(/2 machines are hidden/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Search machines' }).value,
    ).toBe('');
  });

  it('says what to do when there is none, and offers Add a machine to an admin', async () => {
    renderApp(signedIn().on('GET', '/api/v1/machines', { items: [] }), '/machines');
    expect(
      await screen.findByText('No machines yet. Add a machine to start.'),
    ).toBeTruthy();
    expect(
      screen.getAllByRole('button', { name: 'Add a machine' }).length,
    ).toBeGreaterThan(0);
  });

  it('shows Add a machine disabled with its reason to a viewer (UX-38)', async () => {
    renderApp(
      signedIn(viewer).on('GET', '/api/v1/machines', { items: [machine()] }),
      '/machines',
    );
    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: 'Add a machine',
    });
    expect(button.disabled).toBe(true);
    expect(screen.getByText('Only an admin can do this.')).toBeTruthy();
  });

  it('says could not load, why and what next', async () => {
    renderApp(
      signedIn().on('GET', '/api/v1/machines', () =>
        apiError(503, 'unavailable', 'The database is busy.'),
      ),
      '/machines',
    );
    expect(await screen.findByText(/Could not load machines\./)).toBeTruthy();
    expect(screen.getByText(/The database is busy\. Try again\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('Machine detail', () => {
  const base = () =>
    signedIn().on('GET', '/api/v1/machines/:id', machine({ running_jobs: running }));

  it('shows facts, backends and the budget', async () => {
    renderApp(base(), '/machines/m1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'build-1' }),
    ).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /docker/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Memory budget/ }).textContent).toContain(
      '80%',
    );
  });

  it('writes the reason a backend cannot be used once, not twice', async () => {
    const why = 'WSL is installed but not ready; run wsl --install';
    const api = signedIn().on(
      'GET',
      '/api/v1/machines/:id',
      machine({
        backends: [
          { name: 'wsl2', present: true, usable: false, allowed: false, reason: why },
        ],
      }),
    );
    renderApp(api, '/machines/m1');
    await screen.findByRole('heading', { level: 1, name: 'build-1' });
    expect(await screen.findAllByText(why)).toHaveLength(1);
  });

  it('asks before a drain, names the running jobs, and drains on yes (UX-62)', async () => {
    const api = base().on('POST', '/api/v1/machines/:id/drain', {
      id: 'c1',
      machine_id: 'm1',
      kind: 'drain',
      state: 'waiting',
      started_at: 'x',
      waiting_for: [],
    });
    renderApp(api, '/machines/m1');
    fireEvent.click(await screen.findByRole('button', { name: 'Drain' }));
    const dialog = await screen.findByRole('dialog', { name: 'Drain build-1?' });
    expect(within(dialog).getByText('octo/app e2e')).toBeTruthy();
    expect(api.count('POST', '/api/v1/machines/m1/drain')).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Drain' }));
    await waitFor(() => expect(api.count('POST', '/api/v1/machines/m1/drain')).toBe(1));
  });

  it('does nothing when the question is cancelled', async () => {
    const api = base();
    renderApp(api, '/machines/m1');
    fireEvent.click(await screen.findByRole('button', { name: 'Drain' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.count('POST', '/api/v1/machines/m1/drain')).toBe(0);
  });

  it('removes a machine only after the question names it, its runners and its jobs', async () => {
    const api = base()
      .on('DELETE', '/api/v1/machines/:id', {
        id: 'c2',
        machine_id: 'm1',
        kind: 'remove',
        state: 'waiting',
        started_at: 'x',
        waiting_for: [],
      })
      .on('GET', '/api/v1/machines', { items: [] });
    renderApp(api, '/machines/m1');
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove build-1?' });
    expect(within(dialog).getByText('Machine build-1')).toBeTruthy();
    expect(within(dialog).getByText('Its runners')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.count('DELETE', '/api/v1/machines/m1')).toBe(1));
    expect(api.calls.find((c) => c.method === 'DELETE')?.query.get('confirm')).toBe(
      'true',
    );
  });

  it('shows Resume for a drained machine and resumes without a question', async () => {
    const api = signedIn()
      .on('GET', '/api/v1/machines/:id', machine({ state: 'drained' }))
      .on('POST', '/api/v1/machines/:id/resume', machine());
    renderApp(api, '/machines/m1');
    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(api.count('POST', '/api/v1/machines/m1/resume')).toBe(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves the budget, and asks first when runners restart', async () => {
    let first = true;
    const api = base().on('PATCH', '/api/v1/machines/:id', () => {
      if (first) {
        first = false;
        return apiError(409, 'needs_confirmation', 'Runners restart.', [
          { kind: 'job', id: '9', text: 'octo/app e2e' },
        ]);
      }
      return machine();
    });
    renderApp(api, '/machines/m1');
    await screen.findByRole('heading', { name: 'build-1' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save these settings?' });
    expect(within(dialog).getByText('octo/app e2e')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.count('PATCH', '/api/v1/machines/m1')).toBe(2));
    const last = api.calls.filter((c) => c.method === 'PATCH').pop()?.body as {
      confirm?: boolean;
      budget_memory_pct: number;
    };
    expect(last.confirm).toBe(true);
    expect(last.budget_memory_pct).toBe(80);
  });

  it('shows the viewer the form with Save disabled and why', async () => {
    renderApp(
      signedIn(viewer).on('GET', '/api/v1/machines/:id', machine()),
      '/machines/m1',
    );
    await screen.findByRole('heading', { name: 'build-1' });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(
      true,
    );
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Drain' }).disabled,
    ).toBe(true);
  });
});

describe('Machine detail, a drain that waits', () => {
  it('names the job that holds the drain, how long it runs, and what to do when it is far past its usual time', async () => {
    const job = {
      id: 9,
      github_job_id: 9,
      job_name: 'build',
      repository: 'octo/app',
      run_id: 7,
      run_attempt: 1,
      labels: [],
      state: 'running' as const,
      runner_name: 'runner-1',
    };
    const api = signedIn().on(
      'GET',
      '/api/v1/machines/:id',
      machine({
        state: 'draining',
        pending_change: {
          id: 'c1',
          machine_id: 'm1',
          kind: 'drain',
          state: 'waiting',
          started_at: 'x',
          waiting_for: [job],
          holder: { job, running_seconds: 2700, usual_seconds: 600, over_usual: true },
          choices: ['wait_longer', 'cancel'],
        },
      }),
    );
    renderApp(api, '/machines/m1');
    expect(await screen.findByText('octo/app build on runner-1')).toBeTruthy();
    expect(screen.getByText('45 min')).toBeTruthy();
    expect(screen.getByText('10 min')).toBeTruthy();
    expect(screen.getByText(/never stops a job/)).toBeTruthy();
  });
});

// machines R5.58: the pool size form is a wizard with a Review step that shows the budget check.
describe('Machine detail, the pool size', () => {
  const fits = {
    known: true,
    ok: true,
    needs_shrink_confirm: false,
    nearest: [],
    total_gib: 32,
    used_outside_gib: 8,
    memory_budget_gib: 27.2,
    room_gib: 19.2,
    cpu_budget: 4,
    decided: 'fits',
    current_memory_gib: 0,
    current_cpus: 0,
  };

  /** Type a value on the number keypad of a field (the first key replaces the value). */
  async function typeNumber(field: RegExp, keys: string[]) {
    fireEvent.click(await screen.findByRole('button', { name: field }));
    const dialog = await screen.findByRole('dialog');
    for (const k of keys)
      fireEvent.click(within(dialog).getByRole('button', { name: k }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  }

  /** The step bar also has a Review button; the one that acts is in the action bar. */
  const review = () =>
    screen
      .getAllByRole('button', { name: 'Review' })
      .find((b) => b.closest('.ds-action-bar')) as HTMLButtonElement;

  const api = (check: Record<string, unknown>, m = machine()) =>
    signedIn()
      .on('GET', '/api/v1/machines/:id', m)
      .on('POST', '/api/v1/machines/:id/pool-size-check', check)
      .on('PATCH', '/api/v1/machines/:id', m);

  it('shows the current size, reviews the check, then saves (UX-30)', async () => {
    const a = api(fits);
    renderApp(a, '/machines/m1');
    await screen.findByRole('group', { name: 'Pool size' });
    expect(await screen.findByText('not set')).toBeTruthy();
    expect(await screen.findByText('Room for the pool')).toBeTruthy();
    await typeNumber(/Pool memory/, ['1', '6', '.', '5']);
    await typeNumber(/Pool CPUs/, ['4']);
    fireEvent.click(review());
    expect(
      await screen.findByText(/This size fits the budget of the machine/),
    ).toBeTruthy();
    expect(screen.getByText('Room for the pool')).toBeTruthy();
    expect(screen.getByText(/Nothing has changed yet/)).toBeTruthy();
    expect(a.count('PATCH', '/api/v1/machines/m1')).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save 16.5 GiB and 4 CPUs' }));
    expect(await screen.findByText(/The pool size is/)).toBeTruthy();
    const patch = a.calls.find((c) => c.method === 'PATCH')?.body as Record<
      string,
      unknown
    >;
    expect(patch).toEqual({ pool_memory_gib: 16.5, pool_cpus: 4 });
  });

  it('names the budget that is short and the nearest size, and does not let the size be saved', async () => {
    const a = api({
      ...fits,
      ok: false,
      reason: '30 GiB is above the memory room',
      short: 'memory',
      nearest: ['19 GiB fits 4 CPUs'],
    });
    renderApp(a, '/machines/m1');
    await screen.findByRole('group', { name: 'Pool size' });
    await typeNumber(/Pool memory/, ['3', '0']);
    fireEvent.click(review());
    expect(await screen.findByText(/does not fit the budget/)).toBeTruthy();
    expect(screen.getByText('19 GiB fits 4 CPUs')).toBeTruthy();
    const save = screen.getByRole('button', { name: /Save 30 GiB/ });
    expect(
      save.getAttribute('aria-disabled') === 'true' ||
        (save as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      screen.getByText('This size does not fit. Go back and change it.'),
    ).toBeTruthy();
    expect(a.count('PATCH', '/api/v1/machines/m1')).toBe(0);
  });

  it('needs its own yes to lower the size and sends confirm_shrink (R5.58)', async () => {
    const m = machine({
      settings: { ...machine().settings, pool_memory_gib: 16, pool_cpus: 4 },
    });
    const a = api(
      { ...fits, needs_shrink_confirm: true, current_memory_gib: 16, current_cpus: 4 },
      m,
    );
    renderApp(a, '/machines/m1');
    await screen.findByRole('group', { name: 'Pool size' });
    await typeNumber(/Pool memory/, ['8']);
    fireEvent.click(review());
    expect(await screen.findByText(/This lowers the pool size/)).toBeTruthy();
    expect(
      screen.getByText('Tick the box to confirm lowering the pool size.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Yes, lower the pool size' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save 8 GiB and 4 CPUs' }));
    await screen.findByText(/The pool size is/);
    expect(a.calls.find((c) => c.method === 'PATCH')?.body).toEqual({
      pool_memory_gib: 8,
      pool_cpus: 4,
      confirm_shrink: true,
    });
  });

  it('stops without saving when the size changed while it was reviewed', async () => {
    let n = 0;
    const a = signedIn()
      .on('GET', '/api/v1/machines/:id', machine())
      .on('POST', '/api/v1/machines/:id/pool-size-check', () =>
        ++n <= 2 ? fits : { ...fits, current_memory_gib: 12, current_cpus: 3 },
      )
      .on('PATCH', '/api/v1/machines/:id', machine());
    renderApp(a, '/machines/m1');
    await screen.findByRole('group', { name: 'Pool size' });
    await typeNumber(/Pool CPUs/, ['4']);
    fireEvent.click(review());
    fireEvent.click(await screen.findByRole('button', { name: /Save 4 GiB and 4 CPUs/ }));
    expect(await screen.findByText(/Stopped\. Nothing was saved/)).toBeTruthy();
    expect(a.count('PATCH', '/api/v1/machines/m1')).toBe(0);
  });

  it('lets a viewer read the form but not review it (UX-38)', async () => {
    renderApp(
      signedIn(viewer)
        .on('GET', '/api/v1/machines/:id', machine())
        .on('POST', '/api/v1/machines/:id/pool-size-check', fits),
      '/machines/m1',
    );
    await screen.findByRole('group', { name: 'Pool size' });
    await screen.findByRole('button', { name: /Pool memory/ });
    expect(review().disabled).toBe(true);
  });
});
