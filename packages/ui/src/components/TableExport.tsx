// Component 29: the Export button of a table (UX-39). The page passes `onExport`, which asks the controller for
// the file; the controller holds every row in the order shown, neutralises formula text and names the file for
// what it holds, then the date and time. The button is busy until the answer (UX-13) and a failure is one line
// under it (UX-27). A page that offers it does not name the file format in its lead.
import { useState } from 'react';
import { Button } from './Button';
import { Message } from './Message';

export interface ExportButtonProps {
  /** Asks for the file and saves it. Rejects with an Error whose message says why it failed. */
  onExport: () => Promise<void>;
  /** The button word. */
  label?: string | undefined;
  /** What failed, in a few words ("the audit log"). */
  what: string;
  disabled?: boolean | undefined;
  reason?: string | undefined;
}

export function ExportButton({
  onExport,
  label = 'Export',
  what,
  disabled,
  reason,
}: ExportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const press = () => {
    setBusy(true);
    setError(undefined);
    onExport()
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'The controller did not answer.'),
      )
      .finally(() => setBusy(false));
  };
  return (
    <>
      <Button
        onPress={press}
        busy={busy}
        busyLabel="Exporting"
        disabled={disabled}
        reason={reason}
      >
        {label}
      </Button>
      {error ? (
        <Message tone="problem">
          Could not export {what}. {error}
        </Message>
      ) : null}
    </>
  );
}
