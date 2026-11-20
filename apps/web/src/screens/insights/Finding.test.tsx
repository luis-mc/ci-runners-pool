// Run insights, one finding (spec 4.1): the fix, a copyable snippet, evidence, the estimate; one primary only when
// the fix changes the crsp setup (UX-4, UX-8); no dismiss button (R5.45).
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '../../testing/mock';
import { jobsApi } from '../../testing/jobsData';

afterEach(cleanup);

describe('Finding page', () => {
  it('offers Review the change for a setup fix', async () => {
    renderApp(jobsApi(), '/jobs/insights/finding/1');
    expect(await screen.findByRole('button', { name: 'Review the change' })).toBeTruthy();
    expect(screen.getByText(/estimate/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
  });

  it('shows the snippet and no change primary for a repository fix', async () => {
    renderApp(jobsApi(), '/jobs/insights/finding/2');
    await screen.findByLabelText('Workflow snippet');
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Review the change' })).toBeNull();
  });

  it('says so when the finding is not there', async () => {
    renderApp(jobsApi(), '/jobs/insights/finding/99');
    expect(await screen.findByText(/Could not load this finding/)).toBeTruthy();
  });
});
