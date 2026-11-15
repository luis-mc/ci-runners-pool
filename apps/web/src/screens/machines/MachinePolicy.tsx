// When this machine works (machines R5.60 to R5.63): the mode, the battery pause and the CPU cap.
// Every control is saved at once (UX-22) and follows the tray: both write the same settings.
import {
  Button,
  ChoiceField,
  Cluster,
  Facts,
  Message,
  Section,
  Stack,
  Status,
  Switch,
  Text,
  formatDateTime,
} from '@crsp/ui';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useCommand } from '../../api/hooks';
import { useSession } from '../../auth/session';

type Machine = Schemas['Machine'];
type Settings = Schemas['MachineSettingsUpdate'];

const MODES = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'always', label: 'Always' },
  { value: 'paused', label: 'Paused' },
] as const;

const MODE_HELP: Record<string, string> = {
  automatic: 'Takes jobs. Pauses on battery and while you have paused it from the tray.',
  always: 'Takes jobs on battery too. A pause from the tray still holds.',
  paused: 'Takes no new job. The jobs that run finish.',
};

const CAPS = [25, 50, 75, 100] as const;

/** Why a machine takes no new job, in words (machines R5.61). */
export function pauseWords(reason: Machine['pause_reason']): string {
  switch (reason) {
    case 'paused':
      return 'Paused';
    case 'on_battery':
      return 'On battery';
    case 'quiet_hours':
      return 'Quiet hours';
    case 'budget':
      return 'Busy';
    default:
      return 'Taking jobs';
  }
}

const REASON_HELP: Record<string, string> = {
  paused: 'It takes no new job. The jobs that run finish.',
  on_battery: 'It takes no new job while it runs on battery. The jobs that run finish.',
  quiet_hours: 'It takes no new job in quiet hours. The jobs that run finish.',
  budget: 'Its load is over the budget. A new job waits until the load drops.',
};

/** The state word of a machine for the list and the detail: taking jobs or why not (UX-58). */
export function PolicyStatus({ m }: { m: Machine }) {
  if (!m.online) return <Status kind="off" word="Offline" />;
  if (m.accepting === false)
    return (
      <Status
        kind={m.pause_reason === 'budget' ? 'waiting' : 'off'}
        word={pauseWords(m.pause_reason)}
      />
    );
  return <Status kind="ok" word="Taking jobs" />;
}

export function MachinePolicySection({
  m,
  onChanged,
}: {
  m: Machine;
  onChanged: () => void;
}) {
  const client = useClient();
  const session = useSession();
  const why = session.whyNot('admin');
  const s = m.settings;
  const mode = s.mode ?? 'automatic';
  const cap = s.cpu_cap_pct ?? 100;
  const policy = m.policy;
  const heldByUser = Boolean(s.pause_until_resumed || s.pause_until);
  const capUnsupported = m.os === 'macos' || policy?.cpu_cap_state === 'not_supported';

  const change = useCommand(async (body: Settings) => {
    await unwrap(
      client.PATCH('/api/v1/machines/{machineId}', {
        params: { path: { machineId: m.id } },
        body,
      }),
    );
    onChanged();
  });
  const resume = useCommand(async () => {
    const body: Settings = { pause: 'none' };
    if (mode === 'paused') body.mode = 'automatic';
    await unwrap(
      client.PATCH('/api/v1/machines/{machineId}', {
        params: { path: { machineId: m.id } },
        body,
      }),
    );
    onChanged();
  });

  const reason = m.accepting === false ? m.pause_reason : undefined;
  return (
    <Section title="When it works">
      <Stack>
        <Facts
          items={[
            { name: 'Now', value: <PolicyStatus m={m} /> },
            ...(s.pause_until
              ? [{ name: 'Paused until', value: formatDateTime(s.pause_until) }]
              : []),
            ...(s.pause_until_resumed
              ? [{ name: 'Paused', value: 'Until you resume' }]
              : []),
            ...(policy?.battery_known
              ? [
                  {
                    name: 'Power',
                    value: policy.on_battery ? 'On battery' : 'On mains',
                  },
                ]
              : []),
          ]}
        />
        {reason ? <Message tone="note">{REASON_HELP[reason]}</Message> : null}
        <ChoiceField
          label="Mode"
          help={MODE_HELP[mode]}
          value={mode}
          choices={MODES.map((c) => ({
            ...c,
            ...(!session.can('admin') ? { disabledReason: why } : {}),
          }))}
          onChange={(v) => void change.run({ mode: v as Schemas['MachineMode'] })}
        />
        <Switch
          label="Pause on battery"
          on={s.pause_on_battery ?? true}
          busy={change.busy}
          disabledReason={why}
          onChange={(on) => void change.run({ pause_on_battery: on })}
        />
        <Text>
          {mode === 'always'
            ? 'Always ignores the battery.'
            : s.pause_on_battery === false
              ? 'Off: the machine keeps taking jobs on battery.'
              : 'On: Automatic takes no new job while the machine runs on battery.'}
        </Text>
        <ChoiceField
          label="CPU for runners"
          help={
            capUnsupported
              ? 'Not supported on macOS yet. The runners use all the CPU.'
              : 'The most CPU the runner processes may use. The load budget stays as it is.'
          }
          value={String(cap)}
          choices={CAPS.map((c) => ({
            value: String(c),
            label: `${c}%`,
            ...(capUnsupported
              ? { disabledReason: 'Not supported on macOS yet.' }
              : !session.can('admin')
                ? { disabledReason: why }
                : {}),
          }))}
          onChange={(v) =>
            void change.run({ cpu_cap_pct: Number(v) as Schemas['CpuCapPct'] })
          }
        />
        {policy?.cpu_cap_state === 'failed' ? (
          <Message tone="problem">
            The CPU cap was not set. {policy.cpu_cap_detail ?? ''}
          </Message>
        ) : null}
        {change.error ? (
          <Message tone="problem">Could not save. {change.error}</Message>
        ) : null}
        {heldByUser || mode === 'paused' ? (
          <Cluster>
            <Button
              onPress={() => void resume.run()}
              busy={resume.busy}
              busyLabel="Resuming"
              disabled={!session.can('admin')}
              reason={why}
            >
              Resume
            </Button>
          </Cluster>
        ) : null}
        {resume.error ? (
          <Message tone="problem">Could not resume. {resume.error}</Message>
        ) : null}
      </Stack>
    </Section>
  );
}
