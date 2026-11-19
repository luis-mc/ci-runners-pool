// The guard cases that today's main fails, each with the task that fixes the screen (CRSP164). The join turns a case
// on by deleting its line here after it merges that task. `UX_NOFIXME=1` runs every case as if the list were empty.
// Keys: `<check>|<route pattern>|<state>`; a `*` in the pattern or state matches any.
//
// LOOK35 (RES21 T8): the guards of this file's first block land red but gated. One entry per current breach, tagged
// with the fix task that removes it: T1 sticky bar and key-hint bar, T2 button nowrap, T3 tables, T4 long names on
// cards and Pool size Open, T5 row action words, T6 Message and Chip wrapping and the pane gap, T7 heatmap labels
// and the h1 while loading. A fix task deletes its lines and the guard then holds the fix.
export const FIXME: Record<string, string> = {
  // T2
  'wordBroken|/pool/runners|stress': 'T2: B04',
  'wrapped|/pool/runners|stress': 'T2: B04',
  'wrapped|/repositories|data': 'T2: B12',
  'wrapped|/repositories|stress': 'T2: B12',
  'wrapped|/repositories/turn-on|empty': 'T2: B13',
  'wrapped|/settings/access|data': 'T2: B11',
  'wrapped|/settings/access|stress': 'T2: B11',
  'wrapped|/settings/app|data': 'T2: B11',
  'wrapped|/settings/app|stress': 'T2: B11',
  'wrapped|/settings/users|data': 'T2: B11',
  'wrapped|/settings/users|stress': 'T2: B11',
  // T3
  'rowHeights|/pool/runners|stress': 'T3: B05',
  'rowHeights|/settings/access|data': 'T3: B10',
  'rowHeights|/settings/access|stress': 'T3: B10',
  'rowHeights|/settings/app|data': 'T3: B10',
  'rowHeights|/settings/app|stress': 'T3: B10',
  'rowHeights|/settings/users|data': 'T3: B10',
  'rowHeights|/settings/users|stress': 'T3: B10',
  // T5
  'rowActionWords|/doctor|data': 'T5: B09 (Copy)',
  'rowActionWords|/doctor|stress': 'T5: B09 (Copy)',
  'rowActionWords|/repositories|data': 'T5: B09 (Off)',
  'rowActionWords|/repositories|stress': 'T5: B09 (Off)',
  'rowActionWords|/settings/access|data': 'T5: B09',
  'rowActionWords|/settings/access|stress': 'T5: B09',
  'rowActionWords|/settings/app|data': 'T5: B09',
  'rowActionWords|/settings/app|stress': 'T5: B09',
  'rowActionWords|/settings/users|data': 'T5: B09',
  'rowActionWords|/settings/users|stress': 'T5: B09',
};

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
