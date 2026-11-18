// Component 55: short text. A long name (a branch) is cut in the middle so both its start and its end stay readable:
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
