// What the two proposed wizards share (RES19): the phase held in the address, so a reviewer can open any of the ten
// wizard states, and a picker for it. The picker is review tooling built from the shared Segmented part; the real
// console reads the phase from the server (UX-19, UX-54).
import { Section, Segmented, type WizardPhase } from '@crsp/ui';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export const PHASES: readonly WizardPhase[] = [
  'loading',
  'first-run',
  'planning',
  'ready-to-review',
  'running',
  'paused',
  'stopped',
  'failed',
  'done',
  'done-after-reload',
] as const;

/** The step a phase sits on, for a wizard of four steps: Choose, Review, the work, Done. */
export function stepOfPhase(phase: WizardPhase): number {
  if (phase === 'loading' || phase === 'first-run' || phase === 'planning') return 0;
  if (phase === 'ready-to-review') return 1;
  if (phase === 'done' || phase === 'done-after-reload') return 3;
  return 2;
}

/** The phase from `?phase=`, and a setter that writes it back so a state can be linked. */
export function usePhase(
  initial: WizardPhase = 'first-run',
): [WizardPhase, (p: WizardPhase) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('phase');
  const phase = (PHASES as readonly string[]).includes(raw ?? '')
    ? (raw as WizardPhase)
    : initial;
  const set = useCallback(
    (p: WizardPhase) =>
      setParams(
        (old) => {
          const n = new URLSearchParams(old);
          n.set('phase', p);
          return n;
        },
        { replace: true },
      ),
    [setParams],
  );
  return [phase, set];
}

/** While the work runs, one more unit is done every 2 seconds, until all are, then the wizard is done. A frozen
 * review page (`?freeze`) stays where it is. */
export function useRunClock(active: boolean, total: number, onDone: () => void): number {
  const [n, setN] = useState(1);
  const frozen = /[?&]freeze\b/.test(window.location.hash + window.location.search);
  useEffect(() => {
    if (!active || frozen) return;
    const t = setInterval(() => setN((x) => x + 1), 2000);
    return () => clearInterval(t);
  }, [active, frozen]);
  useEffect(() => {
    if (active && !frozen && n >= total) onDone();
  }, [active, frozen, n, total, onDone]);
  return Math.min(n, total);
}

export function PhasePicker({
  phase,
  onChange,
}: {
  phase: WizardPhase;
  onChange: (p: WizardPhase) => void;
}) {
  return (
    <Section
      title="Review: show this screen in each wizard state"
      hint="Only in the review build. The real console reads the state from the server."
    >
      <Segmented
        label="Wizard state"
        allLabel={null}
        value={phase}
        onChange={(v) => onChange(v || 'first-run')}
        options={PHASES.map((p) => ({ value: p, label: p }))}
      />
    </Section>
  );
}
