// The insight panes of a Repository page (spec 4.4) and the Demand section of Size and backends (spec 4.3).
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp, repository, signedIn } from '../../testing/mock';

afterEach(cleanup);

describe('Repository insight panes', () => {
  it('shows CI checks, Guardrails and Job slots with a normal Review button', async () => {
    const r = repository({ id: 7, full_name: 'octo/app' });
    const api = signedIn()
      .on('GET', '/api/v1/github/repositories', { items: [r], stale: { stale: false } })
      .on('GET', '/api/v1/repositories/:id', r);
    renderApp(api, '/repositories/octo/app');
    expect(await screen.findByRole('region', { name: 'CI checks' })).toBeTruthy();
    expect(screen.getByText('The job has no timeout-minutes.')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Guardrails' })).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'Job slots' })).toBeTruthy();
    const review = await screen.findByRole('button', { name: 'Review the change' });
    expect(review.getAttribute('data-kind')).toBe('default');
  });
});

describe('Demand on Size and backends', () => {
  it('shows the demand and the estimates in words', async () => {
    renderApp(signedIn().on('GET', '/api/v1/machines', { items: [] }), '/pool/size');
    expect(await screen.findByRole('region', { name: 'Demand' })).toBeTruthy();
    expect(screen.getByText(/with 1 more slot the p95 wait would be about/)).toBeTruthy();
    expect(screen.getAllByText(/An estimate from the last 7 days/).length).toBe(2);
  });
});
