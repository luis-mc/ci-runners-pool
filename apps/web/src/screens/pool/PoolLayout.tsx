// Shared Pool (D24, LOOK31): the sub-sections of the pool as one row of tabs above each list page.
// Add and detail pages sit under /pool too but show no tabs: they have a breadcrumb back.
import { Page, Tabs } from '@crsp/ui';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

export const POOL_TABS = [
  { id: 'summary', label: 'Summary', to: '/pool' },
  { id: 'machines', label: 'Machines', to: '/pool/machines' },
  { id: 'runners', label: 'Runners', to: '/pool/runners' },
  { id: 'images', label: 'Images and caches', to: '/pool/images' },
  { id: 'size', label: 'Size and backends', to: '/pool/size' },
] as const;

export function PoolLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const segment = pathname.split('/')[2] ?? '';
  const current = POOL_TABS.find((t) => t.id === segment)?.id ?? 'summary';
  return (
    <>
      <Page>
        <Tabs
          label="Shared Pool sections"
          tabs={POOL_TABS}
          current={current}
          onChange={(id) =>
            void navigate(POOL_TABS.find((t) => t.id === id)?.to ?? '/pool')
          }
        />
      </Page>
      <Outlet />
    </>
  );
}
