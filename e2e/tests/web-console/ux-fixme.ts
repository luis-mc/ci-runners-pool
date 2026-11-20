// The guard cases that today's main fails, each with the task that fixes the screen (CRSP164). The join turns a case
// on by deleting its line here after it merges that task. `UX_NOFIXME=1` runs every case as if the list were empty.
// Keys: `<check>|<route pattern>|<state>`; a `*` in the pattern or state matches any.
//
// LOOK35 (RES21 T8): the guards of this file's first block land red but gated. One entry per current breach, tagged
// with the fix task that removes it: T1 sticky bar and key-hint bar, T2 button nowrap, T3 tables, T4 long names on
// cards and Pool size Open, T5 row action words, T6 Message and Chip wrapping and the pane gap, T7 heatmap labels
// and the h1 while loading. A fix task deletes its lines and the guard then holds the fix.
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
