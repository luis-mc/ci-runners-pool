// The guard cases that today's main fails, each with the task that fixes the screen (CRSP164). The join turns a case
// on by deleting its line here after it merges that task. `UX_NOFIXME=1` runs every case as if the list were empty.
// Keys: `<check>|<route pattern>|<state>`; a `*` in the pattern or state matches any.
export const FIXME: Record<string, string> = {
  'primary|/setup|data': 'CRSP160 one primary button',
  'touch|/|data': 'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'touch|/repositories|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'primary|/repositories|data': 'CRSP162 one primary button',
  'selectAll|/repositories|data': 'CRSP162 Select all N and Clear',
  'pane|/repositories|data': 'CRSP162 sections, lists and tables inside a Pane',
  'touch|/repositories/turn-on|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'touch|/repositories/:owner/:name|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'primary|/repositories/:owner/:name|data': 'CRSP162 one primary button',
  'h1|/repositories/:owner/:name|empty': 'CRSP162 the h1 stays in this state',
  'h1|/repositories/:owner/:name|failed': 'CRSP162 the h1 stays in this state',
  'touch|/machines|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'primary|/machines|data': 'CRSP161 one primary button',
  'pane|/machines|data': 'CRSP161 sections, lists and tables inside a Pane',
  'touch|/machines/add|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'touch|/machines/:id|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'primary|/machines/:id|data': 'CRSP161 one primary button',
  'h1|/machines/:id|empty': 'CRSP161 the h1 stays in this state',
  'h1|/machines/:id|failed': 'CRSP161 the h1 stays in this state',
  'touch|/runners|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'primary|/runners|data': 'CRSP163 one primary button',
  'selectAll|/runners|data': 'CRSP163 Select all N and Clear',
  'pane|/runners|data': 'CRSP163 sections, lists and tables inside a Pane',
  'touch|/runners/add|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'touch|/jobs|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'primary|/jobs|data': 'CRSP160 one primary button',
  'touch|/jobs/:id|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'primary|/jobs/:id|data': 'CRSP160 one primary button',
  'h1|/jobs/:id|empty': 'CRSP160 the h1 stays in this state',
  'h1|/jobs/:id|failed': 'CRSP160 the h1 stays in this state',
  'primary|/images|data': 'CRSP163 one primary button',
  'primary|/caches|data': 'CRSP163 one primary button',
  'touch|/settings/updates/review|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'touch|/settings/users|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'navScroll|/settings/users|data':
    'CRSP157 shared tab row and settings menu must not scroll sideways',
  'navScroll|/settings/app|data':
    'CRSP157 shared tab row and settings menu must not scroll sideways',
  'primary|/settings/repositories|data': 'CRSP159 one primary button',
  'navScroll|/settings/repositories|data':
    'CRSP157 shared tab row and settings menu must not scroll sideways',
  'primary|/settings/appearance|data': 'CRSP159 one primary button',
  'navScroll|/settings/appearance|data':
    'CRSP157 shared tab row and settings menu must not scroll sideways',
  'primary|/settings/retention|data': 'CRSP159 one primary button',
  'navScroll|/settings/retention|data':
    'CRSP157 shared tab row and settings menu must not scroll sideways',
  'primary|/settings/backups|data': 'CRSP159 one primary button',
  'navScroll|/settings/backups|data':
    'CRSP157 shared tab row and settings menu must not scroll sideways',
  'primary|/settings/budgets|data': 'CRSP159 one primary button',
  'navScroll|/settings/budgets|data':
    'CRSP157 shared tab row and settings menu must not scroll sideways',
  'navScroll|/settings/notifications|data':
    'CRSP157 shared tab row and settings menu must not scroll sideways',
  'navScroll|/settings/access|data':
    'CRSP157 shared tab row and settings menu must not scroll sideways',
  'primary|/settings/updates|data': 'CRSP159 one primary button',
  'navScroll|/settings/updates|data':
    'CRSP157 shared tab row and settings menu must not scroll sideways',
  'primary|/settings/audit|data': 'CRSP159 one primary button',
  'navScroll|/settings/audit|data':
    'CRSP157 shared tab row and settings menu must not scroll sideways',
  'primary|/settings/export|data': 'CRSP159 one primary button',
  'navScroll|/settings/export|data':
    'CRSP157 shared tab row and settings menu must not scroll sideways',
  'touch|not found|data':
    'CRSP157 shared UI hit area (link, checkbox, sort button, breadcrumb)',
  'keyboard|/|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/repositories|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/repositories/turn-on|data':
    'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/repositories/:owner/:name|data':
    'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/machines|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/machines/add|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/machines/:id|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/runners|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/runners/add|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/jobs|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/jobs/:id|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/images|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/caches|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/doctor|data': 'CRSP158 ArrowDown and ArrowUp walk the controls',
  'keyboard|/settings/updates/review|data':
    'CRSP158 ArrowDown and ArrowUp walk the controls',
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
  'palette-focus|*|data': 'CRSP158 palette opens with focus in the search box',
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
