// Component 16: a progress bar. A known total is a filled bar; an unknown total is an animated bar (UX-29).
// LevelBar shows a level against a budget (UX-41) with its value in words.
export function Progress({
  label,
  value,
  max,
}: {
  label: string;
  value?: number | undefined;
  max?: number | undefined;
}) {
  const known = value !== undefined && max !== undefined && max > 0;
  return (
    <div
      className="ds-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={known ? 0 : undefined}
      aria-valuemax={known ? max : undefined}
      aria-valuenow={known ? value : undefined}
      aria-valuetext={known ? `${value} of ${max}` : label}
      data-known={known || undefined}
    >
      <span
        className="ds-progress__fill"
        style={
          known
            ? { inlineSize: `${Math.min(100, ((value ?? 0) / (max ?? 1)) * 100)}%` }
            : {}
        }
      />
    </div>
  );
}

export function LevelBar({
  label,
  value,
  max,
  text,
}: {
  label: string;
  value: number;
  max: number;
  text: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="ds-level">
      <span className="ds-level__name">{label}</span>
      <div
        className="ds-level__bar"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={text}
        data-over={value > max || undefined}
      >
        <span className="ds-level__fill" style={{ inlineSize: `${pct}%` }} />
      </div>
      <span className="ds-level__text">{text}</span>
    </div>
  );
}
