import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { createApiClient } from '@crp/contract';
import { App } from './App';

afterEach(cleanup);

function clientAnswering(response: Response) {
  return createApiClient('http://controller.test', () => Promise.resolve(response));
}

describe('App', () => {
  it('shows the title and the controller health', async () => {
    const response = Response.json({ status: 'ok', version: '1.2.3' });
    render(
      <MemoryRouter>
        <App client={clientAnswering(response)} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'CI Runners Pool' })).toBeTruthy();
    expect((await screen.findByTestId('health')).textContent).toContain('version 1.2.3');
  });

  it('says so when the controller does not answer', async () => {
    const response = Response.json(
      { error: { code: 'unavailable', message: 'down' } },
      { status: 503 },
    );
    render(
      <MemoryRouter>
        <App client={clientAnswering(response)} />
      </MemoryRouter>,
    );
    expect((await screen.findByTestId('health')).textContent).toContain('not answering');
  });
});
