// Component 8: the pane. A box border with the title cut into the top border, ┤ Title 3 ├, optional actions in the
// same border line, and a focus ring on the border while focus is inside. Every titled part of a page is a pane
// (UX-10, UX-51). Apps pass data and children; they never write a class or a style (UX-2, R6.8).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Pane({
  title,
  count,
  to,
  actions,
  level = 2,
  children,
  footer,
}: {
  title: string;
  /** A number shown after the title, as in ┤ Machines 3 ├. */
  count?: number | undefined;
  /** Makes the title a link (a card that opens a screen). */
  to?: string | undefined;
  /** Buttons for the pane as a whole, drawn in the top border line at the right end. */
  actions?: ReactNode | undefined;
  /** The heading level of the title: 2 for a section of a page, 3 inside a card grid. */
  level?: 2 | 3 | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section
      className="ds-pane"
      aria-label={title}
      data-actions={actions ? true : undefined}
    >
      <Heading className="ds-pane__title">
        {to ? (
          <Link to={to} className="ds-link">
            {title}
          </Link>
        ) : (
          title
        )}
        {count === undefined ? null : <span className="ds-pane__count">{count}</span>}
      </Heading>
      {actions ? <div className="ds-pane__actions">{actions}</div> : null}
      <div className="ds-pane__body">{children}</div>
      {footer ? <div className="ds-pane__footer">{footer}</div> : null}
    </section>
  );
}
