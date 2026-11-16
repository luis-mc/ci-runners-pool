// CRSP162 (CORE-1..7, UX-4, UX-8, UX-12, UX-17): every part of the repository screens sits in a pane, each screen
// has one primary, the failed state keeps its h1, and the detail page has one Save.
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  apiError,
  renderApp,
  repository,
  signedIn,
  type MockApi,
} from '../../testing/mock';

afterEach(cleanup);

const list = (api: MockApi, items = [repository()]) =>
  api.on('GET', '/api/v1/github/repositories', { items, stale: { stale: false } });

const primaries = () =>
  [...document.querySelectorAll<HTMLElement>('[data-kind="primary"]')].map(
    (b) => b.textContent,
  );

describe('Repositories list in a pane', () => {
  it('draws the toolbar, table and pager inside the Repositories pane (CORE-1)', async () => {
    renderApp(list(signedIn()), '/repositories');
    const table = await screen.findByRole('table', { name: 'Repositories' });
    const pane = table.closest('.ds-pane') as HTMLElement;
    expect(pane).toBeTruthy();
    expect(
      within(pane).getByRole('heading', { level: 2, name: 'Repositories' }),
    ).toBeTruthy();
    expect(
      within(pane).getByRole('group', { name: 'Repositories toolbar' }),
    ).toBeTruthy();
    expect(
      within(pane).getByRole('textbox', { name: 'Search repositories' }),
    ).toBeTruthy();
  });

  it('has one primary, also while rows are ticked (UX-4)', async () => {
    renderApp(list(signedIn()), '/repositories');
    await screen.findByRole('table', { name: 'Repositories' });
    expect(primaries()).toEqual(['Turn on the pool']);
    fireEvent.click(screen.getByRole('button', { name: 'Select all 1' }));
    expect(screen.getByRole('button', { name: 'Turn on 1 repository' })).toBeTruthy();
    expect(primaries()).toEqual(['Turn on the pool']);
  });

  it('shows Select all N and a Clear that says why it is off when nothing is ticked (UX-12)', async () => {
    renderApp(list(signedIn()), '/repositories');
    await screen.findByRole('table', { name: 'Repositories' });
    expect(screen.getByRole('button', { name: 'Select all 1' })).toBeTruthy();
    const clear = screen.getByRole<HTMLButtonElement>('button', { name: 'Clear' });
    expect(clear.disabled).toBe(true);
  });

  it('keeps Select all N equal to the rows the filter leaves (UX-7)', async () => {
    renderApp(
      list(signedIn(), [
        repository(),
        repository({ id: 8, full_name: 'octo/site', name: 'site', pool_on: true }),
      ]),
      '/repositories',
    );
    await screen.findByRole('table', { name: 'Repositories' });
    fireEvent.click(screen.getByRole('button', { name: 'Pool on' }));
    expect(screen.getByRole('button', { name: 'Select all 1' })).toBeTruthy();
  });

  it('keeps the pane when the controller fails (UX-28)', async () => {
    renderApp(
      signedIn().on(
        'GET',
        '/api/v1/github/repositories',
        apiError(500, 'internal', 'down'),
      ),
      '/repositories',
    );
    expect(await screen.findByText(/Could not load repositories/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Repositories' })).toBeTruthy();
  });
});

describe('Repository detail in panes', () => {
  const detail = (r = repository()) =>
    list(signedIn(), [r]).on('GET', '/api/v1/repositories/:id', r);

  it('keeps the h1 when the repository cannot be loaded (UX-17)', async () => {
    renderApp(list(signedIn(), []), '/repositories/octo/app');
    expect(await screen.findByText(/Could not load the repository/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'octo/app' })).toBeTruthy();
  });

  it('puts State, Policy, Hosted fallback and Extra packages in panes', async () => {
    renderApp(detail(), '/repositories/octo/app');
    await screen.findByRole('heading', { level: 1, name: 'octo/app' });
    for (const t of ['State', 'Policy', 'Hosted fallback', 'Extra packages'])
      expect(screen.getByRole('heading', { level: 2, name: t })).toBeTruthy();
  });

  it('has one Save and one primary (UX-4, UX-24)', async () => {
    renderApp(detail(), '/repositories/octo/app');
    await screen.findByRole('heading', { level: 1, name: 'octo/app' });
    expect(screen.getAllByRole('button', { name: /^Save/ })).toHaveLength(1);
    // The pool is off: Turn on the pool is the next step, Save is secondary.
    expect(primaries()).toEqual(['Turn on the pool']);
  });

  it('makes Save the primary once the pool is on', async () => {
    renderApp(detail(repository({ pool_on: true })), '/repositories/octo/app');
    await screen.findByRole('heading', { level: 1, name: 'octo/app' });
    expect(primaries()).toEqual(['Save']);
  });

  it('saves the policy, the fallback and the packages with one Save, asking once', async () => {
    const r = repository();
    const a = detail(r)
      .on('PATCH', '/api/v1/repositories/:id/policy', r.policy)
      .on('PUT', '/api/v1/repositories/:id/extra-packages', {
        packages: ['zlib1g-dev'],
        text: 'zlib1g-dev',
      });
    renderApp(a, '/repositories/octo/app');
    await screen.findByRole('heading', { level: 1, name: 'octo/app' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Run jobs from public forks' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Run on GitHub-hosted runners' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Extra packages/ }), {
      target: { value: 'zlib1g-dev' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save these changes?' });
    expect(within(dialog).getByText(/public forks run on your machines/)).toBeTruthy();
    expect(within(dialog).getByText(/GitHub may bill/)).toBeTruthy();
    expect(a.count('PATCH', '/api/v1/repositories/7/policy')).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(a.count('PUT', '/api/v1/repositories/7/extra-packages')).toBe(1),
    );
    expect(a.count('PATCH', '/api/v1/repositories/7/policy')).toBe(1);
    const sent = a.calls.find((c) => c.method === 'PATCH')?.body as Record<
      string,
      unknown
    >;
    expect(sent['allow_fork_pull_requests']).toBe(true);
    expect(sent['hosted_fallback']).toBe(true);
    expect(sent['confirm_fork_risk']).toBe(true);
    expect(sent['confirm_fallback_cost']).toBe(true);
  });

  it('sends nothing for a Save with no change', async () => {
    const a = detail();
    renderApp(a, '/repositories/octo/app');
    await screen.findByRole('heading', { level: 1, name: 'octo/app' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Nothing changed.')).toBeTruthy();
    expect(
      a.calls.filter((c) => c.method === 'PATCH' || c.method === 'PUT'),
    ).toHaveLength(0);
  });
});

describe('Turn on the pool in panes', () => {
  const wizard = (items: ReturnType<typeof repository>[]) => list(signedIn(), items);

  it('puts the choice in a pane with the choosing buttons and one primary', async () => {
    renderApp(wizard([repository()]), '/repositories/turn-on');
    const pane = (
      await screen.findByRole('heading', { level: 2, name: /Repositories to turn on/ })
    ).closest('.ds-pane') as HTMLElement;
    expect(
      within(pane).getByRole('table', { name: 'Repositories to turn on' }),
    ).toBeTruthy();
    expect(within(pane).getByRole('button', { name: 'Select all 1' })).toBeTruthy();
    expect(within(pane).getByRole('button', { name: 'Clear' })).toBeTruthy();
    expect(primaries()).toEqual(['Next']);
  });

  it('names the admin rights as the next action when every repository is blocked', async () => {
    renderApp(
      wizard([repository({ user_is_github_admin: false })]),
      '/repositories/turn-on',
    );
    expect(
      await screen.findByText(
        /No repository is free for you to turn on. One needs admin rights/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Install the App on a repository' }),
    ).toBeTruthy();
    expect(primaries()).toEqual(['Next']);
  });

  it('names the setting as the next action when only public repositories are left and they are off', async () => {
    renderApp(
      wizard([repository({ visibility: 'public' })]).on(
        'GET',
        '/api/v1/settings/public-repositories',
        { enabled: false, public_on_pool: 0 },
      ),
      '/repositories/turn-on',
    );
    expect(await screen.findByText(/the ones left are public/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open the setting' })).toBeTruthy();
  });

  it('says the App must be installed when nothing is waiting', async () => {
    renderApp(wizard([]), '/repositories/turn-on');
    expect(await screen.findByText(/No repository is waiting/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Install the App on a repository' }),
    ).toBeTruthy();
  });
});
