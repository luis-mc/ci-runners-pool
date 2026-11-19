// One build (RES19): live progress, the steps, a failure in plain words and the log. A running build asks the
// server again every 5 seconds (UX-19) and the strip at the top reads the same value (UX-34).
import {
  ActionBar,
  Breadcrumbs,
  Button,
  CodeBlock,
  Facts,
  LinkButton,
  Message,
  Page,
  PageHeader,
  Progress,
  Section,
  Stack,
  Status,
  Table,
  Text,
  formatDateTime,
  useNow,
  type Column,
} from '@crsp/ui';
import { useParams } from 'react-router-dom';
import { useCommand } from '../../api/hooks';
import { Load } from '../common';
import { useGet, usePostFn } from './api';
import type { BuildStep, ImageBuild } from './model';
import { STATE_WORD, durationOf, sizeOf, stepLine, timing } from './words';

const STEP_STATUS: Record<BuildStep['state'], Parameters<typeof Status>[0]> = {
  done: { kind: 'ok', word: 'done' },
  running: { kind: 'running', word: 'running' },
  waiting: { kind: 'waiting', word: 'waits' },
  failed: { kind: 'failed', word: 'failed' },
  skipped: { kind: 'off', word: 'not run' },
};

export function BuildPage() {
  const { id = '' } = useParams();
  const { result, reload } = useGet<ImageBuild>(`/api/v1/image-builds/${id}`, true);
  return (
    <Page>
      <Breadcrumbs
        trail={[{ to: '/pool/images', label: '‹ Images and caches' }, { label: 'Build' }]}
      />
      <Load result={result} what="the build" reload={reload}>
        {(b) => <BuildBody build={b} reload={reload} />}
      </Load>
    </Page>
  );
}

function BuildBody({ build, reload }: { build: ImageBuild; reload: () => void }) {
  const now = useNow();
  const post = usePostFn();
  const retry = useCommand(async () => {
    await post(`/api/v1/image-builds/${build.id}/retry`);
    reload();
  });
  const t = timing(build, now);
  const word = STATE_WORD[build.state];
  const cols: Column<BuildStep>[] = [
    { id: 'name', header: 'Step', cell: (s) => s.name, kind: 'grow' },
    {
      id: 'state',
      header: 'State',
      cell: (s) => <Status {...STEP_STATUS[s.state]} />,
      kind: 'fit',
    },
    {
      id: 'time',
      header: 'Time',
      cell: (s) => (s.seconds === undefined ? '–' : durationOf(s.seconds)),
      kind: 'fit',
    },
  ];
  const canRetry =
    build.state === 'failed' || build.state === 'stale' || build.state === 'not_built';
  return (
    <Stack>
      <PageHeader
        title={`${build.profile} on ${build.machine}`}
        lead={`${build.arch} · key ${build.key} · started because ${build.reason}${build.origin === 'pulled' ? ' · pulled ready-made' : ''}`}
      />
      <Section title="Progress">
        <Stack gap="tight">
          <Status {...word} />
          {build.state === 'building' ? (
            <>
              <Progress
                label={`Building ${build.profile} on ${build.machine}`}
                value={t.pct}
                max={100}
              />
              <Text>{stepLine(build)}</Text>
              <Text tone="muted">{`${durationOf(t.ran)} so far. Earlier builds took about ${durationOf(build.typical_seconds)}, so about ${durationOf(t.left)} left. The old image keeps serving jobs.`}</Text>
            </>
          ) : null}
          {build.state === 'queued' ? (
            <Text>
              Waits for a free build slot on {build.machine}. One build runs at a time on
              a machine, so jobs keep their CPU.
            </Text>
          ) : null}
          {build.state === 'ready' ? (
            <Facts
              items={[
                { name: 'Size', value: sizeOf(build) },
                {
                  name: 'Finished',
                  value: build.finished_at ? formatDateTime(build.finished_at) : '–',
                },
                {
                  name: 'Took',
                  value:
                    build.started_at && build.finished_at
                      ? durationOf(
                          (Date.parse(build.finished_at) - Date.parse(build.started_at)) /
                            1000,
                        )
                      : '–',
                },
              ]}
            />
          ) : null}
          {build.state === 'not_built' ? (
            <Text>
              Not built yet. It is built when the first runner of this profile starts on{' '}
              {build.machine}.
            </Text>
          ) : null}
        </Stack>
      </Section>
      {build.state === 'failed' && build.failure ? (
        <Message tone="problem">
          {`${build.failure.step} failed: ${build.failure.why} ${build.failure.next}`}
        </Message>
      ) : null}
      {build.state === 'stale' ? (
        <Message tone="needs-you">
          {`This image no longer matches its profile. ${build.previous_image ? 'Rebuild to use the new pins.' : ''} Running jobs keep it until they end.`}
        </Message>
      ) : null}
      {retry.error ? (
        <Message tone="problem">{`Could not start the build. ${retry.error}`}</Message>
      ) : null}
      {build.steps.length > 0 ? (
        <Section title="Steps" count={build.steps.length}>
          <Table
            caption="Build steps"
            columns={cols}
            rows={build.steps}
            rowKey={(s) => s.name}
            oneLine
          />
        </Section>
      ) : null}
      {build.log.length > 0 ? (
        <Section
          title="Log"
          hint="The last lines of the build. Secrets are taken out. This is a plain block until the shared live log part is built."
        >
          <CodeBlock
            label={`Log of ${build.profile} on ${build.machine}`}
            text={build.log.join('\n')}
          />
        </Section>
      ) : null}
      <ActionBar
        status={
          build.state === 'failed'
            ? 'Nothing was replaced. The old image keeps serving.'
            : build.state === 'building'
              ? 'Building. This page asks again every 5 seconds.'
              : undefined
        }
        secondary={
          <LinkButton to={`/pool/images/profiles/${build.profile_id}`}>
            Open the profile
          </LinkButton>
        }
        primary={
          <Button
            kind="primary"
            onPress={() => void retry.run()}
            busy={retry.busy}
            busyLabel="Starting"
            disabled={!canRetry}
            reason={build.state === 'building' ? 'It is building now.' : 'Nothing to do.'}
          >
            {build.state === 'failed'
              ? 'Try again'
              : build.state === 'stale'
                ? 'Rebuild'
                : build.state === 'not_built'
                  ? 'Build now'
                  : build.state === 'building'
                    ? 'Building'
                    : 'Rebuild'}
          </Button>
        }
      />
    </Stack>
  );
}
