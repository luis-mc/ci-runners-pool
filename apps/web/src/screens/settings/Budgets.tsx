// Settings, Budgets (web-console 4.9, R5.27; machines R5.22; scheduling R5.8 to R5.10; observability R5.5): the
// load budget, slots and drain timeout that a new machine starts with, and the order of service of the queue.
// One form that ends with Cancel and Save (UX-24). A change here touches no machine that already joined, so no
// runner restarts and no running job is waited for (UX-62); the page says so in one line.
import {
  Button,
  CheckRow,
  ChoiceField,
  Cluster,
  ErrorSummary,
  FormActions,
  Message,
  NumberField,
  Section,
  Stack,
  Text,
} from '@crsp/ui';
import { useState } from 'react';
import { unwrap, useClient, type Schemas } from '../../api/api';
import { useCommand, useLoad } from '../../api/hooks';
import { useSession } from '../../auth/session';
import { Load } from '../common';

type Pool = Schemas['PoolSettings'];
type Queue = Schemas['QueueSettings'];
type Key = Queue['order'][number];

const KEYS: { value: Key; label: string }[] = [
  { value: 'priority', label: 'Repository priority' },
  { value: 'event_class', label: 'Event class' },
  { value: 'fair_share', label: 'Fair share' },
  { value: 'queued_at', label: 'Time queued' },
];
const PLACES = ['First', 'Second', 'Third', 'Fourth'];

/** The mistakes of a form, each in one sentence, before anything is sent. */
export function budgetProblems(pool: Pool, queue: Queue): string[] {
  const out: string[] = [];
  const within = (name: string, v: number, min: number, max: number, unit: string) => {
    if (!Number.isInteger(v) || v < min || v > max)
      out.push(`${name} must be from ${min}${unit} to ${max}${unit}.`);
  };
  within('Memory budget', pool.budget_memory_pct, 10, 95, '%');
  within('CPU budget', pool.budget_cpu_pct, 10, 95, '%');
  within('Job slots', pool.default_job_slots, 0, 64, '');
  within('Time to finish running jobs', pool.drain_timeout_minutes, 5, 1440, ' min');
  within('Wait before "no runner"', queue.no_runner_wait_minutes, 1, 60, ' min');
  if (new Set(queue.order).size !== KEYS.length)
    out.push('Each of the four order keys must be used once.');
  return out;
}

export function BudgetsSettings() {
  const client = useClient();
  const pool = useLoad(() => unwrap(client.GET('/api/v1/settings/pool')), []);
  const queue = useLoad(() => unwrap(client.GET('/api/v1/settings/queue')), []);
  const reload = () => {
    pool.reload();
    queue.reload();
  };
  return (
    <Load result={pool.result} what="the budgets" reload={reload}>
      {(p) => (
        <Load result={queue.result} what="the queue order" reload={reload}>
          {(q) => (
            <BudgetsForm
              key={JSON.stringify([p, q])}
              pool={p}
              queue={q}
              onSaved={reload}
            />
          )}
        </Load>
      )}
    </Load>
  );
}

function BudgetsForm({
  pool,
  queue,
  onSaved,
}: {
  pool: Pool;
  queue: Queue;
  onSaved: () => void;
}) {
  const client = useClient();
  const session = useSession();
  const [p, setP] = useState<Pool>(pool);
  const [q, setQ] = useState<Queue>(queue);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const save = useCommand(async () => {
    const problems = budgetProblems(p, q);
    setErrors(problems);
    setSaved(false);
    if (problems.length) return;
    await unwrap(client.PUT('/api/v1/settings/pool', { body: p }));
    await unwrap(client.PUT('/api/v1/settings/queue', { body: q }));
    setSaved(true);
    onSaved();
  });
  const place = (i: number, key: Key) => {
    const order = [...q.order];
    order[i] = key;
    setQ({ ...q, order });
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save.run();
      }}
    >
      <Stack>
        <Section title="New machines">
          <Stack>
            <Text>
              These are the settings a machine gets when it joins. A machine that already
              joined keeps its own, so no runner restarts and no running job is waited
              for.
            </Text>
            <Cluster>
              <NumberField
                label="Memory budget"
                value={p.budget_memory_pct}
                unit="%"
                min={10}
                max={95}
                onChange={(v) => setP({ ...p, budget_memory_pct: v })}
              />
              <NumberField
                label="CPU budget"
                value={p.budget_cpu_pct}
                unit="%"
                min={10}
                max={95}
                onChange={(v) => setP({ ...p, budget_cpu_pct: v })}
              />
              <NumberField
                label="Job slots"
                value={p.default_job_slots}
                min={0}
                max={64}
                onChange={(v) => setP({ ...p, default_job_slots: v })}
              />
              <NumberField
                label="Time to finish running jobs"
                help="How long running jobs may take to finish when a machine stops new jobs."
                value={p.drain_timeout_minutes}
                unit=" min"
                min={5}
                max={1440}
                onChange={(v) => setP({ ...p, drain_timeout_minutes: v })}
              />
            </Cluster>
            <CheckRow
              label="Size the slots from the machine"
              help="Uses its cores and memory within the budget. Job slots is used when the machine does not say how big it is."
              checked={p.size_slots_from_machine}
              onChange={(v) => setP({ ...p, size_slots_from_machine: v })}
            />
          </Stack>
        </Section>
        <Section title="Queue order">
          <Stack>
            <Text>The first key decides first. A later key breaks the ties.</Text>
            <Cluster>
              {PLACES.map((name, i) => (
                <ChoiceField
                  key={name}
                  label={name}
                  value={q.order[i] ?? ''}
                  onChange={(v) => place(i, v as Key)}
                  choices={KEYS}
                />
              ))}
            </Cluster>
            <CheckRow
              label="Fair share"
              help="Repositories take turns inside one priority."
              checked={q.fair_share}
              onChange={(v) => setQ({ ...q, fair_share: v })}
            />
            <NumberField
              label='Wait before "no runner"'
              help="Minutes a job waits before the console says no online runner has its labels."
              value={q.no_runner_wait_minutes}
              unit=" min"
              min={1}
              max={60}
              onChange={(v) => setQ({ ...q, no_runner_wait_minutes: v })}
            />
          </Stack>
        </Section>
        <ErrorSummary errors={errors} />
        {saved ? <Message tone="done">Settings saved.</Message> : null}
        {save.error ? (
          <Message tone="problem">Could not save. {save.error}</Message>
        ) : null}
        <FormActions>
          <Button
            onPress={() => {
              setP(pool);
              setQ(queue);
              setErrors([]);
              setSaved(false);
              save.clear();
            }}
          >
            Cancel
          </Button>
          <Button
            kind="primary"
            submit
            busy={save.busy}
            busyLabel="Saving"
            disabled={!session.can('admin')}
            reason={session.whyNot('admin')}
          >
            Save
          </Button>
        </FormActions>
      </Stack>
    </form>
  );
}
