// Add runners, with the job image built first (RES19). Today the first runner on a machine builds crsp-pool:<key>
// in silence. Here the work step says "Building the job image", with the step, the time left and a link to the log.
import {
  Breadcrumbs,
  CheckRow,
  Facts,
  LinkButton,
  Message,
  Page,
  PageHeader,
  Progress,
  Stack,
  Status,
  Table,
  Text,
  Wizard,
  type Column,
} from '@crsp/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhasePicker, stepOfPhase, usePhase, useRunClock } from './PhaseKit';

const STEPS = ['Runners', 'Review', 'Adding runners', 'Done'] as const;

interface Stage {
  name: string;
  state: Parameters<typeof Status>[0];
  detail: string;
}

export function AddRunnersBuildingPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = usePhase('running');
  const [two, setTwo] = useState(true);
  const stages = useRunClock(phase === 'running', 4, () => setPhase('done'));
  const current = stepOfPhase(phase);
  const failed = phase === 'failed';
  const rows: Stage[] = [
    {
      name: 'Building the job image on Pi lab',
      state: failed
        ? { kind: 'failed', word: 'failed' }
        : stages > 1 || phase === 'done' || phase === 'done-after-reload'
          ? { kind: 'ok', word: 'ready' }
          : { kind: 'running', word: 'building' },
      detail: failed
        ? 'Browsers layer: the download did not match its pin.'
        : stages > 1
          ? 'Built in 36 min'
          : 'Step 4 of 6, Browsers layer, about 14 min left',
    },
    {
      name: 'Registering runner pi-2',
      state:
        stages > 2 || phase === 'done' || phase === 'done-after-reload'
          ? { kind: 'ok', word: 'registered' }
          : { kind: 'waiting', word: 'waits' },
      detail: failed ? 'Not started' : 'Starts when the image is ready',
    },
    ...(two
      ? [
          {
            name: 'Registering runner pi-3',
            state: (stages > 3 || phase === 'done' || phase === 'done-after-reload'
              ? { kind: 'ok', word: 'registered' }
              : { kind: 'waiting', word: 'waits' }) as Stage['state'],
            detail: failed ? 'Not started' : 'Starts when the image is ready',
          },
        ]
      : []),
  ];
  const cols: Column<Stage>[] = [
    { id: 'name', header: 'Step', cell: (s) => s.name, kind: 'grow' },
    { id: 'state', header: 'State', cell: (s) => <Status {...s.state} />, kind: 'fit' },
    { id: 'detail', header: 'Now', cell: (s) => s.detail, kind: 'grow' },
  ];
  const progress =
    phase === 'running' || phase === 'paused'
      ? {
          text:
            stages <= 1
              ? 'Building the job image on Pi lab, step 4 of 6, about 14 min left'
              : `Registering runner ${stages - 1} of ${two ? 2 : 1}`,
          value: stages,
          max: rows.length + 1,
        }
      : undefined;
  return (
    <Page>
      <Breadcrumbs
        trail={[{ to: '/pool/runners', label: '‹ Runners' }, { label: 'Add runners' }]}
      />
      <PageHeader
        title="Add runners"
        lead="Runners on Pi lab. The job image is built first when the machine has none."
      />
      <Stack>
        <Wizard
          name="Add runners"
          steps={STEPS}
          current={current}
          phase={phase}
          reading={phase === 'loading' ? 'Reading the machines' : undefined}
          progress={progress}
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
              ? 'Paused. The image keeps building without this page.'
              : phase === 'done-after-reload'
                ? 'This page was reloaded. Here is what was added.'
                : undefined
          }
          primary={
            current === 0
              ? { label: 'Review', onPress: () => setPhase('ready-to-review') }
              : {
                  label: two ? 'Add 2 runners' : 'Add 1 runner',
                  busyLabel: 'Adding',
                  onPress: () => setPhase('running'),
                }
          }
          donePrimary={{
            label: 'Open runners',
            onPress: () => void navigate('/pool/runners'),
          }}
          onStartAgain={() => setPhase('first-run')}
          onTryAgain={() => setPhase('running')}
        >
          {current === 0 ? (
            <Stack>
              <Message tone="needs-you">
                Pi lab has no job image for Go, Node and Postgres yet. It is built first,
                once, about 36 min. Runners start when it is ready. You can close this
                page; the work goes on.
              </Message>
              <CheckRow
                label="2 runners on Pi lab"
                help="Linux, arm64, container"
                checked={two}
                onChange={setTwo}
              />
            </Stack>
          ) : null}
          {current === 1 ? (
            <Stack>
              <Facts
                items={[
                  { name: 'Runners', value: two ? '2 on Pi lab' : '1 on Pi lab' },
                  {
                    name: 'Job image',
                    value: 'Go, Node and Postgres, arm64: build it here, about 36 min',
                  },
                  {
                    name: 'Ready-made image',
                    value: 'The registry has none for arm64 yet',
                  },
                  { name: 'Disk', value: 'about 3.2 GB' },
                ]}
              />
              <Text tone="muted">
                A build uses about 2 of the 4 cores of Pi lab. Jobs that run now keep
                their share.
              </Text>
            </Stack>
          ) : null}
          {current === 2 ? (
            <Stack>
              {failed ? (
                <Message tone="problem">
                  The job image did not build, so no runner was added. Nothing was changed
                  on Pi lab. Open the build to read why.
                </Message>
              ) : null}
              {phase === 'stopped' ? (
                <Message tone="needs-you">
                  Stopped. The image build was cut; no runner was added.
                </Message>
              ) : null}
              <Progress
                label="Building the job image on Pi lab"
                value={failed ? 0 : Math.min(stages, 2) * 40}
                max={100}
              />
              <Table
                caption="What is being done"
                columns={cols}
                rows={rows}
                rowKey={(s) => s.name}
                oneLine
              />
              <LinkButton to="/pool/images/builds/bld_3">Open the build</LinkButton>
            </Stack>
          ) : null}
          {current === 3 ? (
            <Message tone="done">{`Added ${two ? '2 runners' : '1 runner'} on Pi lab. The job image is ready, so the first job starts at once.`}</Message>
          ) : null}
        </Wizard>
        <PhasePicker phase={phase} onChange={setPhase} />
      </Stack>
    </Page>
  );
}
