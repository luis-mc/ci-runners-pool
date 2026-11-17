// The guard cases that today's main fails, each with the task that fixes the screen (CRSP164). The join turns a case
// on by deleting its line here after it merges that task. `UX_NOFIXME=1` runs every case as if the list were empty.
// Keys: `<check>|<route pattern>|<state>`; a `*` in the pattern or state matches any.
export const FIXME: Record<string, string> = {};

export function fixmeFor(
  check: string,
  pattern: string,
  state: string,
): string | undefined {
  if (process.env.UX_NOFIXME === '1') return undefined;
  return (
    FIXME[`${check}|${pattern}|${state}`] ??
    FIXME[`${check}|${pattern}|*`] ??
    FIXME[`${check}|*|${state}`] ??
    FIXME[`${check}|*|*`]
  );
}
