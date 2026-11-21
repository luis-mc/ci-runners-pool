// Components 64, 65, 66 (LOOK44): the Help page parts. Job path: the parts a job passes through, in order. Stepper: the
// step bar of a read-only tour (the same look as the wizard's step bar). Term help: the ? next to a word that opens a
// short answer and a link to the same card on the Help page. Pages pass data only (UX-2, UX-54).
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePopoverDismiss } from './Popover';

export interface JobPathPart {
  id: string;
  /** The part's name, one or two words: Run. */
  title: string;
  /** One short line under the name: one start of a workflow. */
  line: string;
  /** The group frame the part sits in. */
  group: string;
}

export interface JobPathGroup {
  id: string;
  label: string;
}

/**
 * Component 64. The parts of a job's way as numbered boxes in two framed groups (On GitHub, In your pool), left to
 * right on a wide screen and top to bottom on a phone. With `onSelect` each box is a button; the lit parts are the
 * ones of the current step. Without it the picture is read only (the first-run Overview).
 */
export function JobPath({
  label,
  parts,
  groups,
  lit,
  onSelect,
}: {
  label: string;
  parts: readonly JobPathPart[];
  groups: readonly JobPathGroup[];
  lit?: readonly string[] | undefined;
  onSelect?: ((id: string) => void) | undefined;
}) {
  return (
    <ol className="ds-jobpath" aria-label={label} data-layout-group>
      {groups.map((g) => (
        <li key={g.id} className="ds-jobpath__group" data-group={g.id}>
          <span className="ds-jobpath__label">{g.label}</span>
          <ol className="ds-jobpath__parts">
            {parts
              .map((p, i) => ({ p, n: i + 1 }))
              .filter(({ p }) => p.group === g.id)
              .map(({ p, n }) => {
                const inner = (
                  <>
                    <span className="ds-jobpath__n" aria-hidden="true">
                      {n}
                    </span>
                    <span className="ds-jobpath__title">{p.title}</span>
                    <span className="ds-jobpath__line">{p.line}</span>
                  </>
                );
                const on = lit?.includes(p.id) || undefined;
                return (
                  <li key={p.id} className="ds-jobpath__part" data-lit={on}>
                    {onSelect ? (
                      <button
                        type="button"
                        className="ds-jobpath__box"
                        aria-pressed={Boolean(on)}
                        onClick={() => onSelect(p.id)}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div className="ds-jobpath__box">{inner}</div>
                    )}
                  </li>
                );
              })}
          </ol>
        </li>
      ))}
    </ol>
  );
}

/**
 * Component 65. A step bar for a read-only tour. A step up to `reached` can be pressed; a later step is grey and not
 * pressable until the tour has got there. The current step is marked. Nothing here starts work, so there is no Stop.
 */
export function Stepper({
  label,
  steps,
  current,
  reached,
  onStep,
}: {
  label: string;
  steps: readonly string[];
  current: number;
  reached: number;
  onStep: (index: number) => void;
}) {
  return (
    <ol className="ds-steps" aria-label={label} data-layout-group>
      {steps.map((name, i) => {
        const standing = i === current ? 'now' : i <= reached ? 'done' : 'later';
        return (
          <li key={name} className="ds-steps__item" data-standing={standing}>
            <button
              type="button"
              className="ds-steps__button"
              aria-current={standing === 'now' ? 'step' : undefined}
              disabled={standing === 'later'}
              onClick={() => onStep(i)}
            >
              <span className="ds-steps__n" aria-hidden="true">
                {standing === 'done' ? '✓' : i + 1}
              </span>{' '}
              {name}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export const TERM_HELP_WORDS = { more: 'More about this in Help' } as const;

/**
 * Component 66. A ? button beside a term. It opens a short answer in a popover (a bottom sheet on a phone) with a
 * link to the same card on the Help page. Escape and a press outside close it (LOOK30).
 */
export function TermHelp({
  term,
  answer,
  to,
}: {
  /** The word it explains: Slots. The button is named `What does Slots mean?`. */
  term: string;
  /** One or two short sentences. */
  answer: ReactNode;
  /** The Help card of the term: `/help#q-slot`. */
  to: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { buttonRef, panelRef } = usePopoverDismiss(open, () => setOpen(false));
  return (
    <span className="ds-termhelp">
      <button
        ref={buttonRef}
        type="button"
        className="ds-termhelp__button"
        data-term-help
        aria-label={`What does ${term} mean?`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={id}
          className="ds-popover ds-termhelp__panel"
          role="group"
          aria-label={term}
        >
          <strong className="ds-strong">{term}</strong>
          <p className="ds-text">{answer}</p>
          <Link to={to} className="ds-link" onClick={() => setOpen(false)}>
            {TERM_HELP_WORDS.more}
          </Link>
        </div>
      ) : null}
    </span>
  );
}
