// The entry of the RES15 review build: the real console with the real shared parts, fed by fake data. It is a
// separate page (review.html) and a separate bundle; the production entry (main.tsx) never imports this folder.
// Open with `?freeze` for a still clock (screenshots); otherwise running jobs advance with the clock.
import { createApiClient } from '@crsp/contract';
import { Message } from '@crsp/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { App } from '../App';
import type { EventSourceLike } from '../live/store';
import { jobsNextRoutes } from '../screens/jobs-next/routes';
import { FIXED_NOW } from './fixtures';
import { ReviewApi } from './mockApi';
import '@crsp/ui/ui.css';

const frozen = /[?&]freeze\b/.test(window.location.search + window.location.hash);
const started = performance.now();
/** The review clock: a fixed moment that moves with the page, or stands still when frozen. */
const reviewNow = () => (frozen ? FIXED_NOW : FIXED_NOW + (performance.now() - started));
Date.now = reviewNow;

const api = new ReviewApi(reviewNow);
const client = createApiClient('http://review.local', api.fetch as typeof fetch);

/** A stream that only says hello: the snapshot of the fake overview, then silence. */
class FakeEventSource implements EventSourceLike {
  onopen: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: string; lastEventId?: string }) => void) | null = null;
  private listeners: ((e: { data: string }) => void)[] = [];
  private closed = false;
  constructor() {
    setTimeout(() => {
      if (this.closed) return;
      this.onopen?.({});
      const event = {
        id: '1',
        type: 'snapshot',
        at: new Date(reviewNow()).toISOString(),
        snapshot: api.overview(),
      };
      for (const fn of this.listeners) fn({ data: JSON.stringify(event) });
    }, 0);
  }
  addEventListener(type: string, fn: (e: { data: string }) => void): void {
    if (type === 'snapshot') this.listeners.push(fn);
  }
  close(): void {
    this.closed = true;
  }
}

if (!window.location.hash || window.location.hash === '#')
  window.location.hash = '#/jobs';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from review.html');

const banner = (
  <Message tone="note" dismissible={false}>
    Review build with fake data. Nothing here is real and nothing is saved.
  </Message>
);

const router = createHashRouter([
  {
    path: '*',
    element: (
      <App
        client={client}
        eventSource={() => new FakeEventSource()}
        jobsRoutes={jobsNextRoutes}
        banner={banner}
      />
    ),
  },
]);

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
