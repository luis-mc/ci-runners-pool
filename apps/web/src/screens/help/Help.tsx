// The Help page (LOOK44, owner pick I): a stepper walks the picture of how a job gets run, one part at a time, and the
// question cards of the step sit in their own Questions section (UX-10, UX-51). The cards of a machine read its real
// slots and load budget from the API. A link ending in `#q-slot` opens the step of that card.
import {
  ActionBar,
  Button,
  Card,
  CardGrid,
  Facts,
  Page,
  PageHeader,
  formatPercent,
  Pane,
  Stepper,
  Text,
  TextLink,
} from '@crsp/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useMachines } from '../../api/machines';
import { Load } from '../common';
import { CARDS, PATH_PARTS, STEPS, stepOfCard } from './helpContent';
import { JobPathPicture } from './JobPathPicture';

function stepFromParams(params: URLSearchParams, hash: string): number {
  const fromHash = stepOfCard(hash.replace(/^#/, ''));
  if (fromHash !== undefined) return fromHash;
  const n = Number(params.get('step'));
  return Number.isInteger(n) && n >= 1 && n <= STEPS.length ? n - 1 : 0;
}

/** The real numbers of each machine, read from the API: never a fixed 85% or 60%. */
function MachineNumbers({ kind }: { kind: 'slots' | 'budget' }) {
  const { result, reload } = useMachines();
  return (
    <Load result={result} what="your machines" reload={reload}>
      {(data) =>
        data.items.length === 0 ? (
          <Text tone="muted">
            No machine yet. <TextLink to="/pool/machines/add">Add a machine</TextLink> to
            see its {kind === 'slots' ? 'slots' : 'load budget'}.
          </Text>
        ) : (
          <Facts
            items={data.items.map((m) => ({
              name: m.name,
              value:
                kind === 'slots'
                  ? `${m.slots_used} of ${m.settings.job_slots} slots in use`
                  : `memory ${formatPercent(m.settings.budget_memory_pct)}, CPU ${formatPercent(m.settings.budget_cpu_pct)}`,
            }))}
          />
        )
      }
    </Load>
  );
}

function extra(id: string): ReactNode {
  switch (id) {
    case 'q-slot':
      return (
        <>
          <MachineNumbers kind="slots" />
          <TextLink to="/pool/size">Open Pool size</TextLink>
        </>
      );
    case 'q-budget':
      return <MachineNumbers kind="budget" />;
    case 'q-waiting':
      return <TextLink to="/jobs">Open Jobs</TextLink>;
    case 'q-doctor':
      return <TextLink to="/doctor">Open the Doctor</TextLink>;
    case 'q-images':
      return <TextLink to="/pool/images">Open Images and caches</TextLink>;
    default:
      return null;
  }
}

export function HelpScreen() {
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const [step, setStep] = useState(() => stepFromParams(params, hash));
  const [reached, setReached] = useState(step);

  // An address that ends in a card opens its step and brings the card into view.
  useEffect(() => {
    const target = stepOfCard(hash.replace(/^#/, ''));
    if (target === undefined) return;
    setStep(target);
    setReached((r) => Math.max(r, target));
    const t = setTimeout(
      () => document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'center' }),
      0,
    );
    return () => clearTimeout(t);
  }, [hash]);

  const go = (i: number) => {
    setStep(i);
    setReached((r) => Math.max(r, i));
    setParams(i === 0 ? {} : { step: String(i + 1) }, { replace: true });
  };
  const s = STEPS[step] ?? STEPS[0]!;
  const last = step === STEPS.length - 1;
  const partStep = (id: string) => STEPS.findIndex((st) => st.lit.includes(id));

  return (
    <Page>
      <PageHeader title="Help" lead="How crsp runs your jobs, one step at a time." />
      <Pane title="How a job gets run">
        <Stepper
          label="Steps"
          steps={STEPS.map((x) => x.name)}
          current={step}
          reached={reached}
          onStep={go}
        />
        <JobPathPicture
          lit={s.lit}
          onSelect={(id) => {
            const to = partStep(id);
            if (to >= 0 && to !== step) go(to);
          }}
        />
        <Text>{s.lead}</Text>
        <Text tone="muted">{PATH_PARTS.length} parts. Press a part to see its step.</Text>
      </Pane>
      <Pane title="Questions" id="questions">
        <CardGrid>
          {CARDS.filter((c) => c.step === step).map((c) => (
            <Card key={c.id} id={c.id} title={c.title}>
              <Text>{c.answer}</Text>
              {extra(c.id)}
            </Card>
          ))}
        </CardGrid>
      </Pane>
      <ActionBar
        label="Help steps"
        secondary={
          <Button part="back" disabled={step === 0} onPress={() => go(step - 1)}>
            Back
          </Button>
        }
        primary={
          <Button kind="primary" onPress={() => go(last ? 0 : step + 1)}>
            {last ? 'Start again' : 'Next'}
          </Button>
        }
      />
    </Page>
  );
}
