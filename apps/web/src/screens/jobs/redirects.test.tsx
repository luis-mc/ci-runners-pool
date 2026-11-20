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

  it('shows every tab of the section', async () => {
    renderApp(jobsApi(), '/jobs');
    await screen.findByText('Nothing is waiting. Every job has a slot.');
    const names = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(names).toEqual([
      'Queue',
      'Running',
      'Done',
      'By repository',
      'By machine',
      'By runner',
      'By runner type',
      'By job type',
      'Run insights',
      'Charts',
    ]);
  });
});
