// Reads and writes the PROPOSED Images and caches endpoints (RES19). They are not in the generated contract yet, so
// the typed client is called through a loose shape; the answers are typed by model.ts.
import { useEffect, useState } from 'react';
import { unwrap, useClient } from '../../api/api';
import { useLoad, type Loaded } from '../../api/hooks';

interface LooseClient {
  GET(path: string): Promise<{ data?: unknown; error?: unknown; response: Response }>;
  POST(
    path: string,
    init?: unknown,
  ): Promise<{ data?: unknown; error?: unknown; response: Response }>;
}

/** Seconds between refreshes of a screen that shows a build that runs. */
export const POLL_MS = 5000;

/** A counter that goes up every `ms`, so a screen with a running build asks again (UX-19: the server is the truth). */
export function useTick(ms = POLL_MS): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

/** Loads `path`; a refresh keeps the data on screen (UX-35). `poll` asks again on every tick. */
export function useGet<T>(
  path: string,
  poll = false,
): { result: Loaded<T>; reload: () => void } {
  const client = useClient() as unknown as LooseClient;
  const tick = useTick();
  return useLoad<T>(
    () => unwrap<T>(client.GET(path) as Promise<{ data?: T; response: Response }>),
    [path, poll ? tick : 0],
  );
}

/** A write to a proposed endpoint. */
export function usePostFn(): (path: string) => Promise<unknown> {
  const client = useClient() as unknown as LooseClient;
  return (path: string) =>
    unwrap(client.POST(path, {}) as Promise<{ data?: unknown; response: Response }>);
}
