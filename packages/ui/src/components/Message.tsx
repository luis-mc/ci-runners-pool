// Component 18: messages have four tones, never by colour alone (UX-26). One banner slot app-wide (UX-27).
import type { ReactNode } from 'react';

export type Tone = 'done' | 'note' | 'needs-you' | 'problem';

const LABEL: Record<Tone, string> = {
  done: 'Done',
  note: 'Note',
  'needs-you': 'Needs you',
  problem: 'Problem',
};
const GLYPH: Record<Tone, string> = {
  done: '✓',
  note: 'ⓘ',
  'needs-you': '◷',
  problem: '✕',
};

export function Message({
  tone,
  children,
  action,
}: {
  tone: Tone;
  children: ReactNode;
  action?: ReactNode | undefined;
}) {
  return (
    <div
      className="ds-message"
      data-tone={tone}
      role={tone === 'problem' ? 'alert' : 'status'}
      data-layout-group
    >
      <span className="ds-message__label">
        <span aria-hidden="true">{GLYPH[tone]}</span> {LABEL[tone]}
      </span>
      <span className="ds-message__body">{children}</span>
      {action ? <span className="ds-message__action">{action}</span> : null}
    </div>
  );
}

/** The one app-wide banner slot (UX-27). */
export function BannerSlot({ children }: { children?: ReactNode }) {
  return (
    <div className="ds-banner-slot ds-band" data-empty={!children || undefined}>
      {children}
    </div>
  );
}
