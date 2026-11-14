// Component 19: empty, failed and loading states (UX-6, UX-28, UX-29). No dead ends: each offers a next step.
import type { ReactNode } from 'react';
import { Progress } from './Progress';

export function Loading({ what }: { what: string }) {
  return (
    <div className="ds-state" data-state="loading" role="status" data-layout-group>
      <p className="ds-text">{what}</p>
      <Progress label={what} />
    </div>
  );
}

export function Empty({
  title,
  action,
}: {
  title: string;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="ds-state" data-state="empty" data-layout-group>
      <p className="ds-text">{title}</p>
      {action ?? null}
    </div>
  );
}

/** "Could not load" says what, why and what next (UX-28). A fault in the page's own code says so. */
export function Failed({
  what,
  why,
  fault = false,
  details,
  action,
}: {
  what: string;
  why: string;
  fault?: boolean | undefined;
  details?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="ds-state" data-state="failed" role="alert" data-layout-group>
      <p className="ds-text">
        <strong className="ds-strong">{fault ? 'This page hit a fault.' : what}</strong>{' '}
        {fault ? '' : why}
      </p>
      {details ? (
        <details className="ds-details">
          <summary>Details</summary>
          <pre className="ds-pre">{details}</pre>
        </details>
      ) : null}
      {action ?? null}
    </div>
  );
}
