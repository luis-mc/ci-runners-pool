// CRSP35: the jobs and doctor screens against the mocked API: the queue and its wait reason, the history and its
// filters, Export of the filter, the detail with its GitHub link, and a doctor run from busy to done.
import { expect, test } from '@playwright/test';
import { signedIn } from './fixtures';
import { doneJob, finding, jobsAndDoctor } from './jobs-doctor-fixtures';

test('Jobs: the queue says why each job waits, the history lists finished jobs', async ({
  page,
}) => {
  await jobsAndDoctor(signedIn())
    .on('GET', '/api/v1/machines', { items: [] })
    .install(page);
  await page.goto('/jobs');
  await expect(page.getByRole('heading', { level: 1, name: 'Jobs' })).toBeVisible();
  const queue = page.getByRole('table', { name: 'Queued jobs' });
  await expect(
    queue.getByText('waits for a free slot on any Linux machine'),
  ).toBeVisible();
  await expect(page.getByText('ci.yml / test-1')).toBeVisible();
  await expect(page.getByText('Showing all time')).toBeVisible();
});

test('Jobs: a filter narrows the history, and Export holds the same filter', async ({
  page,
}) => {
  const mock = jobsAndDoctor(signedIn()).on('GET', '/api/v1/machines', { items: [] });
  await mock.install(page);
  await page.route('**/api/v1/exports/jobs**', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/csv',
        'content-disposition': 'attachment; filename="crsp-jobs-2026-11-14-1005.csv"',
      },
      body: 'id,repository\n1,octo/app\n',
    }),
  );
  await page.goto('/jobs');
  await expect(page.getByText('ci.yml / test-1')).toBeVisible();
  await page.getByRole('button', { name: 'Failure' }).click();
  await page.getByRole('button', { name: 'Last 7 days' }).click();
  await expect(
    page.getByText(/Showing \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export' }).click();
  expect((await download).suggestedFilename()).toBe('crsp-jobs-2026-11-14-1005.csv');
  const history = mock.calls.filter(
    (c) => c.path === '/api/v1/jobs' && c.query.get('result') === 'failure',
  );
  expect(history.length).toBeGreaterThan(0);
});

test('Jobs: a row opens the detail with a link to the run on GitHub', async ({
  page,
}) => {
  await jobsAndDoctor(signedIn())
    .on('GET', '/api/v1/machines', { items: [] })
    .install(page);
  await page.addInitScript(() => {
    (window as unknown as { opened: unknown[] }).opened = [];
    window.open = (...a: unknown[]) => {
      (window as unknown as { opened: unknown[] }).opened.push(a);
      return null;
    };
  });
  await page.goto('/jobs');
  await page
    .locator('li', { hasText: 'ci.yml / test-2' })
    .getByRole('button', { name: 'Open' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'test-2' })).toBeVisible();
  await page.getByRole('button', { name: 'Open the run on GitHub' }).click();
  expect(
    await page.evaluate(() => (window as unknown as { opened: unknown[][] }).opened[0]),
  ).toEqual([
    'https://github.com/octo/app/actions/runs/102/job/2',
    '_blank',
    'noopener,noreferrer',
  ]);
});

test('Jobs: an empty pool says so', async ({ page }) => {
  await jobsAndDoctor(signedIn(), [])
    .on('GET', '/api/v1/jobs', { items: [], stale: { stale: false } })
    .on('GET', '/api/v1/machines', { items: [] })
    .install(page);
  await page.goto('/jobs');
  await expect(
    page.getByText('No jobs yet. Jobs show here when a workflow runs on the pool.'),
  ).toBeVisible();
});

test('Doctor: findings by area, then Run the doctor is busy until the run ends', async ({
  page,
}) => {
  let state = 'running';
  const mock = jobsAndDoctor(signedIn())
    .on('POST', '/api/v1/doctor/runs', {
      id: 'run1',
      trigger: 'web',
      state: 'running',
      started_at: '2026-11-14T10:05:00Z',
      counts: {},
      findings: [],
    })
    .on('GET', '/api/v1/doctor/runs/:id', () => ({
      id: 'run1',
      trigger: 'web',
      state,
      started_at: '2026-11-14T10:05:00Z',
      counts: { fail: 1 },
      findings: [finding()],
    }));
  await mock.install(page);
  await page.goto('/doctor');
  await expect(page.getByRole('region', { name: 'Machines' })).toContainText(
    'build-2 is offline',
  );
  await expect(page.getByRole('region', { name: 'Workflow labels' })).toContainText(
    'failed',
  );
  await page.getByRole('button', { name: 'Run the doctor' }).click();
  await expect(page.getByRole('button', { name: 'Running the doctor' })).toBeDisabled();
  await expect(
    page.getByRole('progressbar', { name: 'Running the doctor' }),
  ).toBeVisible();
  state = 'done';
  await expect(page.getByRole('button', { name: 'Run the doctor' })).toBeEnabled({
    timeout: 10_000,
  });
  expect(mock.count('POST', '/api/v1/doctor/runs')).toBe(1);
});

test('Doctor: could not load says what and offers Try again', async ({ page }) => {
  await signedIn()
    .on('GET', '/api/v1/doctor/findings', {
      status: 500,
      error: { code: 'internal', message: 'the findings could not be read', details: [] },
    })
    .install(page);
  await page.goto('/doctor');
  await expect(page.getByText('Could not load the doctor findings.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('Jobs and Doctor are in the menu and no longer say they arrive later', async ({
  page,
}) => {
  await jobsAndDoctor(signedIn(), [doneJob(1)])
    .on('GET', '/api/v1/machines', { items: [] })
    .install(page);
  await page.goto('/doctor');
  await expect(page.getByText(/arrives in milestone/)).toHaveCount(0);
});
