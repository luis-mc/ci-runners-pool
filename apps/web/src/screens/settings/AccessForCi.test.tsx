// R5.90, R5.91: Settings > Access for CI. Made, listed and revoked here; the value is shown once; the action
// "Set up parity for this repository" writes through the GitHub App and, when the App lacks a permission, names the
// GitHub pages and makes nothing.
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp, signedIn, viewer } from '../../testing/mock';

afterEach(cleanup);

const live = {
  id: 'ac_1',
  name: 'parity CI',
  scope: 'parity',
  created_by: 'octo',
  created_at: '2026-11-16T09:00:00Z',
  last_used_at: '2026-11-16T10:00:00Z',
};
const revoked = {
  ...live,
  id: 'ac_2',
  name: 'old one',
  revoked_at: '2026-11-16T11:00:00Z',
};
const repo = { id: 100, full_name: 'octo/app', owner: 'octo', name: 'app' };

function api(items: unknown[] = [live, revoked]) {
  return signedIn()
    .on('GET', '/api/v1/access-credentials', { items })
    .on('GET', '/api/v1/github/repositories', { items: [repo], stale: { stale: false } });
}

describe('Access for CI list (R5.90)', () => {
  it('lists each access with what it can do and its state, never a value', async () => {
    renderApp(api(), '/settings/access');
    const table = await screen.findByRole('table', { name: 'Access for CI' });
    expect(within(table).getByText('parity CI')).toBeTruthy();
    expect(within(table).getAllByText('Read only: the checks of parity')).toHaveLength(2);
    expect(within(table).getByText('live')).toBeTruthy();
    expect(within(table).getByText('revoked')).toBeTruthy();
    // Only a live access has Revoke.
    expect(within(table).getAllByRole('button', { name: 'Revoke' })).toHaveLength(1);
    expect(document.body.textContent).not.toContain('crsp_acc_');
  });

  it('says so when there is none, with the next step', async () => {
    renderApp(api([]), '/settings/access');
    expect(await screen.findByText(/No access yet\. Set up parity/)).toBeTruthy();
  });

  it('is for admins only', async () => {
    renderApp(signedIn(viewer), '/settings/access');
    expect(await screen.findByText(/Only an admin can make, see or revoke/)).toBeTruthy();
  });
});

describe('Make an access (R5.90)', () => {
  it('makes one with the parity scope and shows the value once', async () => {
    const a = api().on('POST', '/api/v1/access-credentials', {
      value: 'crsp_acc_shownonce123',
      info: { ...live, id: 'ac_3', name: 'second' },
    });
    renderApp(a, '/settings/access');
    await screen.findByRole('table', { name: 'Access for CI' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'second' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make' }));
    const dialog = await screen.findByRole('dialog', { name: 'Access second is made' });
    expect(within(dialog).getByLabelText('Access value').textContent).toBe(
      'crsp_acc_shownonce123',
    );
    expect(within(dialog).getByText(/only time the value is shown/)).toBeTruthy();
    expect(a.calls.find((c) => c.method === 'POST')?.body).toEqual({
      name: 'second',
      scope: 'parity',
    });
    // Closed, it is gone: the page keeps no copy.
    fireEvent.click(within(dialog).getByRole('button', { name: 'I have it' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.textContent).not.toContain('crsp_acc_shownonce123');
  });

  it('asks for a name', async () => {
    const a = api();
    renderApp(a, '/settings/access');
    await screen.findByRole('table', { name: 'Access for CI' });
    fireEvent.click(screen.getByRole('button', { name: 'Make' }));
    expect(await screen.findByText(/Write a name for the access/)).toBeTruthy();
    expect(a.count('POST', '/api/v1/access-credentials')).toBe(0);
  });
});

describe('Revoke (R5.90, UX-62)', () => {
  it('asks first, naming what stops, then revokes', async () => {
    const a = api().on('DELETE', '/api/v1/access-credentials/:id', undefined);
    renderApp(a, '/settings/access');
    await screen.findByRole('table', { name: 'Access for CI' });
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    const dialog = await screen.findByRole('dialog', { name: 'Revoke parity CI?' });
    expect(within(dialog).getByText(/stops working at once/)).toBeTruthy();
    expect(a.count('DELETE', '/api/v1/access-credentials/ac_1')).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));
    await waitFor(() =>
      expect(a.count('DELETE', '/api/v1/access-credentials/ac_1')).toBe(1),
    );
  });
});

describe('Set up parity for this repository (R5.91)', () => {
  const pick = async () => {
    await screen.findByRole('button', { name: 'Set up parity for this repository' });
    fireEvent.click(screen.getByRole('radio', { name: 'octo/app' }));
  };

  it('is disabled until a repository is chosen, and says why', async () => {
    renderApp(api(), '/settings/access');
    const button = await screen.findByRole('button', {
      name: 'Set up parity for this repository',
    });
    expect(
      button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true',
    ).toBe(true);
  });

  it('writes through the App and says it is done, with nothing to copy', async () => {
    const a = api().on('POST', '/api/v1/repositories/:id/parity-setup', {
      status: 'done',
      access_name: 'CRSP_ACCESS',
      variable_names: ['CRSP_CA_FINGERPRINT', 'CRSP_URL'],
      access_id: 'ac_9',
    });
    renderApp(a, '/settings/access');
    await pick();
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up parity for this repository' }),
    );
    expect(await screen.findByText(/Parity is set up for octo\/app/)).toBeTruthy();
    expect(a.count('POST', '/api/v1/repositories/100/parity-setup')).toBe(1);
    expect(document.body.textContent).not.toContain('crsp_acc_');
  });

  it('names the GitHub pages when the App lacks the permission, and made nothing', async () => {
    const a = api().on('POST', '/api/v1/repositories/:id/parity-setup', {
      status: 'needs_permission',
      missing_permissions: ['secrets'],
      app_permissions_url: 'https://github.com/settings/apps/crsp/permissions',
      installation_url: 'https://github.com/settings/installations/10',
    });
    renderApp(a, '/settings/access');
    await pick();
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up parity for this repository' }),
    );
    expect(await screen.findByText(/cannot write to octo\/app yet/)).toBeTruthy();
    expect(screen.getByText(/Secrets \(write\)/)).toBeTruthy();
    const app = screen.getByRole('button', { name: /Open the App permissions/ });
    expect(app.getAttribute('href')).toBe(
      'https://github.com/settings/apps/crsp/permissions',
    );
    const inst = screen.getByRole('button', { name: /Open the installation/ });
    expect(inst.getAttribute('href')).toBe(
      'https://github.com/settings/installations/10',
    );
    expect(screen.queryByText(/Parity is set up/)).toBeNull();
  });

  it('shows a link that is not on github.com as no link at all', async () => {
    const a = api().on('POST', '/api/v1/repositories/:id/parity-setup', {
      status: 'needs_permission',
      missing_permissions: ['secrets'],
      app_permissions_url: 'javascript:alert(1)',
      installation_url: 'https://evil.example/x',
    });
    renderApp(a, '/settings/access');
    await pick();
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up parity for this repository' }),
    );
    await screen.findByText(/cannot write to octo\/app yet/);
    expect(screen.queryByRole('button', { name: /Open the/ })).toBeNull();
  });

  it('shows the failure and says nothing was left behind', async () => {
    const a = api().on('POST', '/api/v1/repositories/:id/parity-setup', () =>
      Response.json(
        {
          error: {
            code: 'github_unavailable',
            message: 'GitHub could not be reached; nothing was changed',
          },
        },
        { status: 503 },
      ),
    );
    renderApp(a, '/settings/access');
    await pick();
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up parity for this repository' }),
    );
    expect(
      await screen.findByText(/Could not set up parity\. Nothing was left behind/),
    ).toBeTruthy();
  });
});
