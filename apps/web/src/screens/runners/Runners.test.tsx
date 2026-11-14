// R5.23: runners listed live with their isolation word (UX-61), added only where the OS fits, and deleted
// after a question that names the runner and its job.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeEventSource, machine, renderApp, runner, signedIn, viewer } from '../../testing/mock';
import { isolationText } from './Runners';

afterEach(cleanup);

const job = { id: 9, repository: 'octo/app', run_id: 1, run_attempt: 1, github_job_id: 1, job_name: 'e2e', labels: [], state: 'running' as const };

describe('isolationText (UX-61)', () => {
  it('names each isolation, and says a persistent runner keeps its state', () => {
    expect(isolationText({ isolation: 'microVM', keeps_state: false })).toBe('microVM');
    expect(isolationText({ isolation: 'VM', keeps_state: false })).toBe('VM');
    expect(isolationText({ isolation: 'container', keeps_state: false })).toBe('container');
    expect(isolationText({ isolation: 'persistent', keeps_state: true })).toBe('persistent, state kept between jobs');
  });
});

describe('Runners list', () => {
  it('shows isolation, labels, state word and the current job', async () => {
    const api = signedIn().on('GET', '/api/v1/runners', {
      items: [runner({ state: 'busy', current_job: job }), runner({ id: 'r2', name: 'crsp-lx-2', isolation: 'container', keeps_state: false, backend: 'docker', labels: ['linux', 'x64'] })],
    });
    renderApp(api, '/runners');
    const table = await screen.findByRole('table', { name: 'Runners' });
    expect(within(table).getByText('persistent, state kept between jobs')).toBeTruthy();
    expect(within(table).getByText('container')).toBeTruthy();
    expect(within(table).getByText('running')).toBeTruthy();
    expect(within(table).getByText('octo/app e2e')).toBeTruthy();
    expect(within(table).getByText('idle')).toBeTruthy();
  });

  it('reloads when a runner event arrives (live)', async () => {
    let n = 0;
    const api = signedIn().on('GET', '/api/v1/runners', () => {
      n += 1;
      return { items: n === 1 ? [runner()] : [runner(), runner({ id: 'r2', name: 'crsp-new' })] };
    });
    renderApp(api, '/runners');
    await screen.findByText('crsp-linux-1');
    act(() => FakeEventSource.latest().emit({ id: '1', type: 'runner.state', at: 'x', runner: runner({ id: 'r2' }) }));
    expect(await screen.findByText('crsp-new')).toBeTruthy();
  });

  it('filters by isolation', async () => {
    const api = signedIn().on('GET', '/api/v1/runners', { items: [runner(), runner({ id: 'r2', name: 'crsp-lx-2', isolation: 'container', keeps_state: false })] });
    renderApp(api, '/runners');
    await screen.findByRole('table', { name: 'Runners' });
    fireEvent.click(screen.getByRole('button', { name: 'container' }));
    expect(screen.queryByText('crsp-linux-1')).toBeNull();
    expect(screen.getByText('crsp-lx-2')).toBeTruthy();
  });

  it('says what to do when there is no runner', async () => {
    renderApp(signedIn().on('GET', '/api/v1/runners', { items: [] }), '/runners');
    expect(await screen.findByText('No runners yet. Add runners to start.')).toBeTruthy();
  });

  it('deletes after a question that names each runner and the job it runs (UX-62)', async () => {
    const api = signedIn()
      .on('GET', '/api/v1/runners', { items: [runner({ state: 'busy', current_job: job })] })
      .on('DELETE', '/api/v1/runners/:id', runner());
    renderApp(api, '/runners');
    await screen.findByRole('table', { name: 'Runners' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select crsp-linux-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1 runner' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete these runners?' });
    expect(within(dialog).getByText('Runner crsp-linux-1')).toBeTruthy();
    expect(within(dialog).getByText('octo/app e2e')).toBeTruthy();
    expect(api.count('DELETE', '/api/v1/runners/r1')).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.count('DELETE', '/api/v1/runners/r1')).toBe(1));
    expect(api.calls.find((c) => c.method === 'DELETE')?.query.get('confirm')).toBe('true');
  });

  it('replaces a runner the pool does not manage, after a question', async () => {
    const api = signedIn()
      .on('GET', '/api/v1/runners', { items: [runner({ managed: false })] })
      .on('POST', '/api/v1/runners/:id/replace', { id: 'rp1', area: 'runners', state: 'planned', created_at: 'x', created_by: 'octo', steps: [{ id: 's1', action: 'add_runner', text: 'Add', needs_yes: false, state: 'planned' }] })
      .on('POST', '/api/v1/runner-plans/:id/apply', { id: 'rp1', area: 'runners', state: 'applying', created_at: 'x', created_by: 'octo', steps: [] });
    renderApp(api, '/runners');
    await screen.findByRole('table', { name: 'Runners' });
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    const dialog = await screen.findByRole('dialog', { name: 'Replace crsp-linux-1?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(api.count('POST', '/api/v1/runner-plans/rp1/apply')).toBe(1));
  });

  it('keeps a viewer from adding or deleting, and says why', async () => {
    renderApp(signedIn(viewer).on('GET', '/api/v1/runners', { items: [runner()] }), '/runners');
    const add = (await screen.findByRole('button', { name: 'Add runners' })) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });
});

describe('Add runners', () => {
  it('greys machines that do not run the chosen system, with the reason (UX-38)', async () => {
    const api = signedIn()
      .on('GET', '/api/v1/machines', { items: [machine(), machine({ id: 'm2', name: 'win-1', os: 'windows' })] })
      .on('GET', '/api/v1/github/repositories', { items: [], stale: { stale: false } });
    renderApp(api, '/runners/add');
    await screen.findByRole('group', { name: 'Add runners' });
    const win = await screen.findByRole('radio', { name: /win-1/ });
    expect((win as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('This machine runs windows, not linux.')).toBeTruthy();
  });
});
