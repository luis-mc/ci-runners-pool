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

const address = {
  status: 'ok',
  url: 'https://pool.lan:8460',
};

function api(
  items: unknown[] = [live, revoked],
  parityAddress: Record<string, unknown> = address,
) {
  return signedIn()
    .on('GET', '/api/v1/parity-address', parityAddress)
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
  it('shows the form only after the action Make an access, and Cancel closes it', async () => {
    renderApp(api(), '/settings/access');
    await screen.findByRole('table', { name: 'Access for CI' });
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Make an access' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Make an access' })).toBeTruthy();
  });

  it('makes one with the parity scope and shows the value once', async () => {
    const a = api().on('POST', '/api/v1/access-credentials', {
      value: 'crsp_acc_shownonce123',
      info: { ...live, id: 'ac_3', name: 'second' },
    });
    renderApp(a, '/settings/access');
    await screen.findByRole('table', { name: 'Access for CI' });
    fireEvent.click(screen.getByRole('button', { name: 'Make an access' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Make an access' }));
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

  it('lists the access that Set up parity made, with no reload of the page', async () => {
    let made = false;
    const a = signedIn()
      .on('GET', '/api/v1/access-credentials', () =>
        Response.json({ items: made ? [{ ...live, name: 'parity: octo/app' }] : [] }),
      )
      .on('GET', '/api/v1/github/repositories', {
        items: [repo],
        stale: { stale: false },
      })
      .on('POST', '/api/v1/repositories/:id/parity-setup', () => {
        made = true;
        return Response.json({ status: 'done', access_name: 'CRSP_ACCESS' });
      });
    renderApp(a, '/settings/access');
    expect(await screen.findByText(/No access yet/)).toBeTruthy();
    await pick();
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up parity for this repository' }),
    );
    const table = await screen.findByRole('table', { name: 'Access for CI' });
    expect(within(table).getByText('parity: octo/app')).toBeTruthy();
    expect(screen.queryByText(/No access yet/)).toBeNull();
  });

  const step = (id: string, done: boolean, permissions: string[], url?: string) => ({
    id,
    done,
    permissions,
    ...(url ? { url } : {}),
  });
  const notAsked = {
    ready: false,
    next: 'ask',
    missing: ['secrets'],
    installation_id: 10,
    steps: [
      step('install', true, []),
      step(
        'ask',
        false,
        ['secrets'],
        'https://github.com/settings/apps/crsp/permissions',
      ),
      step('accept', false, ['secrets'], 'https://github.com/settings/installations/10'),
    ],
  };
  const askedNotAccepted = {
    ...notAsked,
    next: 'accept',
    steps: [
      step('install', true, []),
      step('ask', true, [], 'https://github.com/settings/apps/crsp/permissions'),
      step('accept', false, ['secrets'], 'https://github.com/settings/installations/10'),
    ],
  };
  const allDone = {
    ready: true,
    missing: [],
    installation_id: 10,
    steps: [step('install', true, []), step('ask', true, []), step('accept', true, [])],
  };
  const needs = (grant: unknown) => ({
    status: 'needs_permission',
    missing_permissions: ['secrets'],
    grant,
  });

  it('guides the grant: one step list, one primary action to the next missing step, and made nothing', async () => {
    const a = api()
      .on('POST', '/api/v1/repositories/:id/parity-setup', needs(notAsked))
      .on('GET', '/api/v1/github/grant', notAsked);
    renderApp(a, '/settings/access');
    await pick();
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up parity for this repository' }),
    );
    expect(
      await screen.findByText('Ask for Secrets (write) on the App page'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Accept the new permissions on the installation: Secrets \(write\)/,
      ),
    ).toBeTruthy();
    // Exactly one action, and it opens the App page: the other step is plain text.
    const open = screen.getAllByRole('button', { name: /on GitHub$/ });
    expect(open).toHaveLength(1);
    expect(open[0]?.getAttribute('href')).toBe(
      'https://github.com/settings/apps/crsp/permissions',
    );
    expect(screen.queryByRole('button', { name: /Open the installation/ })).toBeNull();
    expect(screen.queryByText(/Parity is set up/)).toBeNull();
  });

  it('moves the one action to the installation once the App asks, and names what is missing', async () => {
    const a = api()
      .on('POST', '/api/v1/repositories/:id/parity-setup', needs(askedNotAccepted))
      .on('GET', '/api/v1/github/grant', askedNotAccepted);
    renderApp(a, '/settings/access');
    await pick();
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up parity for this repository' }),
    );
    const open = await screen.findByRole('button', { name: 'Accept it on GitHub' });
    expect(open.getAttribute('href')).toBe(
      'https://github.com/settings/installations/10',
    );
    expect(screen.getAllByRole('button', { name: /on GitHub$/ })).toHaveLength(1);
    expect(screen.getByText(/needs Secrets \(write\)/)).toBeTruthy();
  });

  it('checks again when the tab regains focus and runs the setup by itself once everything is granted', async () => {
    let reads = 0;
    const a = api()
      .on('POST', '/api/v1/repositories/:id/parity-setup', (call) => {
        void call;
        return reads === 0
          ? needs(askedNotAccepted)
          : { status: 'done', access_name: 'CRSP_ACCESS' };
      })
      .on('GET', '/api/v1/github/grant', () => {
        reads += 1;
        return reads === 1 ? askedNotAccepted : allDone;
      });
    renderApp(a, '/settings/access');
    await pick();
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up parity for this repository' }),
    );
    await screen.findByRole('button', { name: 'Accept it on GitHub' });
    // The person accepts on GitHub in the other tab and comes back.
    fireEvent.focus(window);
    expect(await screen.findByText(/Parity is set up for octo\/app/)).toBeTruthy();
    expect(a.count('POST', '/api/v1/repositories/100/parity-setup')).toBe(2);
    expect(screen.queryByRole('button', { name: /on GitHub$/ })).toBeNull();
  });

  it('shows a link that is not on github.com as no link at all', async () => {
    const bad = {
      ...notAsked,
      steps: [
        step('install', true, []),
        step('ask', false, ['secrets'], 'javascript:alert(1)'),
        step('accept', false, ['secrets'], 'https://evil.example/x'),
      ],
    };
    const a = api()
      .on('POST', '/api/v1/repositories/:id/parity-setup', needs(bad))
      .on('GET', '/api/v1/github/grant', bad);
    renderApp(a, '/settings/access');
    await pick();
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up parity for this repository' }),
    );
    await screen.findByText('Ask for Secrets (write) on the App page');
    expect(screen.queryByRole('button', { name: /on GitHub$/ })).toBeNull();
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

describe('The address parity writes (R5.91, CRSP141)', () => {
  const press = () =>
    fireEvent.click(
      screen.getByRole('button', { name: 'Set up parity for this repository' }),
    );

  it('shows the address before anything is written, and that it answers', async () => {
    renderApp(api(), '/settings/access');
    expect(await screen.findByText('https://pool.lan:8460')).toBeTruthy();
    expect(screen.getByText(/Address written as CRSP_URL/)).toBeTruthy();
    expect(screen.getByText(/The controller answers at this address/)).toBeTruthy();
    expect(document.body.textContent).not.toContain('127.0.0.1');
  });

  it('reports when the controller does not answer at the address', async () => {
    renderApp(
      api([live], {
        status: 'unreachable',
        url: 'https://pool.lan:8460',
        problem: 'the controller did not answer at https://pool.lan:8460: timeout',
      }),
      '/settings/access',
    );
    expect(
      await screen.findByText(/did not answer at https:\/\/pool\.lan:8460/),
    ).toBeTruthy();
    expect(screen.queryByText(/The controller answers at this address/)).toBeNull();
  });

  it('refuses with a Needs you note that names the setting, and the button waits', async () => {
    renderApp(
      api([live], {
        status: 'needs_address',
        problem: 'no public host name is set for this controller',
        setting: 'CRSP_PUBLIC_HOST',
      }),
      '/settings/access',
    );
    expect(await screen.findByText(/cannot reach this controller yet/)).toBeTruthy();
    expect(screen.getByText('CRSP_PUBLIC_HOST')).toBeTruthy();
    const button = await screen.findByRole('button', {
      name: 'Set up parity for this repository',
    });
    fireEvent.click(screen.getByRole('radio', { name: 'octo/app' }));
    expect(
      button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true',
    ).toBe(true);
  });

  it('shows the refusal when the setup answers needs_address', async () => {
    const a = api().on('POST', '/api/v1/repositories/:id/parity-setup', {
      status: 'needs_address',
      address_problem: 'CRSP_LISTEN_ADDR is loopback',
      address_setting: 'CRSP_LISTEN_ADDR',
    });
    renderApp(a, '/settings/access');
    await screen.findByRole('button', { name: 'Set up parity for this repository' });
    fireEvent.click(screen.getByRole('radio', { name: 'octo/app' }));
    press();
    expect(await screen.findByText(/CRSP_LISTEN_ADDR is loopback/)).toBeTruthy();
    expect(screen.queryByText(/Parity is set up/)).toBeNull();
  });
});
