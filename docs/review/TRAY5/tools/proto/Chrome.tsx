// TRAY5 prototype only (never committed to app code): the window chrome shared by the updater and the installer.
import { useEffect, useState, type ReactNode } from 'react';

export const OPT: 'A' | 'B' | 'C' = '__OPT__' as 'A';

export function Proto({ title, children }: { title: string; children: ReactNode }) {
  const [sub, setSub] = useState('');
  useEffect(() => {
    document.title = `${title} - CI Runners Shared Pool`;
    const read = () => {
      const items = Array.from(document.querySelectorAll('.ds-steps__item'));
      const i = items.findIndex((li) => li.getAttribute('data-standing') === 'now');
      if (i >= 0)
        setSub(`Step ${i + 1} of ${items.length}: ${(items[i]?.textContent ?? '').replace(/^[✓\d]+\s*/, '').trim()}`);
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.body, { subtree: true, attributes: true, childList: true });
    return () => mo.disconnect();
  }, [title]);
  return (
    <div className="proto" data-proto={OPT}>
      <header className="proto-head">
        <img src="/crsp-icon.png" alt="" width={32} height={32} />
        <div className="proto-head__text">
          <b className="proto-name">CI Runners Shared Pool</b>
          <span className="proto-title">{title}</span>
          <span className="proto-sub">{sub}</span>
        </div>
      </header>
      {children}
    </div>
  );
}
