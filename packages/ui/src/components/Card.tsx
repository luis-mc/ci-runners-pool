// Component 8: card (a pane: the title is cut into the top border), card grid and facts list (UX-10, UX-51).
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="ds-card-grid" data-layout-group>
      {children}
    </div>
  );
}

export function Card({
  title,
  count,
  to,
  children,
  footer,
}: {
  title: string;
  /** A number shown after the title, as in ┤ Machines 3 ├. */
  count?: number | undefined;
  to?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
}) {
  return (
    <section className="ds-card" aria-label={title}>
      <h3 className="ds-card__title">
        {to ? (
          <Link to={to} className="ds-link">
            {title}
          </Link>
        ) : (
          title
        )}
        {count === undefined ? null : <span className="ds-card__count">{count}</span>}
      </h3>
      <div className="ds-card__body">{children}</div>
      {footer ? <div className="ds-card__footer">{footer}</div> : null}
    </section>
  );
}

export function Facts({
  items,
}: {
  items: readonly { name: string; value: ReactNode }[];
}) {
  return (
    <dl className="ds-facts">
      {items.map((f) => (
        <div className="ds-facts__row" key={f.name}>
          <dt>{f.name}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
