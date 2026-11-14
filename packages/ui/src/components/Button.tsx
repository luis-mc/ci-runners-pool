// Component 7: buttons. One look per kind. A button that starts work is not pressable while it runs and says
// so (UX-13). A blocked action says why next to it (UX-38). Never a plain link as an action (UX-8).
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type ButtonKind = 'primary' | 'default' | 'stop' | 'danger';

export interface ButtonProps {
  children: ReactNode;
  onPress?: (() => void) | undefined;
  kind?: ButtonKind | undefined;
  /** The request is open: the button locks and shows `busyLabel`. */
  busy?: boolean | undefined;
  busyLabel?: string | undefined;
  /** Why the button is disabled (UX-38). Shown beside the button. */
  reason?: string | undefined;
  disabled?: boolean | undefined;
  submit?: boolean | undefined;
  title?: string | undefined;
  /** What part this is in a shared flow (stop, back, other); read by the wizard harness. */
  part?: 'stop' | 'back' | 'pause' | 'other' | undefined;
  /** The reason is the one line that says what the page waits for (UX-38). */
  reasonIsWait?: boolean | undefined;
  /** The id of a line on the page that says what the button waits for (a busy button points at it). */
  describedBy?: string | undefined;
}

export function Button({
  children,
  onPress,
  kind = 'default',
  busy = false,
  busyLabel,
  reason,
  disabled = false,
  submit = false,
  title,
  part,
  reasonIsWait = false,
  describedBy,
}: ButtonProps) {
  const reasonId = useId();
  const locked = disabled || busy;
  const showReason = Boolean(reason) && disabled && !busy;
  return (
    <span className="ds-button-wrap">
      <button
        type={submit ? 'submit' : 'button'}
        className="ds-button"
        data-kind={kind}
        data-primary={kind === 'primary' || undefined}
        data-busy={busy || undefined}
        disabled={locked}
        aria-busy={busy || undefined}
        aria-describedby={showReason ? reasonId : describedBy}
        title={title}
        data-part={part}
        onClick={onPress}
      >
        {busy ? (busyLabel ?? 'Working') : children}
      </button>
      {showReason ? (
        <span
          id={reasonId}
          className="ds-button-reason"
          data-wait={reasonIsWait || undefined}
        >
          {reason}
        </span>
      ) : null}
    </span>
  );
}

/** A link that goes to a page and looks like a button (the screen's way to Open something). */
export function LinkButton({
  to,
  children,
  kind = 'default',
}: {
  to: string;
  children: ReactNode;
  kind?: ButtonKind | undefined;
}) {
  return (
    <Link to={to} className="ds-button" data-kind={kind} data-button role="button">
      {children}
    </Link>
  );
}

/** A link inside text that goes to a page. Information, not an action (UX-8). */
export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="ds-link">
      {children}
    </Link>
  );
}

/** A button that opens an address on another site in a new tab (the run on GitHub). */
export function ExternalButton({
  href,
  children,
  kind = 'default',
}: {
  href: string;
  children: ReactNode;
  kind?: ButtonKind | undefined;
}) {
  return (
    <a
      href={href}
      className="ds-button"
      data-kind={kind}
      data-button
      role="button"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}
