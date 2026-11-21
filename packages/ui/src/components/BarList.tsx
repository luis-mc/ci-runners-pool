// Component 60: a bar list, a ranking of named things by one value. Every row is a link to the list behind it
// (UX-52); the bar never replaces the number, and the bars are hidden from assistive technology (UX-17).
import { Link } from 'react-router-dom';

export interface BarItem {
  key: string;
  label: string;
  /** The value that sets the length of the bar. */
  value: number;
  /** The value as text, with its unit. */
  text: string;
  /** What the row opens, for a screen reader. */
  linkName: string;
  to: string;
}

export function BarList({
  label,
  items,
  empty = 'Nothing to rank in this range.',
}: {
  label: string;
  items: readonly BarItem[];
  empty?: string | undefined;
}) {
  if (items.length === 0) return <p className="ds-text">{empty}</p>;
  const top = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="ds-bars" aria-label={label}>
      {items.map((i) => (
        <li key={i.key}>
          <Link
            to={i.to}
            className="ds-bars__row"
            aria-label={`${i.label}: ${i.text}. ${i.linkName}`}
          >
            <span className="ds-bars__label">{i.label}</span>
            <span className="ds-bars__value">{i.text}</span>
            <span className="ds-bars__track" aria-hidden="true">
              <span
                className="ds-bars__bar"
                style={{ inlineSize: `${Math.max(2, (i.value / top) * 100)}%` }}
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
