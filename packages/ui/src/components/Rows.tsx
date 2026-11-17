// Component 45: an open row (a list row that opens its screen) and component 46: a folded section.
import type { ReactNode } from 'react';

/** A row for one item: a name, one status line and a quiet note at the end. The whole row opens the item; Enter works (UX-57). */
export function OpenRow({
  title,
  line,
  aside,
  onOpen,
}: {
  title: string;
  /** One status line under the name. */
  line: ReactNode;
  /** A quiet note at the end; on a phone it drops under the line. */
  aside?: string | undefined;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="ds-open-row" data-list-row onClick={onOpen}>
      <span className="ds-open-row__text">
        <span className="ds-open-row__title">{title}</span>
        <span className="ds-open-row__line">{line}</span>
      </span>
      {aside ? <span className="ds-open-row__aside">{aside} ›</span> : null}
    </button>
  );
}

/** A folded part of a page: one line that opens it. */
export function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="ds-details ds-disclosure">
      <summary>{summary}</summary>
      <div className="ds-disclosure__body">{children}</div>
    </details>
  );
}
