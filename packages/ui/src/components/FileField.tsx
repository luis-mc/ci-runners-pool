// Component 14b: the file field. It replaces the browser's own file box with three states: empty (a dashed
// drop zone), chosen (name, size, Change, remove) and refused (danger border and the reason). The person
// chooses one file; the screen reads it and never shows its content (UX-10, UX-20, UX-21, UX-23).
import { useId, useRef, useState, type DragEvent } from 'react';
import type { FieldShellProps } from './Fields';

/** "1.2 KB", "3 MB": the size of a file in words a person reads. */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

function accepts(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  const rules = accept
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((r) =>
    r.startsWith('.')
      ? name.endsWith(r)
      : r.endsWith('/*')
        ? type.startsWith(r.slice(0, -1))
        : type === r,
  );
}

export function FileField({
  label,
  help,
  error,
  optional,
  width = 'full',
  onChange,
  accept,
  disabled,
  validate,
}: FieldShellProps & {
  /** Called with the chosen file, or null when the choice is cleared or refused. */
  onChange: (file: File | null) => void;
  accept?: string | undefined;
  disabled?: boolean | undefined;
  /** Returns the reason a file is refused, or nothing when it is fine. */
  validate?: ((file: File) => string | undefined) | undefined;
}) {
  const id = useId();
  const helpId = `${id}-h`;
  const errorId = `${id}-e`;
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  const [over, setOver] = useState(false);

  const take = (f: File | null | undefined) => {
    if (!f) return;
    const why = !accepts(f, accept) ? `Choose a ${accept} file.` : validate?.(f);
    if (why) {
      setFile(null);
      setRefusal(why);
      onChange(null);
      return;
    }
    setRefusal(undefined);
    setFile(f);
    onChange(f);
  };
  const clear = () => {
    setFile(null);
    setRefusal(undefined);
    if (input.current) input.current.value = '';
    onChange(null);
  };
  const choose = () => input.current?.click();
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) take(e.dataTransfer.files[0]);
  };

  const problem = refusal ?? error;
  const state = file ? 'chosen' : problem ? 'refused' : 'empty';
  return (
    <div
      className="ds-field"
      data-width={width}
      data-invalid={Boolean(problem) || undefined}
    >
      <label className="ds-field__label" htmlFor={id} title={label}>
        {label}
        {optional ? ' (optional)' : ''}
      </label>
      {help ? (
        <p className="ds-field__help" id={helpId}>
          {help}
        </p>
      ) : null}
      {problem ? (
        <p className="ds-field__error" id={errorId}>
          {problem}
        </p>
      ) : null}
      <input
        ref={input}
        id={id}
        className="ds-file__input"
        type="file"
        tabIndex={-1}
        accept={accept}
        disabled={disabled}
        aria-invalid={problem ? true : undefined}
        aria-describedby={
          [help ? helpId : '', problem ? errorId : ''].join(' ').trim() || undefined
        }
        onChange={(e) => take(e.target.files?.[0])}
      />
      <div
        className="ds-file"
        data-state={state}
        data-over={over || undefined}
        data-disabled={disabled || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
      >
        {file ? (
          <>
            <span className="ds-file__icon" aria-hidden="true">
              <svg
                viewBox="0 0 16 16"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 1.5h5l3 3v10H4z" />
                <path d="M9 1.5v3h3" />
              </svg>
            </span>
            <span className="ds-file__meta">
              <span className="ds-file__name" title={file.name}>
                {file.name}
              </span>
              <span className="ds-file__size">{fileSize(file.size)}</span>
            </span>
            <span className="ds-file__actions">
              <button
                type="button"
                className="ds-button"
                disabled={disabled}
                onClick={choose}
              >
                Change
              </button>
              <button
                type="button"
                className="ds-button"
                data-icon
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                onClick={clear}
              >
                ×
              </button>
            </span>
          </>
        ) : (
          <>
            <span className="ds-file__prompt">Drop the file here, or</span>
            <button
              type="button"
              className="ds-button"
              disabled={disabled}
              onClick={choose}
            >
              Choose a file
            </button>
          </>
        )}
      </div>
    </div>
  );
}
