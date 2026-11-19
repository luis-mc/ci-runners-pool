// Component 57: the row action. The one button at the end of a table row that opens what the row is (UX-72).
// Its words come from the Row action words of content.md: Open run, Open, Open job. The group's name is already in
// the row, so the visible word is short and the reader hears it with the name.
import { Link } from 'react-router-dom';
import { Button } from './Button';

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

/**
 * The row action that acts on the row and opens no page (Remove). Same place and same one-line word as `RowAction`;
 * a reader hears the word and the name (`Remove: runner-1`).
 */
export function RowPressAction({
  press,
  label,
  name,
}: {
  press: {
    onPress: () => void;
    kind?: 'default' | 'danger' | undefined;
    disabled?: boolean | undefined;
    reason?: string | undefined;
  };
  /** The visible word, from content.md. */
  label: string;
  /** What it acts on, read after the word by a screen reader. */
  name: string;
}) {
  return (
    <Button
      kind={press.kind ?? 'default'}
      onPress={press.onPress}
      disabled={press.disabled}
      reason={press.reason}
      title={`${label}: ${name}`}
    >
      {label}
    </Button>
  );
}
