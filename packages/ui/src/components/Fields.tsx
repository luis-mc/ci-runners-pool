// Component 14: the form field family. The name sits above the box, help between them, and a mistake above
// the box after the action is pressed (UX-20, UX-21). Rows for up to 6 answers, a drop-down for 7 or more
// (UX-22). Switches save at once; check boxes wait for Save.
import { useId, type ReactNode } from 'react';

export interface FieldShellProps {
  label: string;
  help?: string | undefined;
  error?: string | undefined;
  optional?: boolean | undefined;
  width?: 'short' | 'medium' | 'full' | undefined;
}

function Shell({
  label,
  help,
  error,
  optional,
  width = 'medium',
  htmlFor,
  helpId,
  errorId,
  children,
}: FieldShellProps & {
  htmlFor: string;
  helpId: string;
  errorId: string;
  children: ReactNode;
}) {
  return (
    <div
      className="ds-field"
      data-width={width}
      data-invalid={Boolean(error) || undefined}
    >
      <label className="ds-field__label" htmlFor={htmlFor}>
        {label}
        {optional ? ' (optional)' : ''}
      </label>
      {help ? (
        <p className="ds-field__help" id={helpId}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="ds-field__error" id={errorId}>
          {error}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function TextField(
  props: FieldShellProps & {
    value: string;
    onChange: (value: string) => void;
    autoComplete?: string | undefined;
    mono?: boolean | undefined;
    readOnly?: boolean | undefined;
  },
) {
  const id = useId();
  const helpId = `${id}-h`;
  const errorId = `${id}-e`;
  return (
    <Shell {...props} htmlFor={id} helpId={helpId} errorId={errorId}>
      <input
        id={id}
        className="ds-input"
        type="text"
        value={props.value}
        readOnly={props.readOnly}
        autoComplete={props.autoComplete ?? 'off'}
        data-mono={props.mono || undefined}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={
          [props.help ? helpId : '', props.error ? errorId : ''].join(' ').trim() ||
          undefined
        }
        onChange={(e) => props.onChange(e.target.value)}
      />
    </Shell>
  );
}

export interface Choice {
  value: string;
  label: string;
  /** Why the choice cannot be taken (UX-38). */
  disabledReason?: string | undefined;
}

/** A one-choice list (component 13): rows for up to 6 answers, a drop-down for 7 or more (UX-22). */
export function ChoiceField(
  props: FieldShellProps & {
    value: string;
    choices: readonly Choice[];
    onChange: (value: string) => void;
  },
) {
  const id = useId();
  const helpId = `${id}-h`;
  const errorId = `${id}-e`;
  if (props.choices.length >= 7) {
    return (
      <Shell {...props} htmlFor={id} helpId={helpId} errorId={errorId}>
        <select
          id={id}
          className="ds-input"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        >
          {props.choices.map((c) => (
            <option key={c.value} value={c.value} disabled={Boolean(c.disabledReason)}>
              {c.label}
            </option>
          ))}
        </select>
      </Shell>
    );
  }
  return (
    <div
      className="ds-field"
      data-width="full"
      data-invalid={Boolean(props.error) || undefined}
    >
      <fieldset className="ds-choice" aria-describedby={props.help ? helpId : undefined}>
        <legend className="ds-field__label">
          {props.label}
          {props.optional ? ' (optional)' : ''}
        </legend>
        {props.help ? (
          <p className="ds-field__help" id={helpId}>
            {props.help}
          </p>
        ) : null}
        {props.error ? <p className="ds-field__error">{props.error}</p> : null}
        {props.choices.map((c) => (
          <label
            className="ds-choice__row"
            key={c.value}
            data-disabled={Boolean(c.disabledReason) || undefined}
          >
            <input
              type="radio"
              className="ds-radio"
              name={id}
              value={c.value}
              checked={props.value === c.value}
              disabled={Boolean(c.disabledReason)}
              onChange={() => props.onChange(c.value)}
            />
            <span className="ds-choice__text">
              {c.label}
              {c.disabledReason ? (
                <span className="ds-choice__reason"> {c.disabledReason}</span>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

/** Component 22: a check box row. It waits for Save (UX-22). */
export function CheckRow({
  label,
  checked,
  onChange,
  help,
  disabledReason,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string | undefined;
  disabledReason?: string | undefined;
}) {
  return (
    <label
      className="ds-choice__row"
      data-disabled={Boolean(disabledReason) || undefined}
    >
      <input
        type="checkbox"
        className="ds-checkbox"
        checked={checked}
        disabled={Boolean(disabledReason)}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ds-choice__text">
        {label}
        {help ? <span className="ds-choice__reason"> {help}</span> : null}
        {disabledReason ? (
          <span className="ds-choice__reason"> {disabledReason}</span>
        ) : null}
      </span>
    </label>
  );
}

/** A switch: a setting that is saved at once (UX-22). */
export function Switch({
  label,
  on,
  onChange,
  busy = false,
  disabledReason,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  busy?: boolean | undefined;
  disabledReason?: string | undefined;
}) {
  const reasonId = useId();
  return (
    <span className="ds-switch-wrap">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        aria-describedby={disabledReason ? reasonId : undefined}
        className="ds-switch"
        data-on={on || undefined}
        disabled={busy || Boolean(disabledReason)}
        aria-busy={busy || undefined}
        onClick={() => onChange(!on)}
      >
        <span className="ds-switch__word">{on ? 'On' : 'Off'}</span>
      </button>
      {disabledReason ? (
        <span id={reasonId} className="ds-button-reason">
          {disabledReason}
        </span>
      ) : null}
    </span>
  );
}

/** The form's end: Cancel on the left, the one primary on the right (UX-24). */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="ds-form-actions">{children}</div>;
}

/** A list of all the mistakes at the top of a form (UX-21). */
export function ErrorSummary({ errors }: { errors: readonly string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="ds-message" data-tone="problem" role="alert">
      <span className="ds-message__label">
        <span aria-hidden="true">✕</span> Problem
      </span>
      <ul className="ds-list">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
