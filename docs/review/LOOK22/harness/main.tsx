import { createApiClient } from '@crsp/contract';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@app/App';
import { FakeEventSource } from '@app/testing/mock';
import '@crsp/ui/ui.css';
import { makeApi } from './mock';

const q = new URLSearchParams(location.search);
const api = makeApi(q.get('hold') === '1');
const client = createApiClient('http://controller.test', api.fetch as typeof fetch);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter initialEntries={['/machines/m1']}>
      <App client={client} eventSource={(url) => new FakeEventSource(url)} />
    </MemoryRouter>
  </StrictMode>,
);
