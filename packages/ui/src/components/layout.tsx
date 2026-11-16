// Layout primitives. Apps pass data and children; they never write a class or a style (UX-2, R6.8).
import type { ReactNode } from 'react';
import { Pane } from './Pane';

type Gap = 'tight' | 'normal' | 'loose';

export function Stack({
  children,
  gap = 'normal',
  as: Tag = 'div',
}: {
  children: ReactNode;
  gap?: Gap | undefined;
  as?: 'div' | 'section' | undefined;
}) {
  return (
    <Tag className="ds-stack" data-gap={gap} data-layout-group>
      {children}
    </Tag>
  );
}

/** A row that wraps. */
export function Cluster({
  children,
  gap = 'normal',
  end = false,
}: {
  children: ReactNode;
  gap?: Gap | undefined;
  end?: boolean | undefined;
}) {
  return (
    <div
      className="ds-cluster"
      data-gap={gap}
      data-end={end || undefined}
      data-layout-group
    >
      {children}
    </div>
  );
}

/** Component 43: a form's short fields in equal columns, as many as fit (UX-10, UX-15, UX-16). */
export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <div className="ds-field-grid" data-layout-group>
      {children}
    </div>
  );
}

export function Text({
  children,
  tone,
  mono,
}: {
  children: ReactNode;
  tone?: 'muted' | undefined;
  mono?: boolean | undefined;
}) {
  return (
    <p className="ds-text" data-tone={tone} data-mono={mono || undefined}>
      {children}
    </p>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="ds-strong">{children}</strong>;
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="ds-code">{children}</code>;
}

/** A titled part of a page: a pane (component 8). The title is a level-2 heading; a hint is a note inside the pane. */
export function Section({
  title,
  children,
  hint,
  actions,
  count,
}: {
  title: string;
  children: ReactNode;
  hint?: string | undefined;
  /** Buttons for the whole section, drawn in the pane's top border line. */
  actions?: ReactNode | undefined;
  count?: number | undefined;
}) {
  return (
    <Pane title={title} count={count} actions={actions}>
      {hint ? <Text tone="muted">{hint}</Text> : null}
      {children}
    </Pane>
  );
}

/** Component 1: the headline, an optional line, and the page's one primary action. */
export function PageHeader({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <header className="ds-page-header">
      <div className="ds-page-header__text">
        <h1 className="ds-h1">{title}</h1>
        {lead ? <p className="ds-page-header__lead">{lead}</p> : null}
      </div>
      {action ? <div className="ds-page-header__action">{action}</div> : null}
    </header>
  );
}

/** The page body of a screen: one stack with a narrow or wide frame. */
export function Page({
  children,
  frame = 'wide',
}: {
  children: ReactNode;
  frame?: 'narrow' | 'wide' | undefined;
}) {
  return (
    <div className="ds-page" data-frame={frame} data-layout-group>
      {children}
    </div>
  );
}

/** A plain list of short lines. */
export function BulletList({
  items,
  label,
}: {
  items: readonly string[];
  label?: string;
}) {
  return (
    <ul className="ds-list" aria-label={label}>
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}
