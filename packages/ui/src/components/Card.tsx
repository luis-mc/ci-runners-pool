// Component 8: card (a pane: the title is cut into the top border), card grid and facts list (UX-10, UX-51).
import type { ReactNode } from 'react';
import { Pane } from './Pane';

export function CardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="ds-card-grid" data-layout-group>
      {children}
    </div>
  );
}

/** A pane inside a card grid: its title is a level-3 heading and may open a screen. */
export function Card({
  title,
  count,
  to,
  children,
  footer,
  id,
}: {
  title: string;
  count?: number | undefined;
  to?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  id?: string | undefined;
}) {
  return (
    <Pane title={title} count={count} to={to} level={3} footer={footer} id={id}>
      {children}
    </Pane>
  );
}

export function Facts({
  items,
}: {
  items: readonly { name: string; value: ReactNode; help?: ReactNode }[];
}) {
  return (
    <dl className="ds-facts">
      {items.map((f) => (
        <div className="ds-facts__row" key={f.name}>
          <dt>
            {f.name}
            {f.help}
          </dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
