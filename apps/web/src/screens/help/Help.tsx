// The Help page (LOOK47, layout G, D58): the picture of how a job gets run on top, then every question card in one
// grid, all visible at once (UX-10, UX-51). No wizard, no lock. The cards of a machine read its real slots and load
// budget from the API. Pressing a part, or a link ending in `#q-slot`, scrolls to its card.
import {
  Card,
  CardGrid,
  Facts,
  Page,
  PageHeader,
  formatPercent,
  Pane,
  Text,
  TextLink,
} from '@crsp/ui';
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useMachines } from '../../api/machines';
import { Load } from '../common';
import { CARDS, PART_CARD, PATH_PARTS } from './helpContent';
import { JobPathPicture } from './JobPathPicture';

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
  const { hash } = useLocation();

  // An address that ends in a card brings the card into view. Nothing is hidden, so nothing has to open.
  useEffect(() => {
    const id = hash.replace(/^#/, '');
    if (!CARDS.some((c) => c.id === id)) return;
    const t = setTimeout(
      () => document.getElementById(id)?.scrollIntoView?.({ block: 'center' }),
      0,
    );
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <Page>
      <PageHeader title="Help" lead="How crsp runs your jobs, and what its words mean." />
      <Pane title="How a job gets run">
        <JobPathPicture
          onSelect={(id) => {
            const card = PART_CARD[id];
            if (card) document.getElementById(card)?.scrollIntoView?.({ block: 'center' });
          }}
        />
        <Text tone="muted">
          {PATH_PARTS.length} parts. Press a part to jump to its question.
        </Text>
      </Pane>
      <Pane title="Questions" id="questions">
        <CardGrid>
          {CARDS.map((c) => (
            <Card key={c.id} id={c.id} title={c.title}>
              <Text>{c.answer}</Text>
              {extra(c.id)}
            </Card>
          ))}
        </CardGrid>
      </Pane>
    </Page>
  );
}
