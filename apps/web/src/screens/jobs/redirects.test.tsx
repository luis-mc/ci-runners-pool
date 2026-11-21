// R5.117 (OPS34): the old Jobs addresses land on the new screens; no old screen remains.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '../../testing/mock';
import { jobsApi } from '../../testing/jobsData';

afterEach(cleanup);

describe('the old Jobs addresses', () => {
  it('sends the old trends tab to Charts', async () => {
    renderApp(jobsApi(), '/jobs/trends');
    expect(await screen.findByText(/No finished jobs in this range/)).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Charts' }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('keeps the old job address and the old group tabs', async () => {
    renderApp(jobsApi(), '/jobs/machine');
    expect(await screen.findByText(/No jobs yet/)).toBeTruthy();
  });

  it('shows the six tabs and opens on the Overview', async () => {
    renderApp(jobsApi(), '/jobs');
    await screen.findByRole('region', { name: 'Needs you' });
    const names = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(names).toEqual([
      'Overview',
      'Live',
      'Done',
      'Run elsewhere',
      'Run insights',
      'Charts',
    ]);
    expect(
      screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('sends the old Queue address, with its filter, to Live', async () => {
    renderApp(jobsApi(), '/jobs?repository=octo%2Fapp');
    await screen.findByText('No run matches this filter.');
    expect(screen.getByRole('tab', { name: 'Live' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(
      screen.getByRole('button', { name: 'Queue' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('sends the old Running address to Live with the Running filter', async () => {
    renderApp(jobsApi(), '/jobs/running');
    await screen.findByText('No run is in progress.');
    expect(
      screen.getByRole('button', { name: 'Running' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it.each([
    ['/jobs/repository', 'Repository'],
    ['/jobs/runner-type', 'Runner type'],
    ['/jobs/job-type', 'Job type'],
    ['/jobs/runner', 'Runner'],
    ['/jobs/machine', 'Machine'],
  ])('sends %s to Done grouped by %s', async (path, word) => {
    renderApp(jobsApi(), path);
    await screen.findByRole('group', { name: 'Group by' });
    expect(screen.getByRole('tab', { name: 'Done' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: word }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
