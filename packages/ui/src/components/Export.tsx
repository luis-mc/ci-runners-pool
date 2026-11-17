// Component 29: table export (UX-39). One quiet button at the end of a table's toolbar. The file holds every row
// of the filter in the order shown; the server writes it (formula-looking text neutralised) and names it for what
// it holds, then the date and time. The button is busy until the file arrives (UX-13); a failure is one line under
// it (UX-27). A page gives `run` (the part saves the file the page returns) or `onExport` (the page saves it).
import { useState } from 'react';
import { Button, type ButtonKind } from './Button';
import { formatFileStamp } from './format';
import { Message } from './Message';

export interface ExportedFile {
  blob: Blob;
  /** The name the server gave; the stamp is added when it gave none. */
  filename?: string | undefined;
}

/** The file name out of a Content-Disposition header, or undefined. */
export function fileNameOf(disposition: string | null | undefined): string | undefined {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition ?? '');
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

export interface ExportButtonProps {
  /** What the file holds, in a few words ("jobs", "the audit log"): names the file when the server gave no name, and the failure line. */
  what: string;
  /** Asks for the file; the part saves it. */
  run?: (() => Promise<ExportedFile>) | undefined;
  /** Asks for the file and saves it itself. Rejects with an Error whose message says why it failed. */
  onExport?: (() => Promise<void>) | undefined;
  /** The button word. */
  label?: string | undefined;
  disabled?: boolean | undefined;
  reason?: string | undefined;
  /** The button look; the one next action of a screen is primary (UX-4). */
  kind?: ButtonKind | undefined;
}

function save(file: ExportedFile, what: string) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    file.filename ??
    `crsp-${what.replace(/\s+/g, '-')}-${formatFileStamp(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ExportButton({
  what,
  run,
  onExport,
  label = 'Export',
  disabled,
  reason,
  kind,
}: ExportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const go = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (run) save(await run(), what);
      else await onExport?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be made.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="ds-export">
      <Button
        onPress={() => void go()}
        busy={busy}
        busyLabel="Exporting"
        disabled={disabled}
        reason={reason}
        kind={kind}
      >
        {label}
      </Button>
      {error ? (
        <Message tone="problem">
          Could not export {what}. {error}
        </Message>
      ) : null}
    </span>
  );
}
