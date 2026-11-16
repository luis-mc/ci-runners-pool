// The one machine list (UX-19): the header, the Overview and the Machines page read it through this hook.
// It reloads when a machine event arrives, on a short timer, and when the tab is shown again, so a machine
// that joined, or a controller whose own PC came up, never leaves a screen saying "no machines".
import { useEffect, useState } from 'react';
import { unwrap, useClient, type Schemas } from './api';
import { useLoad, type Loaded } from './hooks';
import { useVersion } from '../live/LiveProvider';

export const REFRESH_MS = 15_000;

/** A number that goes up on a timer and when the tab comes back: use it as a reload key. */
export function useRefreshTick(ms: number = REFRESH_MS): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const timer = setInterval(bump, ms);
    const shown = () => {
      if (document.visibilityState === 'visible') bump();
    };
    document.addEventListener('visibilitychange', shown);
    window.addEventListener('focus', bump);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', shown);
      window.removeEventListener('focus', bump);
    };
  }, [ms]);
  return tick;
}

export function useMachines(): {
  result: Loaded<Schemas['MachineList']>;
  reload: () => void;
} {
  const client = useClient();
  const v = useVersion('machines');
  const tick = useRefreshTick();
  return useLoad(() => unwrap(client.GET('/api/v1/machines')), [v, tick]);
}
