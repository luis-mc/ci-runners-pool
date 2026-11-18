// R5.23: runners listed live with their isolation word (UX-61), added only where the OS fits, and deleted
// after a question that names the runner and its job.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FakeEventSource,
  machine,
  renderApp,
  runner,
  signedIn,
  viewer,
} from '../../testing/mock';
import { currentJobText, isolationText, runnerStatus, stateCounts } from './Runners';
import { machineSupports, runnerKind } from './AddRunners';

afterEach(cleanup);

const job = {
  id: 9,
  repository: 'octo/app',
  run_id: 1,
  run_attempt: 1,
  github_job_id: 1,
  job_name: 'e2e',
  labels: [],
  state: 'running' as const,
};

describe('isolationText (UX-61)', () => {
  it('names each isolation, and says a persistent runner keeps its state', () => {
    expect(isolationText({ isolation: 'microVM', keeps_state: false })).toBe('microVM');
    expect(isolationText({ isolation: 'VM', keeps_state: false })).toBe('VM');
    expect(isolationText({ isolation: 'container', keeps_state: false })).toBe(
      'container',
    );
    expect(isolationText({ isolation: 'persistent', keeps_state: true })).toBe(
      'persistent, state kept between jobs',
    );
  });
});

describe('Runners list', () => {
  it('shows isolation, labels, state word and the current job', async () => {
    const api = signedIn().on('GET', '/api/v1/runners', {
      items: [
        runner({ state: 'busy', current_job: job }),
        runner({
          id: 'r2',
          name: 'crsp-lx-2',
          isolation: 'container',
          keeps_state: false,
          backend: 'docker',
          labels: ['linux', 'x64'],
        }),
      ],
    });
    renderApp(api, '/pool/runners');
    const table = await screen.findByRole('table', { name: /^Runners on/ });
    expect(within(table).getByText('persistent, state kept between jobs')).toBeTruthy();
    expect(within(table).getByText('container')).toBeTruthy();
    expect(within(table).getByText('busy')).toBeTruthy();
    expect(within(table).getByText('octo/app e2e')).toBeTruthy();
    expect(within(table).getByText('idle')).toBeTruthy();
  });

  it('shows why a runner failed', async () => {
    const api = signedIn().on('GET', '/api/v1/runners', {
      items: [
        runner({
          state: 'failed',
          failed_reason:
            'register service: the account has no right to log on as a service',
        }),
      ],
    });
    renderApp(api, '/pool/runners');
    const table = await screen.findByRole('table', { name: /^Runners on/ });
    expect(
      within(table).getByText(/the account has no right to log on as a service/),
    ).toBeTruthy();
  });

  it('reloads when a runner event arrives (live)', async () => {
    let n = 0;
    const api = signedIn().on('GET', '/api/v1/runners', () => {
      n += 1;
      return {
        items: n === 1 ? [runner()] : [runner(), runner({ id: 'r2', name: 'crsp-new' })],
      };
    });
    renderApp(api, '/pool/runners');
    await screen.findByText('crsp-linux-1');
    act(() =>
      FakeEventSource.latest().emit({
        id: '1',
        type: 'runner.state',
        at: 'x',
        runner: runner({ id: 'r2' }),
      }),
    );
    expect(await screen.findByText('crsp-new')).toBeTruthy();
  });

  it('filters by isolation', async () => {
    const api = signedIn().on('GET', '/api/v1/runners', {
      items: [
        runner(),
        runner({
          id: 'r2',
          name: 'crsp-lx-2',
          isolation: 'container',
          keeps_state: false,
        }),
      ],
    });
    renderApp(api, '/pool/runners');
    await screen.findByRole('table', { name: /^Runners on/ });
    fireEvent.click(screen.getByRole('button', { name: 'container' }));
    expect(screen.queryByText('crsp-linux-1')).toBeNull();
    expect(screen.getByText('crsp-lx-2')).toBeTruthy();
  });

  it('says what to do when there is no runner', async () => {
    renderApp(signedIn().on('GET', '/api/v1/runners', { items: [] }), '/pool/runners');
    expect(
      await screen.findByText('No runners yet. Use Add runners at the top to start.'),
    ).toBeTruthy();
    // One Add runners action, in the header; the h1 stays; the empty state sits in a pane.
    expect(screen.getAllByRole('button', { name: 'Add runners' }).length).toBe(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Runners' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Runners' })).toBeTruthy();
  });

  it('selects all shown runners and clears the selection (UX-12)', async () => {
    renderApp(
      signedIn().on('GET', '/api/v1/runners', {
        items: [runner(), runner({ id: 'r2', name: 'crsp-2' })],
      }),
      '/pool/runners',
    );
    const all = await screen.findByRole('button', { name: 'Select all 2' });
    expect(screen.getByRole('region', { name: 'Runners' })).toBeTruthy();
    fireEvent.click(all);
    expect(await screen.findByText('2 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.queryByText('2 selected')).toBeNull());
  });

  it('deletes after a question that names each runner and the job it runs (UX-62)', async () => {
    const api = signedIn()
      .on('GET', '/api/v1/runners', {
        items: [runner({ state: 'busy', current_job: job })],
      })
      .on('DELETE', '/api/v1/runners/:id', runner());
    renderApp(api, '/pool/runners');
    await screen.findByRole('table', { name: /^Runners on/ });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select crsp-linux-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1 runner' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete these runners?' });
    expect(within(dialog).getByText('Runner crsp-linux-1')).toBeTruthy();
    expect(within(dialog).getByText('octo/app e2e')).toBeTruthy();
    expect(api.count('DELETE', '/api/v1/runners/r1')).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.count('DELETE', '/api/v1/runners/r1')).toBe(1));
    expect(api.calls.find((c) => c.method === 'DELETE')?.query.get('confirm')).toBe(
      'true',
    );
  });

  it('replaces a runner the pool does not manage, after a question', async () => {
    const api = signedIn()
      .on('GET', '/api/v1/runners', { items: [runner({ managed: false })] })
      .on('POST', '/api/v1/runners/:id/replace', {
        id: 'rp1',
        area: 'runners',
        state: 'planned',
        created_at: 'x',
        created_by: 'octo',
        steps: [
          {
            id: 's1',
            action: 'add_runner',
            text: 'Add',
            needs_yes: false,
            state: 'planned',
          },
        ],
      })
      .on('POST', '/api/v1/runner-plans/:id/apply', {
        id: 'rp1',
        area: 'runners',
        state: 'applying',
        created_at: 'x',
        created_by: 'octo',
        steps: [],
      });
    renderApp(api, '/pool/runners');
    await screen.findByRole('table', { name: /^Runners on/ });
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace crsp-linux-1?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace' }));
    await waitFor(() =>
      expect(api.count('POST', '/api/v1/runner-plans/rp1/apply')).toBe(1),
    );
  });

  it('deletes the registration of an offline runner after a yes that names it (R5.33)', async () => {
    const api = signedIn()
      .on('GET', '/api/v1/runners', {
        items: [
          runner({ id: 'r9', name: 'crsp-gone-1', state: 'offline', managed: true }),
        ],
      })
      .on('DELETE', '/api/v1/runners/:id/registration', runner({ id: 'r9' }));
    renderApp(api, '/pool/runners');
    await screen.findByRole('table', { name: /^Runners on/ });
    fireEvent.click(screen.getByRole('button', { name: 'Delete registration' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete crsp-gone-1?' });
    expect(api.count('DELETE', '/api/v1/runners/r9/registration')).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete registration' }));
    await waitFor(() =>
      expect(api.count('DELETE', '/api/v1/runners/r9/registration')).toBe(1),
    );
  });

  it('keeps a viewer from adding or deleting, and says why', async () => {
    renderApp(
      signedIn(viewer).on('GET', '/api/v1/runners', { items: [runner()] }),
      '/pool/runners',
    );
    const add = await screen.findByRole<HTMLButtonElement>('button', {
      name: 'Add runners',
    });
    expect(add.disabled).toBe(true);
  });
});

describe('Add runners', () => {
  it('greys machines that do not run the chosen system, with the reason (UX-38)', async () => {
    const api = signedIn()
      .on('GET', '/api/v1/machines', {
        items: [machine(), machine({ id: 'm2', name: 'win-1', os: 'windows' })],
      })
      .on('GET', '/api/v1/github/repositories', { items: [], stale: { stale: false } });
    renderApp(api, '/pool/runners/add');
    await screen.findByRole('group', { name: 'Add runners' });
    const win = await screen.findByRole('radio', { name: /win-1/ });
    expect((win as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('This machine runs windows, not linux.')).toBeTruthy();
  });

  it('offers Linux on a Windows machine whose engine runs Linux containers (R5.47)', async () => {
    const api = signedIn()
      .on('GET', '/api/v1/machines', {
        items: [
          machine({ id: 'm2', name: 'win-1', os: 'windows', container_os: 'linux' }),
          machine({ id: 'm3', name: 'win-2', os: 'windows' }),
        ],
      })
      .on('GET', '/api/v1/github/repositories', { items: [], stale: { stale: false } });
    renderApp(api, '/pool/runners/add');
    await screen.findByRole('group', { name: 'Add runners' });
    const ok = await screen.findByRole('radio', { name: /win-1/ });
    expect((ok as HTMLInputElement).disabled).toBe(false);
    const no = await screen.findByRole<HTMLInputElement>('radio', { name: /win-2/ });
    expect(no.disabled).toBe(true);
    expect(screen.getByText('This machine runs windows, not linux.')).toBeTruthy();
    expect(
      screen.getByText(/Linux runners on this Windows machine run in containers/),
    ).toBeTruthy();
  });

  it('asks for an ephemeral container runner only across systems', () => {
    const win = machine({ os: 'windows', container_os: 'linux' });
    expect(machineSupports(win, 'linux')).toBe(true);
    expect(machineSupports(win, 'windows')).toBe(true);
    expect(machineSupports(machine({ os: 'windows' }), 'linux')).toBe(false);
    expect(
      machineSupports(machine({ os: 'windows', container_os: 'windows' }), 'linux'),
    ).toBe(false);
    expect(runnerKind(win, 'linux')).toBe('ephemeral');
    expect(runnerKind(win, 'windows')).toBe('persistent');
    expect(runnerKind(machine(), 'linux')).toBe('persistent');
  });
});

describe('Idle and busy at a glance (RES7)', () => {
  const now = Date.parse('2026-11-15T12:10:00Z');

  it('names the state as idle or busy', () => {
    expect(runnerStatus(runner({ state: 'idle' }))).toEqual({ kind: 'ok', word: 'idle' });
    expect(runnerStatus(runner({ state: 'busy' }))).toEqual({
      kind: 'running',
      word: 'busy',
    });
  });

  it('gives the running job with its repository and elapsed time', () => {
    const r = runner({
      state: 'busy',
      current_job: { ...job, started_at: '2026-11-15T12:05:48Z' },
    });
    expect(currentJobText(r, now)).toBe('octo/app e2e, running 4 min 12 s');
    expect(currentJobText(runner({ state: 'idle' }), now)).toBe('none');
    expect(currentJobText(runner({ state: 'busy', current_job: job }), now)).toBe(
      'octo/app e2e',
    );
  });

  it('counts idle, busy and the rest', () => {
    const items = [
      runner({ state: 'idle' }),
      runner({ id: 'r2', state: 'busy' }),
      runner({ id: 'r3', state: 'busy' }),
      runner({ id: 'r4', state: 'offline' }),
    ];
    expect(stateCounts(items)).toEqual({ idle: 1, busy: 2, other: 1 });
  });

  it('shows the counts above the table', async () => {
    const api = signedIn().on('GET', '/api/v1/runners', {
      items: [runner({ state: 'busy', current_job: job }), runner({ id: 'r2' })],
    });
    renderApp(api, '/pool/runners');
    await screen.findByRole('table', { name: /^Runners on/ });
    expect(screen.getByText('Idle')).toBeTruthy();
    expect(screen.getByText('Busy')).toBeTruthy();
  });
});

describe('Runners list truth (UX-1, UX-6, UX-19)', () => {
  it('links the machine name to the machine page', async () => {
    const api = signedIn().on('GET', '/api/v1/runners', {
      items: [runner({ machine_id: 'm9', machine_name: 'GameRoomPC' })],
    });
    renderApp(api, '/pool/runners');
    const table = await screen.findByRole('table', { name: 'Runners on GameRoomPC' });
    const link = screen.getByText('Open GameRoomPC').closest('a');
    expect(link?.getAttribute('href')).toBe('/pool/machines/m9');
    expect(within(table).queryByText('m9')).toBeNull();
  });

  it('shows the real state word with its reason', async () => {
    const api = signedIn().on('GET', '/api/v1/runners', {
      items: [
        runner({
          state: 'not_registered',
          reason: 'GitHub does not list a runner with this name',
        }),
        runner({
          id: 'r2',
          name: 'b',
          state: 'stopped',
          reason: 'its service is stopped',
        }),
      ],
    });
    renderApp(api, '/pool/runners');
    const table = await screen.findByRole('table', { name: /^Runners on/ });
    expect(within(table).getByText('not registered')).toBeTruthy();
    expect(
      within(table).getByText('GitHub does not list a runner with this name'),
    ).toBeTruthy();
    expect(within(table).getByText('stopped')).toBeTruthy();
    expect(within(table).queryByText('idle')).toBeNull();
    expect(runnerStatus(runner({ state: 'unknown' })).word).toBe('unknown');
  });

  it('offers Remove on a failed runner and asks first', async () => {
    const api = signedIn()
      .on('GET', '/api/v1/runners', {
        items: [
          runner({ state: 'failed', reason: 'the service did not start' }),
          runner({ id: 'r2', name: 'fine' }),
        ],
      })
      .on('DELETE', '/api/v1/runners/:id', runner({ state: 'draining' }));
    renderApp(api, '/pool/runners');
    const table = await screen.findByRole('table', { name: /^Runners on/ });
    expect(within(table).getByText('the service did not start')).toBeTruthy();
    expect(within(table).getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    fireEvent.click(within(table).getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete these runners?' });
    expect(within(dialog).getByText('Runner crsp-linux-1')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.count('DELETE', '/api/v1/runners/r1')).toBe(1));
  });
});
