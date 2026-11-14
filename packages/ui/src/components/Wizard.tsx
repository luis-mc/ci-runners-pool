// Component 4: the shared wizard (UX-5, UX-30, UX-54). Current step, locks, Stop, busy and Done live HERE.
// A page passes data only: the phase it reads from the server, the steps, the primary and the step content.
// The ten phases are the ten states of the wizard harness (scripts/design/wizard-behaviour.ts).
import { useId, type ReactNode } from 'react';
import { Button } from './Button';
import { Progress } from './Progress';

export type WizardPhase =
  | 'loading'
  | 'first-run'
  | 'planning'
  | 'ready-to-review'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'failed'
  | 'done'
  | 'done-after-reload';

export interface WizardPrimary {
  label: string;
  onPress: () => void;
  /** Shown beside a disabled primary, and the busy words while the work runs. */
  busyLabel?: string | undefined;
  disabled?: boolean | undefined;
  reason?: string | undefined;
}

export interface WizardProps {
  /** The wizard's name, used for landmarks. */
  name: string;
  /** Step names. A wizard that changes something ends with Review, the work, Done (UX-30). */
  steps: readonly string[];
  /** Index of the current step. */
  current: number;
  phase: WizardPhase;
  /** What the loading step is reading ("Reading the controller"). Said once (UX-38). */
  reading?: string | undefined;
  /** The work step's live line: the item in hand, n of N, the time left (UX-29). */
  progress?:
    { text: string; value?: number | undefined; max?: number | undefined } | undefined;
  canStop?: boolean | undefined;
  /** Stop was pressed and the work has not ended yet. */
  stopping?: boolean | undefined;
  onStop?: (() => void) | undefined;
  onBack?: (() => void) | undefined;
  onStep?: ((index: number) => void) | undefined;
  /** The one primary of the current step (not used in running, paused, stopped, failed, done). */
  primary: WizardPrimary;
  /** The next action on Done, when it is not Start again ("Sign in with GitHub"). */
  donePrimary?: { label: string; onPress: () => void };
  onStartAgain?: (() => void) | undefined;
  onTryAgain?: (() => void) | undefined;
  /** The first step the user acts on (a read-only step before it has no Back). */
  firstStep?: number | undefined;
  /** Show "Nothing has changed yet." (on the Review step). */
  review?: boolean | undefined;
  /** The words for the state a stored run is in, said once above the content. */
  stateNote?: string | undefined;
  children: ReactNode;
}

const END: readonly WizardPhase[] = ['done', 'done-after-reload', 'stopped', 'failed'];

export function Wizard(p: WizardProps) {
  const runId = useId();
  const last = p.steps.length - 1;
  const locked = p.phase === 'running' || p.phase === 'loading';
  const atEnd = END.includes(p.phase);
  const current = atEnd && p.phase !== 'failed' ? last : p.current;
  const isDone = p.phase === 'done' || p.phase === 'done-after-reload';

  let primary: ReactNode;
  if (p.phase === 'loading') {
    primary = (
      <Button kind="primary" disabled reason={p.reading ?? 'Reading'} reasonIsWait>
        {p.primary.label}
      </Button>
    );
  } else if (p.phase === 'running') {
    primary = (
      <Button
        kind="primary"
        busy
        busyLabel={p.primary.busyLabel ?? 'Working'}
        disabled
        describedBy={`${runId}-line`}
      >
        {p.primary.label}
      </Button>
    );
  } else if (isDone) {
    primary = p.donePrimary ? (
      <Button kind="primary" onPress={p.donePrimary.onPress}>
        {p.donePrimary.label}
      </Button>
    ) : (
      <Button kind="primary" onPress={p.onStartAgain}>
        Start again
      </Button>
    );
  } else if (p.phase === 'stopped' || p.phase === 'paused') {
    primary = (
      <Button kind="primary" onPress={p.onStartAgain}>
        Start again
      </Button>
    );
  } else if (p.phase === 'failed') {
    primary = (
      <Button kind="primary" onPress={p.onTryAgain}>
        Try again
      </Button>
    );
  } else {
    primary = (
      <Button
        kind="primary"
        onPress={p.primary.onPress}
        disabled={p.primary.disabled}
        reason={p.primary.reason}
      >
        {p.primary.label}
      </Button>
    );
  }

  const showBack = !locked || p.phase === 'loading';
  const canStopNow = p.phase === 'running' && p.canStop;

  return (
    <div className="ds-wizard" data-phase={p.phase} role="group" aria-label={p.name}>
      <ol className="ds-steps" aria-label="Steps" data-layout-group>
        {p.steps.map((name, i) => {
          const standing = i < current ? 'done' : i === current ? 'now' : 'later';
          const pressable =
            standing === 'done' && !locked && p.phase !== 'paused' && Boolean(p.onStep);
          return (
            <li key={name} className="ds-steps__item" data-standing={standing}>
              <button
                type="button"
                className="ds-steps__button"
                aria-current={standing === 'now' ? 'step' : undefined}
                disabled={!pressable && standing !== 'now'}
                onClick={() => p.onStep?.(i)}
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
      <div className="ds-wizard__body" data-layout-group>
        {p.stateNote ? <p className="ds-text">{p.stateNote}</p> : null}
        {p.phase === 'loading' ? <Progress label={p.reading ?? 'Reading'} /> : null}
        {p.phase === 'running' ? (
          <div className="ds-stack" data-gap="tight" data-layout-group>
            <p className="ds-text" role="status" id={`${runId}-line`}>
              {p.progress?.text ?? p.primary.busyLabel ?? 'Working'}
            </p>
            <Progress
              label={p.progress?.text ?? p.primary.busyLabel ?? 'Working'}
              value={p.progress?.value}
              max={p.progress?.max}
            />
          </div>
        ) : null}
        {p.phase !== 'loading' ? (
          <div
            className="ds-wizard__step"
            data-done={isDone || undefined}
            data-wizard-done={atEnd || undefined}
          >
            {p.children}
          </div>
        ) : null}
        {p.review && !atEnd && p.phase !== 'running' && p.phase !== 'loading' ? (
          <p className="ds-text">Nothing has changed yet.</p>
        ) : null}
      </div>
      <div className="ds-action-bar" data-layout-group>
        <div className="ds-action-bar__side">
          {showBack ? (
            <Button
              part="back"
              onPress={p.onBack}
              disabled={p.phase !== 'loading' && current <= (p.firstStep ?? 0)}
            >
              Back
            </Button>
          ) : null}
          {canStopNow ? (
            <Button
              part="stop"
              kind="stop"
              onPress={p.onStop}
              busy={p.stopping}
              busyLabel="Stopping"
            >
              Stop
            </Button>
          ) : null}
        </div>
        <div className="ds-action-bar__main">{primary}</div>
      </div>
    </div>
  );
}
