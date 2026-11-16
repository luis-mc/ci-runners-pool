// Component 19: empty, failed and loading states (UX-6, UX-28, UX-29). No dead ends: each offers a next step,
// once. A page that shows its headline with the state passes `pageTitle`: the state then draws the page h1 itself
// (so a failed or empty page keeps its h1, UX-17) and the next action appears in the state only, never also in the
// header (UX-64). The page passes its action to the state, not to the header.
import type { ReactNode } from 'react';
import { PageHeader } from './layout';
import { Progress } from './Progress';

function WithTitle({
  pageTitle,
  children,
}: {
  pageTitle?: string | undefined;
  children: ReactNode;
}) {
  if (!pageTitle) return <>{children}</>;
  return (
    <div className="ds-state-page">
      <PageHeader title={pageTitle} />
      {children}
    </div>
  );
}

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
  pageTitle,
}: {
  title: string;
  /** The one next step. */
  action?: ReactNode | undefined;
  /** The page headline, drawn as the h1 above the state. */
  pageTitle?: string | undefined;
}) {
  return (
    <WithTitle pageTitle={pageTitle}>
      <div className="ds-state" data-state="empty" data-layout-group>
        <p className="ds-text">{title}</p>
        {action ?? null}
      </div>
    </WithTitle>
  );
}

/** "Could not load" says what, why and what next (UX-28). A fault in the page's own code says so. */
export function Failed({
  what,
  why,
  fault = false,
  details,
  action,
  pageTitle,
}: {
  what: string;
  why: string;
  fault?: boolean | undefined;
  details?: string | undefined;
  /** The one next step, such as Try again. */
  action?: ReactNode | undefined;
  /** The page headline, drawn as the h1 above the state. */
  pageTitle?: string | undefined;
}) {
  return (
    <WithTitle pageTitle={pageTitle}>
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
    </WithTitle>
  );
}
