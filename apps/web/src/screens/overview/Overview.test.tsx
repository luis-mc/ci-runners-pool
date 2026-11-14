// R5.20: the overview shows machines with load bars, the queue, the running jobs, live; it has no command.
import { act, cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeEventSource, apiError, machine, overview, renderApp, signedIn } from '../../testing/mock';

afterEach(cleanup);

describe('Overview (R5.20)', () => {
  it('shows a card per machine with a state word and three level bars', async () => {
    renderApp(signedIn(), '/');
    const card = await screen.findByRole('region', { name: 'build-1' });
    expect(within(card).getByText('online')).toBeTruthy();
    expect(within(card).getByRole('meter', { name: 'Memory' }).getAttribute('aria-valuetext')).toBe('40% of 80%');
    expect(within(card).getByRole('meter', { name: 'CPU' })).toBeTruthy();
    expect(within(card).getByRole('meter', { name: 'Slots' }).getAttribute('aria-valuetext')).toBe('1 of 4');
    expect(within(card).getByRole('link', { name: 'build-1' }).getAttribute('href')).toBe('/machines/m1');
  });

  it('names an offline machine with a word, not only a colour (UX-58)', async () => {
    const api = signedIn().on('GET', '/api/v1/overview', overview({ machines: [machine({ online: false })] }));
    renderApp(api, '/');
    const card = await screen.findByRole('region', { name: 'build-1' });
    expect(within(card).getByText('offline')).toBeTruthy();
    expect(card.textContent).toContain('✕');
  });

  it('follows the live stream: load, queue and running jobs', async () => {
    renderApp(signedIn(), '/');
    await screen.findByRole('region', { name: 'build-1' });
    const es = FakeEventSource.latest();
    act(() => es.emit({ id: '1', type: 'snapshot', at: 'x', snapshot: overview() }));
    const job = { id: 5, repository: 'octo/app', run_id: 1, run_attempt: 1, github_job_id: 1, job_name: 'unit tests', labels: [], state: 'queued' as const };
    act(() => es.emit({ id: '2', type: 'job.queued', at: 'x', job }));
    expect(await screen.findByText('Queued jobs')).toBeTruthy();
    expect(screen.getByText('Queued jobs').nextElementSibling?.textContent).toBe('1');
    act(() => es.emit({ id: '3', type: 'job.started', at: 'x', job: { ...job, state: 'running', runner_name: 'crsp-linux-1' } }));
    expect(await screen.findByText('unit tests')).toBeTruthy();
    act(() =>
      es.emit({
        id: '4',
        type: 'machine.load',
        at: 'x',
        load: { machine_id: 'm1', load: { memory_pct: 60, memory_known: true, cpu_known: false, sampled_at: 'x', stale: false }, slots_used: 2 },
      }),
    );
    const card = screen.getByRole('region', { name: 'build-1' });
    expect(within(card).getByRole('meter', { name: 'Memory' }).getAttribute('aria-valuetext')).toBe('60% of 80%');
  });

  it('says what to do when there is no machine yet', async () => {
    const api = signedIn().on('GET', '/api/v1/overview', overview({ machines: [] }));
    renderApp(api, '/');
    expect(await screen.findByText('No machines yet. Add a machine to start.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Machines' })).toBeTruthy();
  });

  it('has no command button (UX-52)', async () => {
    renderApp(signedIn(), '/');
    await screen.findByRole('region', { name: 'build-1' });
    const main = screen.getByRole('main');
    expect(within(main).queryAllByRole('button')).toHaveLength(0);
  });

  it('says it could not load when the controller does not answer', async () => {
    const api = signedIn().on('GET', '/api/v1/overview', () => apiError(503, 'unavailable', 'The controller is starting.'));
    renderApp(api, '/', { stream: false });
    expect(await screen.findByText(/Could not load the overview/)).toBeTruthy();
  });
});
