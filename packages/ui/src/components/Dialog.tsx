// Component 9: one overlay. A centred dialog changes data; it traps focus, locks the page, closes on Escape
// and returns focus to the opener (UX-35, UX-43..UX-48). Never stacked on another overlay.
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  title,
  children,
  onClose,
  cancelLabel = 'Cancel',
  primary,
  modal = true,
  initialFocus = 'safe',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  cancelLabel?: string | undefined;
  primary?: {
    label: string;
    onPress: () => void;
    busy?: boolean | undefined;
    busyLabel?: string | undefined;
    disabled?: boolean | undefined;
    reason?: string | undefined;
    kind?: 'primary' | 'danger' | undefined;
  };
  modal?: boolean | undefined;
  /** Focus lands on the safe choice (Cancel) first (UX-35). */
  initialFocus?: 'safe' | 'first' | undefined;
}) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  // Layout effect: focus is inside the dialog before it is painted, so Escape
  // pressed the moment the dialog shows reaches its key handler.
  useLayoutEffect(() => {
    opener.current = document.activeElement;
    const root = document.getElementById('root');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (root) root.setAttribute('inert', '');
    const safe = box.current?.querySelector<HTMLElement>('[data-safe]');
    const first = box.current?.querySelector<HTMLElement>(FOCUSABLE);
    (initialFocus === 'safe' ? (safe ?? first) : first)?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      if (root) root.removeAttribute('inert');
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [initialFocus]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !box.current) return;
    const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    if (!firstEl || !lastEl) return;
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };

  return createPortal(
    <div className="ds-overlay" data-layout-group>
      <div
        ref={box}
        className="ds-dialog"
        role="dialog"
        aria-modal={modal || undefined}
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <div className="ds-dialog__head">
          <h2 className="ds-h2" id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className="ds-button"
            data-icon
            aria-label="Hide"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="ds-dialog__body">{children}</div>
        <div className="ds-dialog__foot">
          <span data-safe-wrap>
            <button type="button" className="ds-button" data-safe onClick={onClose}>
              {cancelLabel}
            </button>
          </span>
          {primary ? (
            <Button
              kind={primary.kind ?? 'primary'}
              onPress={primary.onPress}
              busy={primary.busy}
              busyLabel={primary.busyLabel}
              disabled={primary.disabled}
              reason={primary.reason}
            >
              {primary.label}
            </Button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** UX-9 and UX-62: ask first in the page. The card names each item that goes and each job it waits for. */
export function QuestionCard({
  title,
  intro,
  items,
  waitsFor,
  action,
  busyLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  intro?: string | undefined;
  items: readonly string[];
  waitsFor?: readonly string[] | undefined;
  action: string;
  busyLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      title={title}
      onClose={busy ? () => undefined : onCancel}
      primary={{ label: action, onPress: onConfirm, busy, busyLabel, kind: 'danger' }}
    >
      {intro ? <p className="ds-text">{intro}</p> : null}
      <ul className="ds-list" aria-label="What goes">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      {waitsFor && waitsFor.length > 0 ? (
        <>
          <p className="ds-text">It waits for these running jobs:</p>
          <ul className="ds-list" aria-label="Running jobs it waits for">
            {waitsFor.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </>
      ) : null}
    </Dialog>
  );
}
