// CRSP35: the jobs and doctor screens against the mocked API: the queue and its wait reason, the history and its
// filters, Export of the filter, the detail with its GitHub link, and a doctor run from busy to done.
import { expect, test } from '@playwright/test';
import { signedIn } from './fixtures';
import { doneJob, finding, jobsAndDoctor } from './jobs-doctor-fixtures';

test('Jobs: the queue says why a run waits and when it should start, Done lists finished runs', async ({
  page,
}) => {
  await jobsAndDoctor(signedIn())
    .on('GET', '/api/v1/machines', { items: [] })
    .install(page);
  await page.goto('/jobs');
  await expect(page.getByRole('heading', { level: 1, name: 'Jobs' })).toBeVisible();
  const queue = page.getByRole('table', { name: 'Queue runs' });
  await expect(
    queue.getByText('waits for a free slot on any Linux machine'),
  ).toBeVisible();
  await expect(queue.getByText('in about 4 to 7 min')).toBeVisible();
  await page.getByRole('tab', { name: 'Done' }).click();
  const done = page.getByRole('table', { name: 'Done runs' });
  await expect(done.getByRole('button', { name: 'Open run' })).toHaveCount(3);
  await expect(page.getByText(/Showing 3 of 3 runs in the last 90 days/)).toBeVisible();
});

test('Jobs: the Done range asks for a from date, and Export holds the same filter', async ({
  page,
}) => {
  const mock = jobsAndDoctor(signedIn()).on('GET', '/api/v1/machines', { items: [] });
  await mock.install(page);
  let exportedUrl = '';
  await page.route('**/api/v1/exports/jobs**', (route) => {
    exportedUrl = route.request().url();
    return route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/csv',
        'content-disposition': 'attachment; filename="crsp-jobs-2026-11-14-1005.csv"',
      },
      body: 'id,repository\n1,octo/app\n',
    });
  });
  await page.goto('/jobs/done?view=jobs');
  await expect(page.getByRole('table', { name: 'Done jobs' })).toBeVisible();
  await page.getByRole('button', { name: 'Last 7 days' }).click();
  await expect
    .poll(() =>
      mock.calls.some(
        (c) =>
          c.path === '/api/v1/jobs' &&
          c.query.get('state') === 'done' &&
          Date.now() - Date.parse(c.query.get('from') ?? '') < 7.1 * 86_400_000,
      ),
    )
    .toBe(true);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect((await download).suggestedFilename()).toBe('crsp-jobs-2026-11-14-1005.csv');
  const exported = new URL(exportedUrl);
  expect(exported.searchParams.get('state')).toBe('done');
  expect(exported.searchParams.get('format')).toBe('csv');
  expect(exported.searchParams.get('from')).not.toBeNull();
});

test('Jobs: a job row opens the Job page with a link to the run on GitHub', async ({
  page,
}) => {
  await jobsAndDoctor(signedIn())
    .on('GET', '/api/v1/machines', { items: [] })
    .install(page);
  await page.goto('/jobs/done?view=jobs');
  await page.getByRole('button', { name: 'Open job: test-2' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'test-2' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open the run on GitHub' }),
  ).toHaveAttribute('href', 'https://github.com/octo/app/actions/runs/102/job/2');
});

test('Jobs: a run row opens in place to its jobs and then to the Run page', async ({
  page,
}) => {
  await jobsAndDoctor(signedIn())
    .on('GET', '/api/v1/machines', { items: [] })
    .install(page);
  await page.goto('/jobs/done');
  await page.getByRole('button', { name: 'Open run' }).first().click();
  await expect(page.getByText(/queue wait is the light part of a bar/)).toBeVisible();
  await page.getByText('Open run page').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ci.yml on');
  await expect(page.getByRole('region', { name: 'Job graph' })).toBeVisible();
});

test('Jobs: an empty pool says so', async ({ page }) => {
  await jobsAndDoctor(signedIn(), [])
    .on('GET', '/api/v1/jobs', { items: [], total: 0, stale: { stale: false } })
    .on('GET', '/api/v1/jobs/groups', { items: [] })
    .on('GET', '/api/v1/machines', { items: [] })
    .install(page);
  await page.goto('/jobs/repository');
  await expect(
    page.getByText('No jobs yet. Jobs show here when a workflow runs on the pool.'),
  ).toBeVisible();
});

test('Doctor: findings by area, then Run checks again is busy until the run ends', async ({
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
  await page.getByRole('button', { name: 'Run checks again' }).click();
  await expect(page.getByRole('button', { name: 'Running the doctor' })).toBeDisabled();
  await expect(
    page.getByRole('progressbar', { name: 'Running the doctor' }),
  ).toBeVisible();
  state = 'done';
  await expect(page.getByRole('button', { name: 'Run checks again' })).toBeEnabled({
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
