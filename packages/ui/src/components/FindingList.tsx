// Component 59: a ranked findings list, best first (UX-76). The `strip` variant is the Needs you strip of the
// Overview: the rank, the title, the minutes a week, the confidence word when the finding has one, the fix, and one
// link. It only shows and links (UX-52): Dismiss and Mark done live on the finding's own page.
import { Link } from 'react-router-dom';

export type Confidence = 'sure' | 'likely' | 'a guess';

export interface FindingItem {
  key: string;
  title: string;
  /** The minutes saved a week, as words (`about 40 min a week`). */
  minutes: string;
  confidence?: Confidence | undefined;
  fix: string;
  to: string;
  /** The link's words, naming the target. */
  linkLabel: string;
}

export function FindingList({
  label,
  items,
  empty = 'Nothing needs you now.',
}: {
  label: string;
  items: readonly FindingItem[];
  empty?: string | undefined;
}) {
  if (items.length === 0) return <p className="ds-text">{empty}</p>;
  return (
    <ol className="ds-findings" aria-label={label}>
      {items.map((f, i) => (
        <li
          key={f.key}
          className="ds-findings__item"
          aria-label={`${i + 1} of ${items.length}: ${f.title}, ${f.minutes}${f.confidence ? `, ${f.confidence}` : ''}`}
        >
          <span className="ds-findings__rank" aria-hidden="true">
            {i + 1}
          </span>
          <div className="ds-findings__text">
            <strong className="ds-findings__title">{f.title}</strong>
            <span className="ds-findings__meta">
              {f.minutes}
              {f.confidence ? ` · ${f.confidence}` : ''}
            </span>
            <span className="ds-findings__fix">{f.fix}</span>
            <Link to={f.to} className="ds-link">
              {f.linkLabel}
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}
