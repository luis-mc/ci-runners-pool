// Shared screen parts: the loading, could-not-load and fault states of every screen (R5.31, UX-28, UX-6).
import { Button, Failed, Loading, Message, formatAgo, useNow } from '@crsp/ui';
import { Component, type ReactNode } from 'react';
import { ApiError } from '../api/api';
import type { Loaded } from '../api/hooks';

export function Load<T>({
  result,
  what,
  reload,
  children,
}: {
  result: Loaded<T>;
  what: string;
  reload: () => void;
  children: (data: T) => ReactNode;
}) {
  const now = useNow();
  if (result.state === 'loading') return <Loading what={`Loading ${what}`} />;
  if (result.state === 'failed' && result.data === undefined) {
    const why =
      result.error instanceof ApiError && result.error.code === 'github_unavailable'
        ? 'GitHub is not answering.'
        : result.error.message;
    return (
      <Failed
        what={`Could not load ${what}.`}
        why={`${why} Try again.`}
        action={<Button onPress={reload}>Try again</Button>}
      />
    );
  }
  const data = result.state === 'ready' ? result.data : (result as { data: T }).data;
  return (
    <>
      {result.state === 'failed' ? (
        <Message tone="problem" action={<Button onPress={reload}>Try again</Button>}>
          Could not refresh {what}. {result.error.message} The list shows the last copy,
          from {formatAgo(result.loadedAt ?? now, now)}.
        </Message>
      ) : null}
      {children(data)}
    </>
  );
}

/** A fault in the page's own code is not a lost connection (UX-28). */
export class FaultBoundary extends Component<
  { children: ReactNode },
  { error: Error | undefined }
> {
  override state: { error: Error | undefined } = { error: undefined };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    if (this.state.error) {
      return (
        <Failed
          what=""
          why=""
          fault
          details={this.state.error.stack ?? this.state.error.message}
        />
      );
    }
    return this.props.children;
  }
}

import { QuestionCard } from '@crsp/ui';
import type { Question } from '../api/hooks';

/** The question card of a destructive step, with its one-line result under it (UX-27). */
export function Ask({
  title,
  action,
  busyLabel,
  q,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  action: string;
  busyLabel: string;
  q: Question | undefined;
  busy: boolean;
  error: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!q) return null;
  return (
    <QuestionCard
      title={title}
      items={error ? [...q.items, `Problem: ${error}`] : q.items}
      waitsFor={q.waitsFor}
      action={action}
      busyLabel={busyLabel}
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
