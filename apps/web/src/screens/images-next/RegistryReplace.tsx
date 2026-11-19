// "A newer version was found" (RES20): replace an image of the registry with its newer version. One wizard of four
// steps: Compare, Review, Replacing, Done (UX-5, UX-30). The shared Wizard part owns the step, the locks, Stop and
// the busy state (UX-54); this page passes data only. Nothing changes before Review is accepted.
import {
  Breadcrumbs,
  Facts,
  Message,
  NumberField,
  Page,
  PageHeader,
  Progress,
  Stack,
  Status,
  Table,
  Text,
  Wizard,
  formatDate,
  formatSize,
  type Column,
} from '@crsp/ui';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Load } from '../common';
import { useGet, usePostFn } from './api';
import { PhasePicker, stepOfPhase, usePhase, useRunClock } from './PhaseKit';
import type { FileDiff, ReplaceCompare } from './registryModel';

const STEPS = ['Compare', 'Review', 'Replacing', 'Done'] as const;
const DAY = 86_400_000;

export function RegistryReplacePage() {
  const { id = '' } = useParams();
  const { result, reload } = useGet<ReplaceCompare>(
    `/api/v1/registry/images/${id}/compare`,
  );
  return (
    <Page>
      <Breadcrumbs
        trail={[
          { to: '/pool/images?tab=registry', label: '‹ Registry' },
          { label: 'Replace an image' },
        ]}
      />
      <PageHeader
        title="Replace an image"
        lead="A run needs a newer version of an image. Replace the old one so the registry does not keep both."
      />
      <Load result={result} what="the comparison" reload={reload}>
        {(c) => <ReplaceBody compare={c} />}
      </Load>
    </Page>
  );
}

function ReplaceBody({ compare }: { compare: ReplaceCompare }) {
  const navigate = useNavigate();
  const post = usePostFn();
  const [phase, setPhase] = usePhase('first-run');
  const [keep, setKeep] = useState(7);
  const current = stepOfPhase(phase);
  const failed = phase === 'failed';
  const done = phase === 'done' || phase === 'done-after-reload';
  const units = compare.switching.length + 2;
  const step = useRunClock(phase === 'running', units, () => setPhase('done'));
  const { old, next } = compare;
  const until = formatDate(Date.parse(compare.next.pushed_at) + keep * DAY + 3 * DAY * 0);
  const fileCols: Column<FileDiff>[] = [
    { id: 'file', header: 'Stack file', cell: (f) => f.path, kind: 'fit' },
    { id: 'before', header: `In ${old.key}`, cell: (f) => f.before, kind: 'grow' },
    { id: 'after', header: `In ${next.key}`, cell: (f) => f.after, kind: 'grow' },
  ];
  const work = [
    ...compare.switching.map((r) => `Point ${r} at ${next.key}`),
    `Warm ${old.machines.map((m) => m.machine).join(' and ') || 'the machines'} with ${next.key}`,
    `Mark ${old.key} superseded until ${until}`,
  ];
  const rows = work.map((name, n) => ({
    name,
    state:
      failed && n === step - 1
        ? ({ kind: 'failed', word: 'failed' } as const)
        : done || n < step - 1
          ? ({ kind: 'ok', word: 'done' } as const)
          : n === step - 1
            ? ({ kind: 'running', word: 'running' } as const)
            : ({ kind: 'waiting', word: 'waits' } as const),
  }));
  const workCols: Column<(typeof rows)[number]>[] = [
    { id: 'name', header: 'Step', cell: (r) => r.name, kind: 'grow' },
    { id: 'state', header: 'State', cell: (r) => <Status {...r.state} />, kind: 'fit' },
  ];
  return (
    <Stack>
      <Wizard
        name="Replace an image"
        steps={STEPS}
        current={current}
        phase={phase}
        reading={phase === 'loading' ? 'Comparing the stack files' : undefined}
        progress={
          phase === 'running' || phase === 'paused'
            ? {
                text: `Replacing ${old.key} with ${next.key}, step ${Math.min(step, units)} of ${units}`,
                value: step,
                max: units + 1,
              }
            : undefined
        }
        canStop
        onStop={() => setPhase('stopped')}
        onBack={
          current > 0
            ? () => setPhase(current === 1 ? 'first-run' : 'ready-to-review')
            : undefined
        }
        onStep={(i) => setPhase(i === 0 ? 'first-run' : 'ready-to-review')}
        firstStep={0}
        failedAt={2}
        review={phase === 'ready-to-review'}
        stateNote={
          phase === 'paused'
            ? 'Paused. The repositories still use the old image.'
            : phase === 'done-after-reload'
              ? 'This page was reloaded. Here is what was done.'
              : undefined
        }
        primary={
          current === 0
            ? { label: 'Review', onPress: () => setPhase('ready-to-review') }
            : {
                label: 'Replace the image',
                busyLabel: 'Replacing',
                onPress: () => {
                  void post(`/api/v1/registry/images/${next.id}/replace`).then(() =>
                    setPhase('running'),
                  );
                },
              }
        }
        donePrimary={{
          label: 'Open the registry',
          onPress: () => void navigate('/pool/images?tab=registry'),
        }}
        onStartAgain={() => setPhase('first-run')}
        onTryAgain={() => setPhase('running')}
      >
        {current === 0 ? (
          <Stack>
            <Message tone="needs-you">
              {`${next.profile} for ${next.repositories.join(', ')} has a newer version. The registry holds both. Replacing keeps one.`}
            </Message>
            <Table
              caption="What changed in the stack files"
              columns={fileCols}
              rows={compare.files}
              rowKey={(f) => f.path}
              oneLine
            />
            <Text tone="muted">
              Same profile, same repository, same base image. Only the stack files above
              differ, so the new image is an update of the old one.
            </Text>
            <NumberField
              label="Keep the old image for"
              unit="days"
              min={1}
              max={60}
              value={keep}
              onChange={(n) => setKeep(n ?? 7)}
              help="So you can go back to it. After that it is deleted."
            />
          </Stack>
        ) : null}
        {current === 1 ? (
          <Stack>
            <Facts
              items={[
                { name: 'Old image', value: `${old.profile}, key ${old.key}` },
                { name: 'New image', value: `${next.profile}, key ${next.key}` },
                { name: 'Repositories that switch', value: compare.switching.join(', ') },
                { name: 'The old image', value: `kept until ${until}, then deleted` },
                {
                  name: 'Disk after that',
                  value: `${formatSize(compare.freed_bytes)} freed`,
                },
              ]}
            />
            <Text tone="muted">
              A job that runs now keeps the old image. The next job takes the new one.
            </Text>
          </Stack>
        ) : null}
        {current === 2 ? (
          <Stack>
            {failed ? (
              <Message tone="problem">
                {`Pulling ${next.key} on Pi lab failed: the registry did not answer. Nothing was replaced. The old image keeps serving.`}
              </Message>
            ) : null}
            {phase === 'stopped' ? (
              <Message tone="needs-you">
                Stopped. The repositories still use the old image.
              </Message>
            ) : null}
            <Progress
              label="Replacing the image"
              value={failed ? 0 : Math.min(step, units)}
              max={units}
            />
            <Table
              caption="What is being done"
              columns={workCols}
              rows={rows}
              rowKey={(r) => r.name}
              oneLine
            />
          </Stack>
        ) : null}
        {current === 3 ? (
          <Message tone="done">
            {`${next.key} replaced ${old.key}. ${old.key} is kept until ${until}, then deleted.`}
          </Message>
        ) : null}
      </Wizard>
      <PhasePicker phase={phase} onChange={setPhase} />
    </Stack>
  );
}
