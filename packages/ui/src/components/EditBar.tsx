// Component 48, edit screens (LOOK21, owner decision D38): the bar of a screen with a form, and the guard that asks
// before the person leaves with unsaved changes. A page passes the number of changes and what Save and Cancel do;
// the part draws "Unsaved changes (n)", keeps Save and Cancel disabled until something changed, and asks
// "Discard changes?" when the person leaves by a link, a tab, Back, or by closing the browser tab.
import { useContext, useEffect, type ReactNode } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import { ActionBar, unsavedStatus } from './ActionBar';
import { Button } from './Button';
import { Dialog } from './Dialog';

export const LEAVE_WORDS = {
  title: 'Discard changes?',
  body: 'You changed this page and did not save. If you leave now, the changes are lost.',
  keep: 'Keep editing',
  discard: 'Discard',
} as const;

/** The question with its two answers, shown when a router blocker holds a move. */
function LeaveQuestion({ blocker }: { blocker: ReturnType<typeof useBlocker> }) {
  if (blocker.state !== 'blocked') return null;
  return (
    <Dialog
      title={LEAVE_WORDS.title}
      cancelLabel={LEAVE_WORDS.keep}
      onClose={() => blocker.reset()}
      primary={{
        label: LEAVE_WORDS.discard,
        kind: 'danger',
        onPress: () => blocker.proceed(),
      }}
    >
      <p>{LEAVE_WORDS.body}</p>
    </Dialog>
  );
}

/** In a data router: holds every in-app move (link, tab, Back and Forward) while `when` is true. */
function RouterLeaveGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(when);
  return <LeaveQuestion blocker={blocker} />;
}

/**
 * Holds a move out of the page while `when` is true. Closing the browser tab, or a reload, shows the browser's own
 * question. In-app moves show "Discard changes?" with Keep editing and Discard (needs the data router; without one
 * only the browser question works).
 */
export function LeaveGuard({ when }: { when: boolean }) {
  const inDataRouter = useContext(UNSAFE_DataRouterContext) !== null;
  useEffect(() => {
    if (!when) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [when]);
  return inDataRouter ? <RouterLeaveGuard when={when} /> : null;
}

export interface EditBarProps {
  /** How many things differ from what is saved. 0 when clean. */
  changes: number;
  onSave: () => void;
  /** Puts the form back to what is saved. */
  onCancel: () => void;
  busy?: boolean | undefined;
  /** True when this person may not save at all (a role); `why` says it. */
  blocked?: boolean | undefined;
  /** The reason of the disabled Save while it is blocked. */
  why?: string | undefined;
  /** Extra words on the left of the bar's status, e.g. a second status line. */
  status?: ReactNode | undefined;
  /** True for a bar inside a form that submits (Enter in a field saves). */
  submit?: boolean | undefined;
  saveLabel?: string | undefined;
  busyLabel?: string | undefined;
  /** Another reason Save is held (a check is running); the bar keeps Save disabled with this reason. */
  holdReason?: string | undefined;
}

export const EDIT_WORDS = {
  cancelReason: 'Nothing has changed.',
  saveReason: 'Nothing has changed yet.',
} as const;

/** The bar of an edit screen: status, Cancel, Save, and the leave guard. One per screen (UX-71). */
export function EditBar({
  changes,
  onSave,
  onCancel,
  busy = false,
  blocked = false,
  why,
  status,
  submit = true,
  saveLabel = 'Save',
  busyLabel = 'Saving',
  holdReason,
}: EditBarProps) {
  const clean = changes === 0;
  const reason = blocked ? why : (holdReason ?? EDIT_WORDS.saveReason);
  return (
    <>
      <LeaveGuard when={changes > 0 && !busy} />
      <ActionBar
        status={status ?? unsavedStatus(changes)}
        secondary={
          <Button
            onPress={onCancel}
            disabled={clean || busy}
            reason={EDIT_WORDS.cancelReason}
          >
            Cancel
          </Button>
        }
        primary={
          <Button
            kind="primary"
            submit={submit}
            onPress={submit ? undefined : onSave}
            busy={busy}
            busyLabel={busyLabel}
            disabled={clean || blocked || Boolean(holdReason)}
            reason={reason}
          >
            {saveLabel}
          </Button>
        }
      />
    </>
  );
}
