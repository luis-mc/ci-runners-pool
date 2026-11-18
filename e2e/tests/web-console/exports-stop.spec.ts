// CRSP37 part C against the mocked API: the audit log export, the config export and Stop on an applying plan
// (web-console 11, UX-30, UX-39, R5.29).
import { expect, test } from '@playwright/test';
import { signedIn, viewer } from './fixtures';

const event = (id: number, action: string) => ({
  id,
  at: '2026-11-14T10:00:00Z',
  actor: 'octo',
  source: 'web',
  action,
  target_type: 'machine',
  target_id: 'm1',
  summary: `did ${action}`,
  result: 'done',
});

test('Audit log: Export saves a file named for what it holds, then the stamp (UX-39)', async ({
  page,
}) => {
  const mock = signedIn().on('GET', '/api/v1/audit', {
    items: [event(2, 'machine.drain'), event(1, 'settings.update')],
  });
  await mock.install(page);
  await page.route('**/api/v1/exports/audit*', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/csv',
        'content-disposition': 'attachment; filename="crsp-audit-2026-11-14-1005.csv"',
      },
      body: 'id,at\n2,x\n1,x\n',
    }),
  );
  await page.goto('/settings/audit');
  await expect(page.getByRole('table', { name: 'Audit log' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  expect((await download).suggestedFilename()).toBe('crsp-audit-2026-11-14-1005.csv');
});

test('Config export: an admin downloads crsp-config-<stamp>.yaml; a viewer sees the reason', async ({
  page,
}) => {
  await signedIn().install(page);
  await page.route('**/api/v1/exports/config', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/yaml',
        'content-disposition': 'attachment; filename="crsp-config-2026-11-14-1005.yaml"',
      },
      body: 'product: crsp\n',
    }),
  );
  await page.goto('/settings/export');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export config' }).click();
  expect((await download).suggestedFilename()).toBe('crsp-config-2026-11-14-1005.yaml');
});

test('Config export: a viewer cannot export', async ({ page }) => {
  await signedIn(viewer).install(page);
  await page.goto('/settings/export');
  await expect(page.getByRole('button', { name: 'Export config' })).toBeDisabled();
});

const steps = (stopped: boolean) => [
  {
    id: 's1',
    action: 'pool_on',
    text: 'Turn on octo/app',
    needs_yes: false,
    state: 'done',
  },
  {
    id: 's2',
    action: 'write_variable',
    text: 'Write RUNS_ON_LINUX',
    needs_yes: false,
    state: stopped ? 'skipped' : 'planned',
  },
];

test('Turn on the pool: Stop ends the plan stopped and Done says what is left', async ({
  page,
}) => {
  let stopped = false;
  const plan = (state: string) => ({
    id: 'p1',
    area: 'repositories',
    state,
    created_at: '2026-11-14T10:00:00Z',
    created_by: 'octo',
    steps: steps(stopped),
  });
  const mock = signedIn()
    .on('POST', '/api/v1/repository-plans', plan('planned'))
    .on('POST', '/api/v1/repository-plans/:id/apply', plan('applying'))
    .on('GET', '/api/v1/repository-plans/:id', () =>
      plan(stopped ? 'stopped' : 'applying'),
    )
    .on('POST', '/api/v1/repository-plans/:id/stop', () => {
      stopped = true;
      return plan('applying');
    });
  await mock.install(page);
  await page.goto('/repositories/turn-on');
  await page.getByRole('checkbox', { name: 'Select octo/app' }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Turn on 1 repository' }).click();
  // Later steps cannot be pressed while the work runs, and Stop is there.
  await expect(page.locator('[data-primary][aria-busy="true"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText(/Stopped\. 1 steps were done and 1 are left/)).toBeVisible({
    timeout: 10_000,
  });
  expect(mock.count('POST', '/api/v1/repository-plans/p1/stop')).toBe(1);
  await expect(page.getByRole('button', { name: 'Start again' })).toBeVisible();
});

test('Add runners: Stop ends the plan stopped and Done says what is left', async ({
  page,
}) => {
  let stopped = false;
  const plan = (state: string) => ({
    id: 'rp1',
    area: 'runners',
    state,
    created_at: '2026-11-14T10:00:00Z',
    created_by: 'octo',
    steps: steps(stopped).map((s) => ({ ...s, action: 'add_runner' })),
  });
  const mock = signedIn()
    .on('GET', '/api/v1/github/repositories', {
      items: [
        {
          id: 7,
          full_name: 'octo/app',
          owner: 'octo',
          name: 'app',
          installation_id: 1,
          visibility: 'private',
          pool_on: true,
          user_is_github_admin: true,
          user_admin_known: true,
          variables: [],
          policy: {
            priority: 0,
            max_parallel_jobs: 2,
            allow_fork_pull_requests: false,
            labels: ['self-hosted'],
            runner_groups: [],
            light_runner: true,
          },
        },
      ],
      stale: { stale: false },
    })
    .on('POST', '/api/v1/runner-plans', plan('planned'))
    .on('POST', '/api/v1/runner-plans/:id/apply', plan('applying'))
    .on('GET', '/api/v1/runner-plans/:id', () => plan(stopped ? 'stopped' : 'applying'))
    .on('POST', '/api/v1/runner-plans/:id/stop', () => {
      stopped = true;
      return plan('applying');
    });
  await mock.install(page);
  await page.goto('/pool/runners/add');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Add 1 runner' }).click();
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText(/Stopped\. 1 steps were done and 1 are left/)).toBeVisible({
    timeout: 10_000,
  });
  expect(mock.count('POST', '/api/v1/runner-plans/rp1/stop')).toBe(1);
});
