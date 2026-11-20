// Run elsewhere (owner decision D7): Queue and Running list only jobs crsp can run; a job another runner runs has
// its own filter naming the runner and labels. The API has no runner_origin filter, so the browser filters.
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '../../testing/mock';
import { job, jobsApi } from '../../testing/jobsData';

afterEach(cleanup);

const queued = [
  job({ id: 1, state: 'queued', job_name: 'mine', runner: undefined, queue_position: 1 }),
  job({
    id: 2,
    state: 'queued',
    job_name: 'theirs',
    runner: undefined,
    queue_position: 2,
    runner_origin: 'other',
    runner_name: 'old-pool-3',
    runner_group: 'legacy',
    runner_labels: ['self-hosted', 'old'],
  }),
];

describe('Run elsewhere', () => {
  it('keeps other runners out of the Queue', async () => {
    renderApp(jobsApi({ jobs: queued }), '/jobs?view=jobs');
    await screen.findByText('mine');
    expect(screen.queryByText('theirs')).toBeNull();
  });

  it('lists them under the filter with runner, group and labels', async () => {
    renderApp(jobsApi({ jobs: queued }), '/jobs');
    fireEvent.click(await screen.findByRole('button', { name: 'Run elsewhere' }));
    await screen.findByText('theirs');
    expect(screen.queryByText('mine')).toBeNull();
    expect(screen.getByText(/old-pool-3 \(group legacy; labels self-hosted, old\)/)).toBeTruthy();
  });

  it('says so when nothing runs elsewhere', async () => {
    renderApp(jobsApi({ jobs: [] }), '/jobs?elsewhere=1');
    expect(await screen.findByText('No job runs on another runner.')).toBeTruthy();
  });
});
