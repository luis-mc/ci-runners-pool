// Tabs (3), filter chips (12), search bar (21), code block with Copy, number field with the keypad (37).
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { NumberKeypad } from '../pickers/NumberKeypad';
import { commitValue } from '../pickers/number-keypad-logic';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { CaretInput } from './CaretInput';
import { ChangedMark } from './Fields';

export function SearchBar({
  value,
  onChange,
  label = 'Search',
  placeholder,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string | undefined;
  placeholder?: string | undefined;
  /** Focus starts in the box (a list page whose first act is to search). */
  autoFocus?: boolean | undefined;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <div className="ds-search" role="search" data-layout-group>
      <CaretInput
        ref={ref}
        data-search
        className="ds-input"
        type="text"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button
          type="button"
          className="ds-search__clear"
          aria-label="Clear"
          onClick={() => {
            onChange('');
            ref.current?.focus();
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

/**
 * Component 11: the toolbar above a list. One row: search, filters, the selection words and buttons, the count,
 * the actions. It wraps only when the screen is too narrow for one row (UX-7, UX-11, UX-16). A screen passes the
 * parts in their slots and never lays them out itself.
 */
export function ListToolbar({
  label,
  search,
  filters,
  selection,
  count,
  actions,
}: {
  /** The name of the list, for screen readers. */
  label: string;
  search?: ReactNode;
  filters?: ReactNode;
  /** Select all N, Clear, "N selected" and the buttons that act on the selection. */
  selection?: ReactNode;
  /** A short count such as "12 repositories". */
  count?: string | undefined;
  /** The list's own primary action, such as Add. */
  actions?: ReactNode;
}) {
  return (
    <div
      className="ds-list-toolbar"
      role="group"
      aria-label={`${label} toolbar`}
      data-layout-group
    >
      {search}
      {filters}
      {selection}
      {count ? <span className="ds-list-toolbar__count">{count}</span> : null}
      {actions}
    </div>
  );
}

/** Component 12: a few-state filter as joined buttons, one chosen. The empty value shows every item. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  allLabel = 'All',
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | '';
  onChange: (value: T | '') => void;
  /** The word of the option that shows every item; `null` leaves it out (a view switch has no "All"). */
  allLabel?: string | null | undefined;
}) {
  const all: readonly { value: T | ''; label: string }[] = [
    ...(allLabel === null ? [] : [{ value: '' as const, label: allLabel }]),
    ...options,
  ];
  return (
    <div className="ds-segmented" role="group" aria-label={label} data-layout-group>
      {all.map((o) => (
        <button
          key={o.value}
          type="button"
          className="ds-segmented__option"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Filter chips: a few named answers, one chosen or none. */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | '';
  onChange: (value: T | '') => void;
}) {
  return (
    <div className="ds-chips" role="group" aria-label={label} data-layout-group>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="ds-chip"
          aria-pressed={value === o.value}
          onClick={() => onChange(value === o.value ? '' : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs({
  label,
  tabs,
  current,
  onChange,
}: {
  label: string;
  tabs: readonly { id: string; label: string }[];
  current: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="ds-tabs" role="tablist" aria-label={label} data-layout-group>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          className="ds-tab"
          aria-selected={current === t.id}
          tabIndex={current === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** A monospace block with a Copy button (owner question Q2). Copy never changes anything. */
export function CodeBlock({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="ds-codeblock" data-layout-group>
      <pre className="ds-pre" aria-label={label} tabIndex={0}>
        {text}
      </pre>
      <Button
        onPress={() => {
          void navigator.clipboard
            ?.writeText(text)
            .then(() => setDone(true))
            .catch(() => setDone(false));
        }}
      >
        {done ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

/** A count or measure: the value, and a button that opens the number keypad in the one overlay (UX-56). */
export function NumberField({
  label,
  value,
  unit,
  min,
  max,
  decimals,
  onChange,
  help,
  error,
  changed,
}: {
  label: string;
  value: number;
  unit?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
  /** Digits after the point; 0 (the default) takes whole numbers only. */
  decimals?: number | undefined;
  onChange: (value: number) => void;
  help?: string | undefined;
  error?: string | undefined;
  /** The value differs from what is saved: the field is marked "Changed" (LOOK21). */
  changed?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [buffer, setBuffer] = useState(String(value));
  const id = useId();
  const commit = (v: string) => {
    onChange(Number(v));
    setOpen(false);
  };
  return (
    <div
      className="ds-field"
      data-width="short"
      data-invalid={Boolean(error) || undefined}
      data-changed={changed || undefined}
    >
      <div className="ds-field__head">
        <span className="ds-field__label" id={`${id}-l`}>
          {label}
        </span>
        {changed ? <ChangedMark /> : null}
      </div>
      {help ? <p className="ds-field__help">{help}</p> : null}
      {error ? <p className="ds-field__error">{error}</p> : null}
      <button
        type="button"
        className="ds-button ds-number"
        aria-labelledby={`${id}-l ${id}-v`}
        onClick={() => {
          setBuffer(String(value));
          setOpen(true);
        }}
      >
        <span id={`${id}-v`}>
          {value}
          {unit ?? ''}
        </span>
      </button>
      {open ? (
        <Dialog
          title={label}
          size="keypad"
          onClose={() => setOpen(false)}
          initialFocus="first"
          primary={{
            label: 'Done',
            onPress: () => {
              const r = commitValue(buffer, { min, max, decimals });
              if (r.ok) commit(r.value);
            },
            disabled: !commitValue(buffer, { min, max, decimals }).ok,
          }}
        >
          <NumberKeypad
            embedded
            label={label}
            onChange={setBuffer}
            value={String(value)}
            {...(unit ? { unit } : {})}
            {...(min !== undefined ? { min } : {})}
            {...(max !== undefined ? { max } : {})}
            {...(decimals ? { decimals } : {})}
            onDone={commit}
            onCancel={() => setOpen(false)}
          />
        </Dialog>
      ) : null}
    </div>
  );
}

/** A visually hidden text (for screen readers). */
export function Hidden({ children }: { children: ReactNode }) {
  return <span className="ds-visually-hidden">{children}</span>;
}

/** Leave the page by posting a form to another address (GitHub's App manifest flow needs a POST). */
export function postForm(url: string, fields: Readonly<Record<string, string>>): void {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = url;
  for (const [name, value] of Object.entries(fields)) {
    const field = document.createElement('input');
    field.type = 'hidden';
    field.name = name;
    field.value = value;
    form.appendChild(field);
  }
  document.body.appendChild(form);
  form.submit();
}
