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
