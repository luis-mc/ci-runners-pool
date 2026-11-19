// Component 57: the row action. The one button at the end of a table row that opens what the row is (UX-72).
// Its words come from the Row action words of content.md: Open run, Open, Open job. The group's name is already in
// the row, so the visible word is short and the reader hears it with the name.
import { Link } from 'react-router-dom';

export function RowAction({
  to,
  label,
  name,
}: {
  to: string;
  /** The visible word, from content.md. */
  label: string;
  /** What it opens, read after the word by a screen reader. */
  name: string;
}) {
  return (
    <Link
      to={to}
      className="ds-button ds-row-action"
      data-kind="default"
      data-button
      role="button"
      aria-label={`${label}: ${name}`}
    >
      {label}
    </Link>
  );
}
