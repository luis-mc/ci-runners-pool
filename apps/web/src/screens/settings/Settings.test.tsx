// R5.27, R5.28: settings sub-pages. The owner adds a user, changes a role, removes a user; there is one owner.
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { owner, renderApp, signedIn, viewer } from '../../testing/mock';

afterEach(cleanup);

const alice = {
  id: 3,
  login: 'alice',
  role: 'admin' as const,
  added_by: 'octo',
  added_at: '2026-11-03T09:00:00Z',
};

describe('Users and roles (R5.28)', () => {
  const api = () => signedIn().on('GET', '/api/v1/users', { items: [owner, alice] });

  it('lists users with role, added by and added at; the owner has no Remove', async () => {
    renderApp(api(), '/settings/users');
    const table = await screen.findByRole('table', { name: 'Users' });
    expect(within(table).getByText('alice')).toBeTruthy();
    expect(within(table).getByText('2026-11-03 09:00')).toBeTruthy();
    expect(within(table).getAllByRole('button', { name: 'Remove' })).toHaveLength(1);
    expect(within(table).getByText('The owner')).toBeTruthy();
  });

  it('adds a GitHub login with a role', async () => {
    const a = api().on('POST', '/api/v1/users', {
      id: 4,
      login: 'bob',
      role: 'viewer',
      added_at: 'x',
    });
    renderApp(a, '/settings/users');
    await screen.findByRole('table', { name: 'Users' });
    fireEvent.change(screen.getByRole('textbox', { name: 'GitHub login' }), {
      target: { value: 'bob' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(a.count('POST', '/api/v1/users')).toBe(1));
    expect(a.calls.find((c) => c.method === 'POST')?.body).toEqual({
      login: 'bob',
      role: 'viewer',
    });
  });

  it('shows the mistake when no login is written', async () => {
    renderApp(api(), '/settings/users');
    await screen.findByRole('table', { name: 'Users' });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Write the GitHub login to add.')).toBeTruthy();
  });

  it('changes a role', async () => {
    const a = api().on('PATCH', '/api/v1/users/:id', { ...alice, role: 'viewer' });
    renderApp(a, '/settings/users');
    await screen.findByRole('table', { name: 'Users' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit alice' });
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Viewer' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(a.count('PATCH', '/api/v1/users/3')).toBe(1));
    expect(a.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ role: 'viewer' });
  });

  it('removes a user only after a question that names the login (UX-62)', async () => {
    const a = api().on('DELETE', '/api/v1/users/:id', undefined);
    renderApp(a, '/settings/users');
    await screen.findByRole('table', { name: 'Users' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove alice?' });
    expect(within(dialog).getByText('User alice can no longer sign in.')).toBeTruthy();
    expect(a.count('DELETE', '/api/v1/users/3')).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(a.count('DELETE', '/api/v1/users/3')).toBe(1));
  });

  it('tells a non-owner that only the owner can change users', async () => {
    renderApp(signedIn(viewer), '/settings/users');
    expect(
      await screen.findByText(/Only the owner can see and change users/),
    ).toBeTruthy();
  });
});

describe('Appearance (UX-60)', () => {
  it('saves the theme at once and applies it', async () => {
    const a = signedIn().on('PUT', '/api/v1/me/preferences', (c) => c.body);
    renderApp(a, '/settings/appearance');
    const light = await screen.findByRole('radio', { name: 'Light' });
    fireEvent.click(light);
    await waitFor(() => expect(a.count('PUT', '/api/v1/me/preferences')).toBe(1));
    expect(a.calls.find((c) => c.method === 'PUT')?.body).toEqual({ theme: 'light' });
    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-theme')).toBe('light'),
    );
  });
});

describe('Retention and backups', () => {
  it('saves retention', async () => {
    const a = signedIn()
      .on('GET', '/api/v1/settings', { retention_job_history_days: 90 })
      .on('PATCH', '/api/v1/settings', (c) => c.body);
    renderApp(a, '/settings/retention');
    await screen.findByRole('heading', { name: 'Retention' });
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(a.count('PATCH', '/api/v1/settings')).toBe(1));
    expect(
      (
        a.calls.find((c) => c.method === 'PATCH')?.body as {
          retention_job_history_days: number;
        }
      ).retention_job_history_days,
    ).toBe(90);
    expect(await screen.findByText('Retention saved.')).toBeTruthy();
  });

  it('lists backups and makes one on demand', async () => {
    const a = signedIn()
      .on('GET', '/api/v1/settings', {})
      .on('GET', '/api/v1/backups', {
        items: [
          {
            id: 'b1',
            file: 'crsp-2026-11-14.db',
            created_at: '2026-11-14T03:00:00Z',
            size_bytes: 4200000,
            state: 'good',
          },
        ],
      })
      .on('POST', '/api/v1/backups', {
        id: 'b2',
        file: 'x',
        created_at: 'x',
        state: 'writing',
      });
    renderApp(a, '/settings/backups');
    const table = await screen.findByRole('table', { name: 'Backups' });
    expect(within(table).getByText('4.2 MB')).toBeTruthy();
    expect(within(table).getByText('ok')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back up now' }));
    await waitFor(() => expect(a.count('POST', '/api/v1/backups')).toBe(1));
  });

  it('says what to do when there is no backup', async () => {
    const a = signedIn()
      .on('GET', '/api/v1/settings', {})
      .on('GET', '/api/v1/backups', { items: [] });
    renderApp(a, '/settings/backups');
    expect(
      await screen.findByText('No backups yet. Back up now to make the first one.'),
    ).toBeTruthy();
  });
});
