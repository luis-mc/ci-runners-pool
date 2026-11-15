// R5.21: the repositories screen lists repositories with pool state, labels, limits and variable status; it
// turns the pool on and off and edits the policy.
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TIMING } from '../../timing';
import {
  MockApi,
  apiError,
  renderApp,
  repository,
  signedIn,
  viewer,
} from '../../testing/mock';

afterEach(cleanup);
TIMING.planPollMs = 5;

const on = repository({
  id: 8,
  full_name: 'octo/site',
  name: 'site',
  pool_on: true,
  variables: [{ name: 'RUNS_ON_LINUX', status: 'wrong', value: 'old' }],
});
const page = (items = [repository(), on]) => ({ items, stale: { stale: false } });

function withRepos(api: MockApi, items = [repository(), on]): MockApi {
  return api.on('GET', '/api/v1/github/repositories', page(items));
}

describe('Repositories list', () => {
  it('shows pool state, labels, limits and variable status as words', async () => {
    renderApp(withRepos(signedIn()), '/repositories');
    const table = await screen.findByRole('table', { name: 'Repositories' });
    expect(within(table).getByText('on')).toBeTruthy();
    expect(within(table).getByText('off')).toBeTruthy();
    expect(within(table).getByText('wrong variable')).toBeTruthy();
    expect(within(table).getByText('not used')).toBeTruthy();
    expect(within(table).getAllByText('self-hosted').length).toBe(2);
  });

  it('filters by pool state and by search', async () => {
    renderApp(withRepos(signedIn()), '/repositories');
    await screen.findByRole('table', { name: 'Repositories' });
    fireEvent.click(screen.getByRole('button', { name: 'Pool on' }));
    expect(screen.queryByRole('link', { name: 'app' })).toBeNull();
    expect(screen.getByRole('link', { name: 'site' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pool on' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search repositories' }), {
      target: { value: 'app' },
    });
    expect(screen.queryByRole('link', { name: 'site' })).toBeNull();
  });

  it('offers Select all N and Clear, and names the count on the action (UX-7, UX-12)', async () => {
    renderApp(withRepos(signedIn()), '/repositories');
    await screen.findByRole('table', { name: 'Repositories' });
    fireEvent.click(screen.getByRole('button', { name: 'Select all 2' }));
    expect(screen.getByRole('button', { name: 'Turn on 2 repositories' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Turn off 2 repositories' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('button', { name: /Turn on \d/ })).toBeNull();
  });

  it('disables turn-on for a repository without GitHub admin rights and says why (UX-38)', async () => {
    renderApp(
      withRepos(signedIn(), [repository({ user_is_github_admin: false })]),
      '/repositories',
    );
    await screen.findByRole('table', { name: 'Repositories' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select octo/app' }));
    const button = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Turn on 1 repository',
    });
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/You need admin rights on octo\/app in GitHub/)).toBeTruthy();
  });

  it('turns the pool off only after a question that names each repository and variable (UX-62)', async () => {
    const api = withRepos(signedIn())
      .on('POST', '/api/v1/repository-plans', {
        id: 'p1',
        area: 'repositories',
        state: 'planned',
        created_at: 'x',
        created_by: 'octo',
        steps: [
          {
            id: 's1',
            action: 'pool_off',
            text: 'Turn off',
            needs_yes: false,
            state: 'planned',
          },
        ],
      })
      .on('POST', '/api/v1/repository-plans/:id/apply', {
        id: 'p1',
        area: 'repositories',
        state: 'done',
        created_at: 'x',
        created_by: 'octo',
        steps: [],
      });
    renderApp(api, '/repositories');
    await screen.findByRole('table', { name: 'Repositories' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select octo/site' }));
    fireEvent.click(screen.getByRole('button', { name: 'Turn off 1 repository' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Turn off these repositories?',
    });
    expect(within(dialog).getByText('octo/site: pool off')).toBeTruthy();
    expect(within(dialog).getByText('octo/site: variable RUNS_ON_LINUX')).toBeTruthy();
    expect(api.count('POST', '/api/v1/repository-plans')).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Turn off' }));
    await waitFor(() =>
      expect(api.count('POST', '/api/v1/repository-plans/p1/apply')).toBe(1),
    );
    expect(
      (
        api.calls.find((c) => c.path === '/api/v1/repository-plans')?.body as {
          changes: { pool: string }[];
        }
      ).changes[0]?.pool,
    ).toBe('off');
  });

  it('says what to do when the App is on no repository', async () => {
    renderApp(withRepos(signedIn(), []), '/repositories');
    expect(
      await screen.findByText(
        'No repositories yet. Install the App on a repository to start.',
      ),
    ).toBeTruthy();
  });

  it('shows the last copy with its age when GitHub does not answer', async () => {
    const api = signedIn().on('GET', '/api/v1/github/repositories', {
      items: [repository()],
      stale: { stale: true, as_of: '2026-11-14T08:00:00Z' },
    });
    renderApp(api, '/repositories');
    expect(
      await screen.findByText(
        /GitHub is not answering\. The list is the last copy, from 2026-11-14/,
      ),
    ).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Repositories' })).toBeTruthy();
  });

  it('says could not load when the controller fails', async () => {
    const api = signedIn().on('GET', '/api/v1/github/repositories', () =>
      apiError(502, 'github_unavailable', 'GitHub says no.'),
    );
    renderApp(api, '/repositories');
    expect(await screen.findByText(/Could not load repositories\./)).toBeTruthy();
    expect(screen.getByText(/GitHub is not answering\. Try again\./)).toBeTruthy();
  });

  it('opens GitHub through the install link for a repository that is not listed', async () => {
    const api = withRepos(signedIn()).on('GET', '/api/v1/github/install-url', {
      url: 'https://github.example/apps/x/installations/new',
    });
    renderApp(api, '/repositories');
    await screen.findByRole('table', { name: 'Repositories' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a repository' }));
    await waitFor(() => expect(api.count('GET', '/api/v1/github/install-url')).toBe(1));
  });
});

describe('Repository detail', () => {
  const api = () =>
    withRepos(signedIn()).on('GET', '/api/v1/repositories/:id', (_c, p) =>
      p.id === '8' ? on : repository(),
    );

  it('shows state, variables and the policy form', async () => {
    renderApp(api(), '/repositories/octo/site');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'octo/site' }),
    ).toBeTruthy();
    expect(screen.getByText('RUNS_ON_LINUX')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Labels' })).toBeTruthy();
  });

  it('asks first before jobs from public forks are turned on (UX-9)', async () => {
    const a = api().on('PATCH', '/api/v1/repositories/:id/policy', on.policy);
    renderApp(a, '/repositories/octo/app');
    await screen.findByRole('heading', { name: 'octo/app' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Run jobs from public forks' }));
    expect(
      screen.getByText(/Jobs from public forks run code you did not write/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Allow jobs from public forks?',
    });
    expect(a.count('PATCH', '/api/v1/repositories/7/policy')).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Allow' }));
    await waitFor(() =>
      expect(a.count('PATCH', '/api/v1/repositories/7/policy')).toBe(1),
    );
    expect(
      (a.calls.find((c) => c.method === 'PATCH')?.body as { confirm_fork_risk: boolean })
        .confirm_fork_risk,
    ).toBe(true);
  });

  it('shows where the jobs go now and why (github-integration R5.68)', async () => {
    const hosted = repository({
      id: 9,
      full_name: 'octo/live',
      name: 'live',
      pool_on: true,
      routing: { where: 'hosted', why: 'fallback_on', oses: ['linux'], used_minutes: 12 },
    });
    const waiting = repository({
      id: 10,
      full_name: 'octo/wait',
      name: 'wait',
      pool_on: true,
      routing: {
        where: 'waiting',
        why: 'fallback_off',
        oses: ['windows'],
        used_minutes: 0,
      },
    });
    renderApp(withRepos(signedIn(), [hosted, waiting]), '/repositories');
    const table = await screen.findByRole('table', { name: 'Repositories' });
    expect(within(table).getByText('GitHub-hosted runners')).toBeTruthy();
    expect(within(table).getByText('waiting for a machine')).toBeTruthy();
  });

  it('says why on the repository page and keeps fallback off by default', async () => {
    const wait = repository({
      pool_on: true,
      routing: {
        where: 'waiting',
        why: 'fallback_off',
        oses: ['linux'],
        used_minutes: 0,
      },
    });
    renderApp(
      withRepos(signedIn(), [wait]).on('GET', '/api/v1/repositories/:id', wait),
      '/repositories/octo/app',
    );
    await screen.findByRole('heading', { name: 'octo/app' });
    expect(
      screen.getByText('No crsp machine for Linux is up. Jobs wait for one.'),
    ).toBeTruthy();
    const wait1 = screen.getByRole('radio', { name: 'Wait for a crsp machine' });
    expect((wait1 as HTMLInputElement).checked).toBe(true);
  });

  it('asks first before the hosted fallback is turned on (UX-9, R5.66)', async () => {
    const a = api().on('PATCH', '/api/v1/repositories/:id/policy', on.policy);
    renderApp(a, '/repositories/octo/app');
    await screen.findByRole('heading', { name: 'octo/app' });
    fireEvent.click(screen.getByRole('radio', { name: 'Run on GitHub-hosted runners' }));
    const form = screen
      .getByRole('radio', { name: 'Run on GitHub-hosted runners' })
      .closest('form') as HTMLElement;
    fireEvent.click(within(form).getByRole('button', { name: 'Save fallback' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Run on GitHub-hosted runners?',
    });
    expect(within(dialog).getByText(/GitHub may bill the minutes/)).toBeTruthy();
    expect(a.count('PATCH', '/api/v1/repositories/7/policy')).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Turn on' }));
    await waitFor(() =>
      expect(a.count('PATCH', '/api/v1/repositories/7/policy')).toBe(1),
    );
    const sent = a.calls.find((c) => c.method === 'PATCH')?.body as {
      hosted_fallback: boolean;
      confirm_fallback_cost: boolean;
    };
    expect(sent.hosted_fallback).toBe(true);
    expect(sent.confirm_fallback_cost).toBe(true);
  });

  it('refuses the fallback choice for a public repository', async () => {
    const pub = repository({ visibility: 'public' });
    renderApp(
      withRepos(signedIn(), [pub]).on('GET', '/api/v1/repositories/:id', pub),
      '/repositories/octo/app',
    );
    await screen.findByRole('heading', { name: 'octo/app' });
    const r = screen.getByRole('radio', { name: /Run on GitHub-hosted runners/ });
    expect((r as HTMLInputElement).disabled).toBe(true);
  });

  it('turns the light runner off from the policy form (scheduling R5.65)', async () => {
    const a = api().on('PATCH', '/api/v1/repositories/:id/policy', on.policy);
    renderApp(a, '/repositories/octo/app');
    await screen.findByRole('heading', { name: 'octo/app' });
    const box = screen.getByRole('checkbox', {
      name: 'Keep a light runner for short jobs',
    });
    expect((box as HTMLInputElement).checked).toBe(true);
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(a.count('PATCH', '/api/v1/repositories/7/policy')).toBe(1),
    );
    expect(
      (a.calls.find((c) => c.method === 'PATCH')?.body as { light_runner: boolean })
        .light_runner,
    ).toBe(false);
  });

  it('shows every mistake above its box and in a list after Save (UX-21)', async () => {
    renderApp(api(), '/repositories/octo/app');
    await screen.findByRole('heading', { name: 'octo/app' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Labels' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Add at least one label.')).toBeTruthy();
  });

  it('shows the extra packages and saves the list through its own endpoint (runners R5.51)', async () => {
    const a = api()
      .on(
        'GET',
        '/api/v1/repositories/:id',
        repository({
          policy: {
            ...repository().policy,
            extra_packages: ['libc++-dev', 'zlib1g-dev'],
          },
        }),
      )
      .on('PUT', '/api/v1/repositories/:id/extra-packages', {
        packages: ['zlib1g-dev'],
        text: 'zlib1g-dev',
      });
    renderApp(a, '/repositories/octo/app');
    await screen.findByRole('heading', { name: 'octo/app' });
    const box = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: /Extra packages/,
    });
    expect(box.value).toBe('libc++-dev\nzlib1g-dev');
    fireEvent.change(box, { target: { value: 'zlib1g-dev' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save packages' }));
    expect(await screen.findByText('Extra packages saved.')).toBeTruthy();
    expect((a.calls.find((c) => c.method === 'PUT')?.body as { text: string }).text).toBe(
      'zlib1g-dev',
    );
    expect(a.count('PATCH', '/api/v1/repositories/7/policy')).toBe(0);
  });

  it('refuses a bad package name with its line before anything is sent (runners R5.51, UX-21)', async () => {
    const a = api().on('PUT', '/api/v1/repositories/:id/extra-packages', {
      packages: [],
      text: '',
    });
    renderApp(a, '/repositories/octo/app');
    await screen.findByRole('heading', { name: 'octo/app' });
    fireEvent.change(screen.getByRole('textbox', { name: /Extra packages/ }), {
      target: { value: 'zlib1g-dev\n# a note\n-evil' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save packages' }));
    expect(
      (await screen.findAllByText(/Line 3: -evil is not a package name/)).length,
    ).toBe(2);
    expect(a.count('PUT', '/api/v1/repositories/7/extra-packages')).toBe(0);
  });

  it('shows the controller refusal when it says no (runners R5.51)', async () => {
    const a = api().on(
      'PUT',
      '/api/v1/repositories/:id/extra-packages',
      apiError(400, 'invalid', 'line 1: "a b" is not a package name'),
    );
    renderApp(a, '/repositories/octo/app');
    await screen.findByRole('heading', { name: 'octo/app' });
    fireEvent.change(screen.getByRole('textbox', { name: /Extra packages/ }), {
      target: { value: 'ok-name' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save packages' }));
    expect(await screen.findByText(/line 1: "a b" is not a package name/)).toBeTruthy();
  });

  it('shows Turn on the pool disabled with the reason when the user lacks GitHub admin rights', async () => {
    const a = withRepos(signedIn()).on(
      'GET',
      '/api/v1/repositories/:id',
      repository({ user_is_github_admin: false }),
    );
    renderApp(a, '/repositories/octo/app');
    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: 'Turn on the pool',
    });
    expect(button.disabled).toBe(true);
    expect(
      screen.getByText('You need admin rights on this repository in GitHub.'),
    ).toBeTruthy();
  });

  it('keeps a viewer from changing anything', async () => {
    const a = withRepos(signedIn(viewer)).on(
      'GET',
      '/api/v1/repositories/:id',
      repository(),
    );
    renderApp(a, '/repositories/octo/app');
    await screen.findByRole('heading', { name: 'octo/app' });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(
      true,
    );
  });
});
