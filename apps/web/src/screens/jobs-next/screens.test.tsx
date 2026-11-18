// A render test of every new Jobs screen, fed by the review mock API (fake data).
import { createApiClient } from '@crsp/contract';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import type { EventSourceLike } from '../../live/store';
import { buildFixtures } from '../../review/fixtures';
import { ReviewApi } from '../../review/mockApi';
import { jobsNextRoutes } from './routes';

class QuietSource implements EventSourceLike {
  onopen = null;
  onerror = null;
  onmessage = null;
  addEventListener(): void {}
  close(): void {}
}

function open(path: string, api = new ReviewApi()) {
  const client = createApiClient('http://review.test', api.fetch as typeof fetch);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App
        client={client}
        eventSource={() => new QuietSource()}
        jobsRoutes={jobsNextRoutes}
      />
    </MemoryRouter>,
  );
}

const data = buildFixtures();
const pick = (f: (j: (typeof data.jobs)[number]) => boolean) => {
  const j = data.jobs.find(f);
  if (!j) throw new Error('no fixture');
  return j;
};

const TABS: [string, string, RegExp][] = [
  ['queue', '/jobs', /Queue/],
  ['running', '/jobs/running', /Running/],
  ['done', '/jobs/done', /Done/],
  ['repository', '/jobs/repository', /Repositories/],
  ['machine', '/jobs/machine', /Machines/],
  ['runner', '/jobs/runner', /Runners/],
  ['runner type', '/jobs/runner-type', /Runner types/],
  ['job type', '/jobs/job-type', /Job types/],
];

afterEach(cleanup);

describe('new Jobs screens with the review mock', () => {
  for (const [name, path, pane] of TABS) {
    it(`renders the ${name} tab with one h1 and its table`, async () => {
      open(path);
      await waitFor(() =>
        expect(screen.getByRole('region', { name: pane })).toBeTruthy(),
      );
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
    });
  }

  it('renders the charts tab', async () => {
    open('/jobs/charts');
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Busiest hours' })).toBeTruthy(),
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows 25 done jobs first and adds 25 on Show more', async () => {
    open('/jobs/done');
    await waitFor(() => expect(screen.getByText(/Showing 25 of/)).toBeTruthy());
    screen.getByRole('button', { name: 'Show 25 more' }).click();
    await waitFor(() => expect(screen.getByText(/Showing 50 of/)).toBeTruthy());
  });

  it('renders a job page for a running, a failed, a queued and a retried job', async () => {
    for (const j of [
      pick((x) => x.state === 'running'),
      pick((x) => x.result === 'failure'),
      pick((x) => x.queue_position === 1),
      pick((x) => x.run_attempt === 2),
    ]) {
      const view = open(`/jobs/${j.id}`);
      await waitFor(() =>
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(j.job_name),
      );
      await waitFor(() =>
        expect(screen.getByRole('region', { name: 'Runner' })).toBeTruthy(),
      );
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      view.unmount();
    }
  });

  it('says "not reported" for a job without a worktree', async () => {
    const j = pick((x) => x.worktree === undefined && x.state === 'done');
    open(`/jobs/${j.id}`);
    await waitFor(() => expect(screen.getByText('not reported')).toBeTruthy());
  });

  it('renders the run page of the long run', async () => {
    const run = data.runs.find((r) => r.jobs.length === 14);
    if (!run) throw new Error('no long run');
    open(`/jobs/run/${run.id}`);
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Timeline' })).toBeTruthy(),
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows the failed state when the list cannot load', async () => {
    const api = new ReviewApi();
    api.failing.add('/api/v1/jobs');
    open('/jobs', api);
    await waitFor(() =>
      expect(screen.getByText(/Could not load the queue list/)).toBeTruthy(),
    );
  });
});
