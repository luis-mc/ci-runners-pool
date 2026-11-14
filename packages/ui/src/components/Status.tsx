// UX-58: a status is a word, a glyph and a colour. The word is always there; colour never stands alone.
// UX-61: a runner names its isolation.
export type StatusKind = 'ok' | 'waiting' | 'failed' | 'info' | 'running' | 'off';

const GLYPH: Record<StatusKind, string> = {
  ok: '✓',
  waiting: '◷',
  failed: '✕',
  info: 'ⓘ',
  running: '▶',
  off: '○',
};

export function Status({ kind, word }: { kind: StatusKind; word: string }) {
  return (
    <span className="ds-status" data-status={kind}>
      <span aria-hidden="true" className="ds-status__glyph">
        {GLYPH[kind]}
      </span>{' '}
      <span className="ds-status__word">{word}</span>
    </span>
  );
}

/** Component 17: a count or a small label. */
export function Badge({ children }: { children: string }) {
  return <span className="ds-badge">{children}</span>;
}
