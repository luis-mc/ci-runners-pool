// R5.14, R5.15, R5.16: the setup page. Without a setup link it says how to get one. With one it shows the three
// first-run wizards in order; a later one is greyed until the one before it is done. The checklist stays reachable
// from the banner slot until all three are done.
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { apiError, renderApp, signedIn } from '../../testing/mock';

afterEach(cleanup);

const state = (over: object = {}) => ({
  has_app: false,
  has_owner: false,
  setup_link_redeemed: false,
  steps: { connect_github: 'todo', first_machine: 'todo', first_repository: 'todo' },
  ...over,
});

describe('Setup page', () => {
  it('without a setup link says how to get one and offers nothing else (R5.14)', async () => {
    const api = signedIn().on('GET', '/api/v1/setup', state());
    renderApp(api, '/setup');
    expect(
      await screen.findByText(/use Open in the tray, or run `crsp open`/),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('redeems the setup link once and shows the first wizard (R5.14, R5.15)', async () => {
    const api = signedIn()
      .on('POST', '/api/v1/setup/redeem', state({ setup_link_redeemed: true }))
      .on('GET', '/api/v1/setup', state());
    renderApp(api, '/setup?code=one-time');
    expect(await screen.findByRole('group', { name: 'Connect GitHub' })).toBeTruthy();
    expect(api.count('POST', '/api/v1/setup/redeem')).toBe(1);
    expect(
      (api.calls.find((c) => c.method === 'POST')?.body as { code: string }).code,
    ).toBe('one-time');
    // The later wizards are greyed until this one is done (UX-5).
    expect(screen.getByText('This waits for Connect GitHub.')).toBeTruthy();
    expect(screen.getByText('This waits for Add the first machine.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Add a machine' })).toBeNull();
  });

  it('says so when the setup link does not work', async () => {
    const api = signedIn()
      .on('POST', '/api/v1/setup/redeem', () =>
        apiError(400, 'bad_request', 'The link ran out.'),
      )
      .on('GET', '/api/v1/setup', state());
    renderApp(api, '/setup?code=old');
    expect(
      await screen.findByText(/The setup link did not work\. The link ran out\./),
    ).toBeTruthy();
  });

  it('says GitHub made the App but crsp could not save it, links to it, and clears the error (R5.3)', async () => {
    const api = signedIn()
      .on('POST', '/api/v1/setup/redeem', state({ setup_link_redeemed: true }))
      .on('GET', '/api/v1/setup', state({ setup_link_redeemed: true }));
    renderApp(
      api,
      '/setup?code=x&error=unavailable&app_url=' +
        encodeURIComponent('https://github.com/apps/crsp-home'),
    );
    expect(
      await screen.findByText(/GitHub made the App, but crsp could not save it/),
    ).toBeTruthy();
    expect(screen.getByText(/Delete GitHub App/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Open the App on GitHub' }).getAttribute('href'),
    ).toBe('https://github.com/apps/crsp-home');
    await waitFor(() => expect(window.location.search).not.toContain('error='));
  });

  it('offers no link to an address that is not on github.com', async () => {
    const api = signedIn().on(
      'GET',
      '/api/v1/setup',
      state({ setup_link_redeemed: true }),
    );
    renderApp(
      api,
      '/setup?error=unavailable&app_url=' + encodeURIComponent('https://evil.example/x'),
    );
    expect(await screen.findByText(/OS secret store is not available/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open the App on GitHub' })).toBeNull();
  });

  it('explains that App names are unique across GitHub (R5.3)', async () => {
    const api = signedIn().on(
      'GET',
      '/api/v1/setup',
      state({ setup_link_redeemed: true }),
    );
    renderApp(api, '/setup');
    expect(await screen.findByText(/App names are unique across GitHub/)).toBeTruthy();
  });

  it('goes on to the machine wizard once the App is connected and the user is signed in', async () => {
    const api = signedIn()
      .on(
        'GET',
        '/api/v1/setup',
        state({
          has_app: true,
          setup_link_redeemed: true,
          steps: {
            connect_github: 'done',
            first_machine: 'todo',
            first_repository: 'todo',
          },
        }),
      )
      .on('GET', '/api/v1/machines', { items: [] });
    renderApp(api, '/setup');
    expect(await screen.findByRole('group', { name: 'Add a machine' })).toBeTruthy();
    expect(screen.getByText('Connect GitHub is done.')).toBeTruthy();
    expect(screen.getByText('This waits for Add the first machine.')).toBeTruthy();
  });

  it('reviews the account step before it goes to GitHub, and says nothing has changed', async () => {
    const api = signedIn()
      .on('POST', '/api/v1/setup/redeem', state({ setup_link_redeemed: true }))
      .on('GET', '/api/v1/setup', state({ setup_link_redeemed: true }));
    renderApp(api, '/setup?code=x');
    fireEvent.click(await screen.findByRole('radio', { name: 'An organization' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Write the organization.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Organization' }), {
      target: { value: 'acme' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Nothing has changed yet.')).toBeTruthy();
    expect(screen.getByText('acme')).toBeTruthy();
    expect(api.count('POST', '/api/v1/setup/github-app')).toBe(0);
  });
});

describe('First run banner (R5.15)', () => {
  it('stays in the banner slot until all three wizards are done', async () => {
    const api = signedIn().on(
      'GET',
      '/api/v1/setup',
      state({
        has_app: true,
        steps: {
          connect_github: 'done',
          first_machine: 'todo',
          first_repository: 'todo',
        },
      }),
    );
    renderApp(api, '/');
    expect(await screen.findByText('First run is not finished.')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Open the setup page' }).getAttribute('href'),
    ).toBe('/setup');
  });

  it('is gone when every wizard is done', async () => {
    renderApp(signedIn(), '/');
    await screen.findByRole('heading', { name: 'Overview' });
    await waitFor(() =>
      expect(screen.queryByText('First run is not finished.')).toBeNull(),
    );
  });
});
