import type { ReactNode } from 'react';
// Component 56: short text. A long name (a branch) is cut in the middle so both its start and its end stay readable:
// "RES15-jobs…ection". The full name is the hover text and is the text a screen reader reads; the detail of the item
// always shows it whole.
export function shortenMiddle(text: string, max = 24): string {
  if (text.length <= max) return text;
  const keep = Math.max(2, max - 1);
  const head = Math.ceil(keep * 0.6);
  const tail = keep - head;
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}

export function ShortText({ text, max = 24 }: { text: string; max?: number }) {
  const short = shortenMiddle(text, max);
  if (short === text) return <>{text}</>;
  return (
    <span className="ds-short" title={text}>
      <span aria-hidden="true">{short}</span>
      <span className="ds-visually-hidden">{text}</span>
    </span>
  );
}

/**
 * A name that may be long (a machine, a runner): it breaks anywhere to fit its box and stops at two lines; the whole
 * name is the hover text and stays in the text a screen reader reads (UX-51, UX-72).
 */
export function ClampText({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <span className="ds-clamp" title={text}>
      {children ?? text}
    </span>
  );
}
