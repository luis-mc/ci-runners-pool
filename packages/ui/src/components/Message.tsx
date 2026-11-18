// Component 18: messages have four tones, never by colour alone (UX-26). One banner slot app-wide (UX-27).
import { Children, isValidElement, useState, type ReactNode } from 'react';

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

const STORE = 'ds-note-dismissed:';

/** The plain text of a node: a note comes back when this changes. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return Children.toArray(node as ReactNode)
    .map((c) => (c === node ? '' : textOf(c)))
    .join('');
}

const storeKey = (id: string): string => STORE + id;
const wasDismissed = (id: string, text: string): boolean => {
  try {
    return window.localStorage.getItem(storeKey(id)) === text;
  } catch {
    return false;
  }
};
const remember = (id: string, text: string): void => {
  try {
    window.localStorage.setItem(storeKey(id), text);
  } catch {
    /* blocked storage: the note is hidden for this view only */
  }
};

export function Message({
  tone,
  children,
  action,
  dismissible = true,
  id,
}: {
  tone: Tone;
  children: ReactNode;
  action?: ReactNode | undefined;
  /** A note can be dismissed unless it is a short state note (false). Other tones never can. */
  dismissible?: boolean | undefined;
  /** Names the note in storage. Default: the note's text, so a new text is a new note. */
  id?: string | undefined;
}) {
  const text = textOf(children);
  const noteId = id ?? text;
  const canDismiss = tone === 'note' && !action && dismissible;
  const [hiddenText, setHiddenText] = useState<string | null>(null);
  if (canDismiss && (hiddenText === text || wasDismissed(noteId, text))) return null;
  return (
    <div
      className="ds-message"
      data-tone={tone}
      data-dismissible={canDismiss || undefined}
      role={tone === 'problem' ? 'alert' : 'status'}
      data-layout-group
    >
      <span className="ds-message__label">
        <span aria-hidden="true">{GLYPH[tone]}</span> {LABEL[tone]}
      </span>
      <span className="ds-message__body">{children}</span>
      {action ? <span className="ds-message__action">{action}</span> : null}
      {canDismiss ? (
        <button
          type="button"
          className="ds-message__dismiss"
          aria-label="Hide"
          onClick={() => {
            remember(noteId, text);
            setHiddenText(text);
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
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
