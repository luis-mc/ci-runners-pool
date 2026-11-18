// Reads the PROPOSED Jobs endpoints (RES15). They are not in the generated contract yet, so the typed client is
// called through a loose shape; the answers are typed by model.ts.
import { useEffect, useState } from 'react';
import { unwrap, useClient } from '../../api/api';
import { useLoad, type Loaded } from '../../api/hooks';
import { useVersion } from '../../live/LiveProvider';

interface LooseClient {
  GET(
    path: string,
    init?: { params?: { query?: Record<string, string | number> } },
  ): Promise<{ data?: unknown; error?: unknown; response: Response }>;
}

export type Query = Record<string, string | number | undefined>;

/** Seconds between refreshes of a list that holds running jobs. */
export const POLL_MS = 5000;

/** A counter that goes up every `ms`, so a screen with running jobs asks again. */
export function useTick(ms = POLL_MS): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

/** Loads `path` with a query; a refresh keeps the data on screen (UX-35). `poll` asks again on every tick. */
export function useJobsGet<T>(
  path: string,
  query: Query = {},
  poll = false,
): { result: Loaded<T>; reload: () => void } {
  const client = useClient() as unknown as LooseClient;
  const v = useVersion('jobs');
  const tick = useTick();
  const clean: Record<string, string | number> = {};
  for (const [k, val] of Object.entries(query))
    if (val !== undefined && val !== '') clean[k] = val;
  return useLoad<T>(
    () =>
      unwrap<T>(
        client.GET(path, { params: { query: clean } }) as Promise<{
          data?: T;
          response: Response;
        }>,
      ),
    [path, JSON.stringify(clean), v, poll ? tick : 0],
  );
}
