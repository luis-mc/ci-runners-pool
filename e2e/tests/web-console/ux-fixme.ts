// The guard cases that today's main fails, each with the task that fixes the screen (CRSP164). The join turns a case
// on by deleting its line here after it merges that task. `UX_NOFIXME=1` runs every case as if the list were empty.
// Keys: `<check>|<route pattern>|<state>`; a `*` in the pattern or state matches any.
export const FIXME: Record<string, string> = {
  'touch|/repositories|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'primary|/machines|data': 'CRSP161 one primary button',
  'primary|/machines/:id|data': 'CRSP161 one primary button',
  'primary|/jobs|data': 'CRSP160 one primary button',
  'touch|/jobs/:id|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'primary|/jobs/:id|data': 'CRSP160 one primary button',
  'primary|/images|data': 'CRSP163 one primary button',
  'primary|/caches|data': 'CRSP163 one primary button',
  'primary|/settings/repositories|data': 'CRSP159 one primary button',
  'primary|/settings/retention|data': 'CRSP159 one primary button',
  'primary|/settings/backups|data': 'CRSP159 one primary button',
  'primary|/settings/budgets|data': 'CRSP159 one primary button',
  'primary|/settings/audit|data': 'CRSP159 one primary button',
  'primary|/settings/export|data': 'CRSP159 one primary button',
  'keyboard|/repositories/:owner/:name|data':
    'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/machines/add|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/machines/:id|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/runners/add|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/jobs|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/images|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/caches|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/users|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/app|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/repositories|data':
    'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/appearance|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/retention|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/backups|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/budgets|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/notifications|data':
    'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/access|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/updates|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/audit|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/export|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/setup|data':
    'CRSP158 ArrowDown walk repeats a control on this screen (found in the RELEASE-28 join)',
  'keyboard|/settings/console|data':
    'CRSP158 ArrowDown walk skips controls on this settings tab (found in the RELEASE-28 join)',
  'keyboard|/settings/data|data':
    'CRSP158 ArrowDown walk skips controls on this settings tab (found in the RELEASE-28 join)',
  'primary|/settings/access|data':
    'CRSP159 one primary button on this settings tab (found in the RELEASE-28 join)',
  'primary|/settings/data|data':
    'CRSP159 one primary button on this settings tab (found in the RELEASE-28 join)',
  'primary|/settings/users|data':
    'CRSP159 one primary button on this settings tab (found in the RELEASE-28 join)',
  'primary|/settings/app|data':
    'CRSP159 one primary button on this settings tab (found in the RELEASE-28 join)',
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
