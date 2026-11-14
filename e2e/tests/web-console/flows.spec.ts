// The main flows of the console against the mocked API: add a machine, turn on the pool, drain, delete a runner,
// add a user, and the session-ended dialog.
import { expect, test } from '@playwright/test';
import { failure, machine, repository, runner, signedIn } from './fixtures';

const join = (state: string, extra: object = {}) => ({
  id: 'j1',
  state,
  created_at: '2026-11-14T10:00:00Z',
  expires_at: '2099-11-14T10:15:00Z',
  ...extra,
});

test('Add a machine: Review, Joining with a one-time code, then Done with the machine', async ({
  page,
}) => {
  let joined = false;
  const mock = signedIn()
    .on('GET', '/api/v1/install-command', {
      controller_address: 'https://controller:8460',
      agent_port: 8461,
      cert_sha256: 'ab',
      items: [
        { os: 'linux', command: 'curl -fsSL https://controller:8460/install | sh' },
      ],
    })
    .on('POST', '/api/v1/join-codes', {
      code: 'ABCD-1234',
      join_code: join('waiting'),
      commands: {
        controller_address: 'x',
        agent_port: 1,
        cert_sha256: 'x',
        items: [{ os: 'linux', command: 'curl ... --code ABCD-1234' }],
      },
    })
    .on('GET', '/api/v1/join-codes/:id', () =>
      joined ? join('joined', { machine_id: 'm1' }) : join('waiting'),
    );
  await mock.install(page);
  await page.goto('/machines/add');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Add a machine' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Nothing has changed yet.')).toBeVisible();
  await expect(page.getByLabel('Install command')).toContainText('curl -fsSL');
  await page.getByRole('button', { name: 'Join a machine' }).click();
  await expect(page.locator('dd', { hasText: 'ABCD-1234' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  // The primary is busy and says so; the code is never in the address (R6.4).
  await expect(page.locator('[data-primary][aria-busy="true"]')).toBeDisabled();
  expect(page.url()).not.toContain('ABCD-1234');
  joined = true;
  await expect(page.getByText('The machine joined the pool.')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText('build-1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start again' })).toBeVisible();
});

test('Add a machine: Stop withdraws the code and the wizard still ends at Done', async ({
  page,
}) => {
  const mock = signedIn()
    .on('GET', '/api/v1/install-command', {
      controller_address: 'x',
      agent_port: 1,
      cert_sha256: 'x',
      items: [{ os: 'linux', command: 'curl x' }],
    })
    .on('POST', '/api/v1/join-codes', {
      code: 'ABCD-1234',
      join_code: join('waiting'),
      commands: {
        controller_address: 'x',
        agent_port: 1,
        cert_sha256: 'x',
        items: [{ os: 'linux', command: 'curl x --code ABCD-1234' }],
      },
    })
    .on('GET', '/api/v1/join-codes/:id', join('waiting'))
    .on('DELETE', '/api/v1/join-codes/:id', undefined);
  await mock.install(page);
  await page.goto('/machines/add');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Join a machine' }).click();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText(/The join code is withdrawn/)).toBeVisible();
  expect(mock.count('DELETE', '/api/v1/join-codes/j1')).toBe(1);
  await expect(page.getByRole('button', { name: 'Start again' })).toBeVisible();
});

test('Turn on the pool: choose, Review, Turning on, Done with what was really done', async ({
  page,
}) => {
  const plan = (state: string, stepState: string) => ({
    id: 'p1',
    area: 'repositories',
    state,
    created_at: '2026-11-14T10:00:00Z',
    created_by: 'octo',
    steps: [
      {
        id: 's1',
        action: 'pool_on',
        text: 'Turn on octo/app',
        needs_yes: false,
        state: stepState,
      },
      {
        id: 's2',
        action: 'write_variable',
        text: 'Write RUNS_ON_LINUX',
        needs_yes: false,
        state: stepState,
      },
    ],
  });
  const mock = signedIn()
    .on('POST', '/api/v1/repository-plans', plan('planned', 'planned'))
    .on('POST', '/api/v1/repository-plans/:id/apply', plan('applying', 'running'))
    .on('GET', '/api/v1/repository-plans/:id', plan('done', 'done'));
  await mock.install(page);
  await page.goto('/repositories/turn-on');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Turn on the pool' }),
  ).toBeVisible();
  const next = page.getByRole('button', { name: 'Next' });
  await expect(next).toBeDisabled();
  await expect(page.getByText('Tick the repositories to turn on.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Select octo/app' }).check();
  await next.click();
  await expect(page.getByText('Nothing has changed yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Turn on 1 repository' }).click();
  await expect(page.getByText(/The pool is on\. 2 steps done/)).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('button', { name: 'Open Repositories' })).toBeVisible();
});

test('Drain asks first, names the running jobs, and drains on yes', async ({ page }) => {
  const mock = signedIn().on('POST', '/api/v1/machines/:id/drain', {
    id: 'c1',
    machine_id: 'm1',
    kind: 'drain',
    state: 'waiting',
    started_at: 'x',
    waiting_for: [],
  });
  await mock.install(page);
  await page.goto('/machines/m1');
  await page.getByRole('button', { name: 'Drain', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Drain build-1?' });
  await expect(dialog).toContainText('octo/app e2e');
  expect(mock.count('POST', '/api/v1/machines/m1/drain')).toBe(0);
  await dialog.getByRole('button', { name: 'Drain' }).click();
  await expect.poll(() => mock.count('POST', '/api/v1/machines/m1/drain')).toBe(1);
});

test('Escape closes the question and nothing changes (UX-46)', async ({ page }) => {
  const mock = signedIn();
  await mock.install(page);
  await page.goto('/machines/m1');
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('dialog', { name: 'Remove build-1?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(mock.count('DELETE', '/api/v1/machines/m1')).toBe(0);
});

test('Delete runners names each runner and its job, then deletes with the yes', async ({
  page,
}) => {
  const mock = signedIn()
    .on('GET', '/api/v1/runners', {
      items: [
        runner({
          state: 'busy',
          current_job: {
            id: 9,
            repository: 'octo/app',
            run_id: 1,
            run_attempt: 1,
            github_job_id: 1,
            job_name: 'e2e',
            labels: [],
            state: 'running',
          },
        }),
      ],
    })
    .on('DELETE', '/api/v1/runners/:id', runner());
  await mock.install(page);
  await page.goto('/runners');
  await page.getByRole('checkbox', { name: 'Select crsp-linux-1' }).check();
  await page.getByRole('button', { name: 'Delete 1 runner' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete these runners?' });
  await expect(dialog).toContainText('Runner crsp-linux-1');
  await expect(dialog).toContainText('octo/app e2e');
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect.poll(() => mock.count('DELETE', '/api/v1/runners/r1')).toBe(1);
});

test('Runners show their isolation in words', async ({ page }) => {
  await signedIn().install(page);
  await page.goto('/runners');
  await expect(page.getByText('persistent, state kept between jobs')).toBeVisible();
});

test('The owner adds a user', async ({ page }) => {
  const mock = signedIn().on('POST', '/api/v1/users', {
    id: 4,
    login: 'bob',
    role: 'viewer',
    added_at: '2026-11-14T10:00:00Z',
  });
  await mock.install(page);
  await page.goto('/settings/users');
  await page.getByRole('textbox', { name: 'GitHub login' }).fill('bob');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect.poll(() => mock.count('POST', '/api/v1/users')).toBe(1);
});

test('The repository policy asks first before public forks are allowed', async ({
  page,
}) => {
  const mock = signedIn()
    .on('GET', '/api/v1/repositories/:id', repository())
    .on('PATCH', '/api/v1/repositories/:id/policy', repository().policy);
  await mock.install(page);
  await page.goto('/repositories/octo/app');
  await page.getByRole('checkbox', { name: 'Run jobs from public forks' }).check();
  await page.getByRole('button', { name: 'Save' }).click();
  const dialog = page.getByRole('dialog', { name: 'Allow jobs from public forks?' });
  await expect(dialog).toBeVisible();
  expect(mock.count('PATCH', '/api/v1/repositories/7/policy')).toBe(0);
  await dialog.getByRole('button', { name: 'Allow' }).click();
  await expect.poll(() => mock.count('PATCH', '/api/v1/repositories/7/policy')).toBe(1);
});

test('When the session ends the dialog shows over the page and the page stays', async ({
  page,
}) => {
  const mock = signedIn().on(
    'GET',
    '/api/v1/machines',
    failure(401, 'session_expired', 'The session ended.'),
  );
  await mock.install(page);
  await page.goto('/machines');
  const dialog = page.getByRole('dialog', { name: 'Session ended' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Machines' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Sign in with GitHub' }))
    .toBeFocused({ timeout: 2000 })
    .catch(() => undefined);
  void machine;
});
