// Component 44: the GitHub grant (github-integration R5.86, R5.87; web-console R5.93). One list of steps with the
// live state of each, and ONE primary action that opens the page of the next missing step in a new tab. A later
// step is plain text until it is next. The part re-checks by itself when the tab regains focus and every so often
// while it waits, and says Ready when everything is granted. The page passes data and the functions that read it.
import { useEffect, useRef, useState } from 'react';
import { ExternalButton } from './Button';
import { Facts } from './Card';
import { Message } from './Message';
import { Status } from './Status';
import { Cluster, Stack } from './layout';

export type GrantStepId = 'install' | 'ask' | 'accept';

export interface GrantStepState {
  id: GrantStepId;
  done: boolean;
  /** The permissions still waiting at this step, by GitHub's name. */
  permissions: readonly string[];
  /** The GitHub page of the step. */
  url?: string | undefined;
}

export interface GrantState {
  ready: boolean;
  next?: GrantStepId | undefined;
  /** Every needed permission that is not accepted yet. */
  missing: readonly string[];
  steps: readonly GrantStepState[];
}

export interface GithubGrantLabels {
  /** Words of the permissions: GitHub's name to what the person reads. */
  permissions: Readonly<Record<string, string>>;
  ready: string;
  checking: string;
  opened: string;
  openInstall: string;
  openAsk: string;
  openAccept: string;
  later: string;
  done: string;
  missing: string;
  failed: string;
  tryAgain: string;
}

export const DEFAULT_GITHUB_GRANT_LABELS: GithubGrantLabels = {
  permissions: {
    secrets: 'Secrets (write)',
    actions_variables: 'Variables (write)',
    administration: 'Administration (write)',
    actions: 'Actions (read)',
    contents: 'Contents (read)',
    metadata: 'Metadata (read)',
    organization_self_hosted_runners: 'Organization runners (write)',
  },
  ready: 'Ready.',
  checking: 'Checking GitHub.',
  opened:
    'GitHub is open in a new tab. Do the step there, then come back to this tab. It checks again by itself.',
  openInstall: 'Install the App on GitHub',
  openAsk: 'Ask for it on GitHub',
  openAccept: 'Accept it on GitHub',
  later: 'Do this after the step above.',
  done: 'done',
  missing: 'missing',
  failed: 'Could not check GitHub.',
  tryAgain: 'Try again',
};

const OPEN_WORD: Record<GrantStepId, 'openInstall' | 'openAsk' | 'openAccept'> = {
  install: 'openInstall',
  ask: 'openAsk',
  accept: 'openAccept',
};

/**
 * Only the GitHub pages the controller names are opened: an https address, or
 * http on this PC. The controller builds them from its GitHub setting
 * (CRSP_GITHUB_URL), so the page never holds a host of its own.
 */
export function githubPage(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    const local = u.hostname === '127.0.0.1' || u.hostname === 'localhost';
    return u.protocol === 'https:' || (u.protocol === 'http:' && local) ? url : undefined;
  } catch {
    return undefined;
  }
}

export function permissionList(
  names: readonly string[],
  words: Readonly<Record<string, string>>,
): string {
  return names.map((n) => words[n] ?? n).join(', ');
}

/** The label of a step: names the exact permissions that wait at it. */
export function stepLabel(
  step: GrantStepState,
  all: readonly string[],
  words: Readonly<Record<string, string>>,
): string {
  const names = permissionList(
    step.permissions.length > 0 ? step.permissions : all,
    words,
  );
  if (step.id === 'install') return 'Install the App on the account';
  if (step.id === 'ask') return `Ask for ${names} on the App page`;
  return `Accept the new permissions on the installation: ${names}`;
}

function stepText(step: GrantStepState, isNext: boolean, l: GithubGrantLabels): string {
  if (step.id === 'install')
    return step.done
      ? 'The App is installed.'
      : isNext
        ? 'Pick the account and the repositories on GitHub.'
        : l.later;
  if (step.id === 'ask')
    return step.done
      ? 'The App asks for it.'
      : isNext
        ? 'On the App page, under Repository permissions, set the access to Read and write.'
        : l.later;
  return step.done
    ? 'The installation accepted it.'
    : isNext
      ? 'On the installation page, press Accept new permissions.'
      : l.later;
}

export interface GithubGrantProps {
  state: GrantState | undefined;
  /** Reads both sides of GitHub again. */
  onCheck: () => void;
  /** Called once, when the state turns ready. */
  onReady?: (() => void) | undefined;
  checking?: boolean | undefined;
  /** The text of a failed check; shows a Try again action. */
  error?: string | undefined;
  /** Every needed permission, for the labels of a step that is done. */
  needed?: readonly string[] | undefined;
  /** Milliseconds between checks while waiting; 0 turns the timer off. */
  every?: number | undefined;
  labels?: GithubGrantLabels | undefined;
}

export function GithubGrant({
  state,
  onCheck,
  onReady,
  checking = false,
  error,
  needed,
  every = 15000,
  labels = DEFAULT_GITHUB_GRANT_LABELS,
}: GithubGrantProps) {
  const [opened, setOpened] = useState(false);
  const check = useRef(onCheck);
  check.current = onCheck;
  const ready = useRef(onReady);
  ready.current = onReady;
  const fired = useRef(false);
  const isReady = state?.ready === true;

  useEffect(() => {
    if (isReady && !fired.current) {
      fired.current = true;
      ready.current?.();
    }
    if (!isReady) fired.current = false;
  }, [isReady]);

  useEffect(() => {
    if (isReady) return;
    const again = () => {
      if (document.visibilityState === 'hidden') return;
      check.current();
    };
    window.addEventListener('focus', again);
    document.addEventListener('visibilitychange', again);
    const timer = every > 0 ? window.setInterval(again, every) : undefined;
    return () => {
      window.removeEventListener('focus', again);
      document.removeEventListener('visibilitychange', again);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [isReady, every]);

  if (!state) {
    if (error)
      return (
        <Message tone="problem">
          {labels.failed} {error}
        </Message>
      );
    return (
      <Message tone="note" dismissible={false}>
        {labels.checking}
      </Message>
    );
  }
  const all = needed ?? state.missing;
  if (state.ready)
    return (
      <Message tone="done">
        {labels.ready} {permissionList(all, labels.permissions)} granted.
      </Message>
    );
  const next = state.steps.find((s) => s.id === state.next);
  const href = githubPage(next?.url);
  return (
    <Message tone="needs-you">
      <Stack gap="tight">
        <span>
          The GitHub App needs {permissionList(state.missing, labels.permissions)}.
          Nothing is lost: do the steps below, one at a time.
        </span>
        <Facts
          items={state.steps.map((s) => ({
            name: stepLabel(s, all, labels.permissions),
            value: (
              <span>
                <Status
                  kind={s.done ? 'ok' : s.id === state.next ? 'waiting' : 'off'}
                  word={s.done ? labels.done : labels.missing}
                />{' '}
                {stepText(s, s.id === state.next, labels)}
              </span>
            ),
          }))}
        />
        <Cluster>
          {next && href ? (
            <ExternalButton kind="primary" href={href} onOpen={() => setOpened(true)}>
              {labels[OPEN_WORD[next.id]]}
            </ExternalButton>
          ) : null}
        </Cluster>
        {opened ? <span>{labels.opened}</span> : null}
        {checking ? <span>{labels.checking}</span> : null}
        {error ? (
          <span role="alert">
            {labels.failed} {error}
          </span>
        ) : null}
      </Stack>
    </Message>
  );
}
