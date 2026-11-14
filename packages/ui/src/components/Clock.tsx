// One shared clock for "x ago" (UX-53): it pauses while the page is hidden and catches up when shown.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const ClockContext = createContext<number>(Date.now());

export function ClockProvider({
  children,
  tickMs = 30000,
}: {
  children: ReactNode;
  tickMs?: number | undefined;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), tickMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      stop();
      if (document.visibilityState !== 'hidden') start();
    };
    if (document.visibilityState !== 'hidden') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [tickMs]);
  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

export function useNow(): number {
  return useContext(ClockContext);
}
