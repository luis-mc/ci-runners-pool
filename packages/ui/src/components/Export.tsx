// Component 29: table export (UX-39). One quiet button at the end of a table's toolbar. The file holds every row
// of the filter in the order shown; the server writes it (formula-looking text neutralised) and names it for what
// it holds, then the date and time. The button is busy until the file arrives (UX-13); a failure is one line under
// it (UX-27).
import { useState } from 'react';
import { Button } from './Button';
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

export function ExportButton({
  what,
  run,
  disabled,
  reason,
}: {
  /** What the file holds, in one lower-case word: "jobs". Names the file when the server gave no name. */
  what: string;
  run: () => Promise<ExportedFile>;
  disabled?: boolean | undefined;
  reason?: string | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const go = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const file = await run();
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename ?? `crsp-${what}-${formatFileStamp(new Date())}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
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
      >
        Export
      </Button>
      {error ? (
        <Message tone="problem">Could not export. {error} Try again.</Message>
      ) : null}
    </span>
  );
}
