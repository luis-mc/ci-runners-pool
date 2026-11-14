import { createApiClient, type ApiClient } from '@crsp/contract';
import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';

const defaultClient = createApiClient();

type Health = { state: 'loading' } | { state: 'ok'; version: string } | { state: 'down' };

function Home({ client }: { client: ApiClient }) {
  const [health, setHealth] = useState<Health>({ state: 'loading' });

  useEffect(() => {
    let live = true;
    client
      .GET('/healthz')
      .then(({ data }) => {
        if (!live) return;
        setHealth(data ? { state: 'ok', version: data.version } : { state: 'down' });
      })
      .catch(() => {
        if (live) setHealth({ state: 'down' });
      });
    return () => {
      live = false;
    };
  }, [client]);

  return (
    <main>
      <h1>CI Runners Shared Pool</h1>
      <p data-testid="health">
        {health.state === 'loading' && 'Checking the controller...'}
        {health.state === 'ok' && `Controller is ok (version ${health.version}).`}
        {health.state === 'down' && 'The controller is not answering.'}
      </p>
    </main>
  );
}

export function App({ client = defaultClient }: { client?: ApiClient }) {
  return (
    <Routes>
      <Route path="*" element={<Home client={client} />} />
    </Routes>
  );
}
