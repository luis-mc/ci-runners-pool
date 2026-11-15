// The hosted fallback of a repository (github-integration R5.66 to R5.68): where its jobs go now and why, and the
// setting "When no crsp machine can take these jobs". Turning it on asks first in the page (UX-9).
import {
  Button,
  ChoiceField,
  ErrorSummary,
  FormActions,
  Message,
  NumberField,
  Stack,
  Status,
  TextField,
  type StatusKind,
} from '@crsp/ui';
import { useState } from 'react';
import { unwrap, useClient } from '../../api/api';
import { useCommand, useQuestion } from '../../api/hooks';
import { useSession } from '../../auth/session';
import { Ask } from '../common';
import type { Repository } from './plans';

const OS_NAME = { linux: 'Linux', windows: 'Windows', macos: 'macOS' } as const;

function osWords(oses: readonly string[] | undefined): string {
  const names = (oses ?? []).map((o) => OS_NAME[o as keyof typeof OS_NAME] ?? o);
  return names.length ? names.join(' and ') : 'this system';
}

/** Where the jobs go now, as a status (content.md, hosted fallback words). */
export function routingStatus(
  r: Repository,
): { kind: StatusKind; word: string } | undefined {
  const rt = r.routing;
  if (!rt) return undefined;
  if (rt.where === 'hosted') return { kind: 'waiting', word: 'GitHub-hosted runners' };
  if (rt.where === 'waiting') return { kind: 'off', word: 'waiting for a machine' };
  return { kind: 'ok', word: 'crsp machines' };
}

/** Why the jobs go there. */
export function routingWhy(r: Repository): string {
  const rt = r.routing;
  if (!rt) return 'The pool is off for this repository.';
  const os = osWords(rt.oses);
  switch (rt.why) {
    case 'fallback_on':
      return `No crsp machine for ${os} is up, so jobs run on GitHub-hosted runners.`;
    case 'fallback_off':
      return `No crsp machine for ${os} is up. Jobs wait for one.`;
    case 'grace':
      return `No crsp machine for ${os} is up. Jobs move to GitHub-hosted runners if none comes back soon.`;
    case 'cap_reached':
      return `The monthly cap of hosted minutes is reached. Jobs wait for a crsp machine.`;
    case 'public_repository':
      return `A public repository never runs on GitHub-hosted runners. Jobs wait for a crsp machine.`;
    default:
      return 'A crsp machine is up.';
  }
}

export function WhereJobsGo({ r }: { r: Repository }) {
  const s = routingStatus(r);
  return s ? (
    <Status kind={s.kind} word={s.word} />
  ) : (
    <Status kind="off" word="pool off" />
  );
}

const WAIT = 'wait';
const HOSTED = 'hosted';

/** The setting form with its question card. */
export function HostedFallback({
  r,
  onChanged,
}: {
  r: Repository;
  onChanged: () => void;
}) {
  const client = useClient();
  const session = useSession();
  const admin = session.can('admin');
  const p = r.policy;
  const isPublic = r.visibility === 'public';
  const [mode, setMode] = useState(p.hosted_fallback ? HOSTED : WAIT);
  const [cap, setCap] = useState(p.fallback_cap_minutes ?? 0);
  const [labels, setLabels] = useState({
    linux: p.hosted_labels?.['linux'] ?? '',
    windows: p.hosted_labels?.['windows'] ?? '',
    macos: p.hosted_labels?.['macos'] ?? '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const body = () => ({
    hosted_fallback: mode === HOSTED,
    fallback_cap_minutes: cap,
    hosted_labels: labels,
  });
  const patch = (extra: { confirm_fallback_cost?: boolean }) =>
    unwrap(
      client.PATCH('/api/v1/repositories/{repositoryId}/policy', {
        params: { path: { repositoryId: r.id } },
        body: { ...body(), ...extra },
      }),
    );
  const askQ = useQuestion(
    () => patch({ confirm_fallback_cost: true }),
    () => {
      setSaved(true);
      onChanged();
    },
  );
  const save = useCommand(async () => {
    setSaved(false);
    const problems: string[] = [];
    if (cap < 0) problems.push('The monthly cap must be 0 or more minutes.');
    setErrors(problems);
    if (problems.length) return;
    if (mode === HOSTED && !p.hosted_fallback) {
      askQ.ask([
        'GitHub may bill the minutes that run on GitHub-hosted runners for a private repository.',
        `Jobs of ${r.full_name} run there only while no crsp machine can take them. crsp switches back as soon as a machine is up.`,
      ]);
      return;
    }
    await patch({});
    setSaved(true);
    onChanged();
  });

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run();
        }}
      >
        <Stack>
          <ErrorSummary errors={errors} />
          <ChoiceField
            label="When no crsp machine can take these jobs"
            value={mode}
            onChange={(v) => {
              setMode(v);
              setSaved(false);
            }}
            choices={[
              { value: WAIT, label: 'Wait for a crsp machine' },
              {
                value: HOSTED,
                label: 'Run on GitHub-hosted runners',
                disabledReason: isPublic
                  ? 'A public repository never runs on GitHub-hosted runners.'
                  : undefined,
              },
            ]}
            help="Waiting costs nothing. Jobs stay queued on GitHub for up to 24 hours."
          />
          {mode === HOSTED ? (
            <>
              <NumberField
                label="Monthly cap of hosted minutes"
                value={cap}
                min={0}
                onChange={(v) => {
                  setCap(v);
                  setSaved(false);
                }}
                help="0 means no cap. Once the cap is reached this month, jobs wait again."
              />
              {(['linux', 'windows', 'macos'] as const).map((os) => (
                <TextField
                  key={os}
                  label={`Hosted label for ${OS_NAME[os]}`}
                  optional
                  value={labels[os]}
                  onChange={(v) => {
                    setLabels((l) => ({ ...l, [os]: v }));
                    setSaved(false);
                  }}
                  help={`Blank uses ${os === 'linux' ? 'ubuntu' : os}-latest.`}
                />
              ))}
              <Message tone="needs-you">
                GitHub may bill these minutes for a private repository. crsp switches back
                as soon as a machine is up.
              </Message>
            </>
          ) : null}
          {saved ? <Message tone="done">Saved.</Message> : null}
          {save.error ? (
            <Message tone="problem">Could not save. {save.error}</Message>
          ) : null}
          <FormActions>
            <Button
              kind="primary"
              submit
              busy={save.busy}
              busyLabel="Saving"
              disabled={!admin}
              reason={session.whyNot('admin')}
            >
              Save fallback
            </Button>
          </FormActions>
        </Stack>
      </form>
      <Ask
        title="Run on GitHub-hosted runners?"
        action="Turn on"
        busyLabel="Saving"
        q={askQ.question}
        busy={askQ.busy}
        error={askQ.error}
        onCancel={askQ.cancel}
        onConfirm={() => void askQ.confirm()}
      />
    </>
  );
}
