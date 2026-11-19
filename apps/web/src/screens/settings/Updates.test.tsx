// operations R5.15, tray R5.15 to R5.18: the Automatic updates switch is on by default and saved at once; the
// Review step names the running jobs, says nothing has changed, and sends the yes (confirmed=true) only when the
// owner presses the primary.
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMING } from '../../timing';
import { renderApp, signedIn, viewer } from '../../testing/mock';

afterEach(cleanup);
beforeEach(() => {
  TIMING.planPollMs = 10;
});

const status = (extra: object = {}) => ({
  current_version: '1.4.0',
  latest_version: '1.5.0',
  update_available: true,
  state: 'idle',
  auto_update: true,
  running_jobs: [{ repository: 'octo/app', workflow: 'ci', run_id: 7, job: 'test' }],
  drain_timeout_minutes: 60,
  ...extra,
});

describe('Updates settings', () => {
  it('offers no update when the latest version is not newer than the running one (TRAY8)', async () => {
    renderApp(
      signedIn().on(
        'GET',
        '/api/v1/update',
        status({ current_version: '1.5.0', latest_version: '1.5.0' }),
      ),
      '/settings/updates',
    );
    await screen.findByRole('switch', { name: 'Automatic updates' });
    expect(screen.queryByRole('button', { name: /Update to/ })).toBeNull();
    expect(screen.queryByText(/is waiting for your yes/)).toBeNull();
  });

  it('shows Automatic updates on by default and the versions', async () => {
    renderApp(signedIn().on('GET', '/api/v1/update', status()), '/settings/updates');
    const sw = await screen.findByRole('switch', { name: 'Automatic updates' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('1.4.0')).toBeTruthy();
    expect(screen.getByText('1.5.0')).toBeTruthy();
    expect(
      screen.getByText(
        /installs a newer stable release by itself once the running jobs have ended/,
      ),
    ).toBeTruthy();
  });

  it('turns Automatic updates off and on, saved at once', async () => {
    const a = signedIn()
      .on('GET', '/api/v1/update', status())
      .on('PATCH', '/api/v1/settings', (c) => c.body);
    renderApp(a, '/settings/updates');
    const sw = await screen.findByRole('switch', { name: 'Automatic updates' });
    fireEvent.click(sw);
    await waitFor(() => expect(a.count('PATCH', '/api/v1/settings')).toBe(1));
    expect(a.calls.find((c) => c.method === 'PATCH')?.body).toEqual({
      auto_update: false,
    });
  });

  it('a viewer cannot change it and is told why', async () => {
    renderApp(
      signedIn(viewer).on('GET', '/api/v1/update', status()),
      '/settings/updates',
    );
    const sw = await screen.findByRole('switch', { name: 'Automatic updates' });
    expect((sw as HTMLButtonElement).disabled).toBe(true);
  });

  it('Look for updates asks the service to look', async () => {
    const a = signedIn()
      .on('GET', '/api/v1/update', status())
      .on('POST', '/api/v1/update/check', status());
    renderApp(a, '/settings/updates');
    fireEvent.click(await screen.findByRole('button', { name: 'Look for updates' }));
    await waitFor(() => expect(a.count('POST', '/api/v1/update/check')).toBe(1));
  });
});

describe('Review step', () => {
  it('names the running jobs and changes nothing until the yes (UX-62)', async () => {
    const a = signedIn()
      .on('GET', '/api/v1/update', status({ auto_update: false }))
      .on('POST', '/api/v1/update/apply', status({ state: 'waiting_for_jobs' }));
    renderApp(a, '/settings/updates/review?kind=update');
    expect(await screen.findByText(/Nothing has changed yet/)).toBeTruthy();
    expect(screen.getByText('octo/app ci, run 7, job test')).toBeTruthy();
    expect(screen.getByText(/No running job is stopped/)).toBeTruthy();
    expect(a.count('POST', '/api/v1/update/apply')).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Update to 1.5.0' }));
    await waitFor(() => expect(a.count('POST', '/api/v1/update/apply')).toBe(1));
    expect(
      a.calls.find((c) => c.path === '/api/v1/update/apply')?.query.get('confirmed'),
    ).toBe('true');
    expect(
      await screen.findByText(
        /Waiting for running jobs to end/,
        { selector: 'p' },
        { timeout: 5000 },
      ),
    ).toBeTruthy();
  });

  it('Restart the service also asks on the Review step and sends confirmed=true', async () => {
    const a = signedIn()
      .on('GET', '/api/v1/update', status({ update_available: false }))
      .on('POST', '/api/v1/service/restart', status({ state: 'waiting_for_jobs' }));
    renderApp(a, '/settings/updates/review?kind=restart');
    const group = await screen.findByRole('group', { name: 'Restart the service' });
    expect(await within(group).findByText(/Nothing has changed yet/)).toBeTruthy();
    fireEvent.click(within(group).getByRole('button', { name: 'Restart the service' }));
    await waitFor(() => expect(a.count('POST', '/api/v1/service/restart')).toBe(1));
    expect(
      a.calls.find((c) => c.path === '/api/v1/service/restart')?.query.get('confirmed'),
    ).toBe('true');
  });

  it('ends at Done with the new version once the service is back', async () => {
    let applied = false;
    const a = signedIn()
      .on('GET', '/api/v1/update', () =>
        applied
          ? status({
              current_version: '1.5.0',
              update_available: false,
              running_jobs: [],
            })
          : status(),
      )
      .on('POST', '/api/v1/update/apply', () => {
        applied = true;
        return status({ state: 'waiting_for_jobs' });
      });
    renderApp(a, '/settings/updates/review?kind=update');
    fireEvent.click(await screen.findByRole('button', { name: 'Update to 1.5.0' }));
    expect(await screen.findByText('The service runs 1.5.0.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Updates' })).toBeTruthy();
  });
});

describe('Update state words', () => {
  it('says which of the two idle cases is true', async () => {
    const waiting = signedIn().on('GET', '/api/v1/update', status());
    renderApp(waiting, '/settings/console');
    expect(await screen.findByText('Version 1.5.0 is waiting for your yes')).toBeTruthy();
    cleanup();
    const current = signedIn().on(
      'GET',
      '/api/v1/update',
      status({ update_available: false }),
    );
    renderApp(current, '/settings/console');
    expect(await screen.findByText('Up to date')).toBeTruthy();
  });
});
