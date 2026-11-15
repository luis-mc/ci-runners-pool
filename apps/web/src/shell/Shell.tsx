// The shell of every signed-in screen (web-console 4.0, R5.3): header, top menu, banner slot, activity strip,
// command palette, shortcut list and the session-ended dialog.
import {
  ActivityStrip,
  BannerSlot,
  Dialog,
  Frame,
  Header,
  Message,
  ResultList,
  SearchBar,
  ShortcutTable,
  Status,
  Text,
  TextLink,
  TopMenu,
  UserMenu,
  formatAgo,
  useNow,
  type ActivityJob,
  type NavItem,
} from '@crsp/ui';
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { unwrap, useClient, type Schemas } from '../api/api';
import { signInUrl, useSession } from '../auth/session';
import { useLiveState } from '../live/LiveProvider';
import { wipingLabel } from '../screens/images/labels';
import { allRepositories } from '../screens/repositories/plans';
import { SHORTCUTS, handleKey, isMac } from './shortcuts';

export const AREAS: readonly NavItem[] = [
  { to: '/', label: 'Overview', end: true },
  { to: '/repositories', label: 'Repositories' },
  { to: '/machines', label: 'Machines' },
  { to: '/runners', label: 'Runners' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/images', label: 'Images and caches' },
  { to: '/doctor', label: 'Doctor' },
  { to: '/settings/users', label: 'Settings' },
];

interface Command {
  id: string;
  label: string;
  hint?: string;
  to: string;
}

/** Pool status as a word, a glyph and a colour (UX-58). */
function PoolStatus() {
  const live = useLiveState();
  const machines = live.overview?.machines;
  if (!machines) return <Status kind="waiting" word="reading" />;
  if (machines.length === 0) return <Status kind="waiting" word="no machines" />;
  const online = machines.filter((m) => m.online && m.state === 'active').length;
  if (online === 0) return <Status kind="failed" word="offline" />;
  return <Status kind="ok" word={`${online} of ${machines.length} online`} />;
}

function LiveState() {
  const live = useLiveState();
  const now = useNow();
  if (live.status === 'live') return <Status kind="ok" word="live" />;
  if (live.status === 'connecting') return <Status kind="waiting" word="connecting" />;
  return (
    <Status
      kind="waiting"
      word={`paused${live.lastEventAt ? `, data from ${formatAgo(live.lastEventAt, now)}` : ''}`}
    />
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const session = useSession();
  const client = useClient();
  const navigate = useNavigate();
  const live = useLiveState();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [found, setFound] = useState<Command[]>([]);

  useEffect(() => {
    let on = true;
    void Promise.allSettled([
      unwrap(client.GET('/api/v1/runners')),
      unwrap(
        client.GET('/api/v1/github/repositories', { params: { query: { limit: 100 } } }),
      ),
    ]).then(([runners, repos]) => {
      if (!on) return;
      const out: Command[] = [];
      if (runners.status === 'fulfilled')
        for (const r of runners.value.items)
          out.push({
            id: `runner:${r.id}`,
            label: r.name,
            hint: 'runner',
            to: `/runners`,
          });
      if (repos.status === 'fulfilled')
        for (const r of repos.value.items)
          out.push({
            id: `repo:${r.id}`,
            label: r.full_name,
            hint: 'repository',
            to: `/repositories/${r.owner}/${r.name}`,
          });
      setFound(out);
    });
    return () => {
      on = false;
    };
  }, [client]);

  const all = useMemo(() => {
    const items: Command[] = AREAS.map((a) => ({
      id: `area:${a.to}`,
      label: a.label,
      hint: 'area',
      to: a.to,
    }));
    for (const m of live.overview?.machines ?? [])
      items.push({
        id: `machine:${m.id}`,
        label: m.name,
        hint: 'machine',
        to: `/machines/${m.id}`,
      });
    items.push(...found);
    if (session.can('admin')) {
      items.push(
        {
          id: 'cmd:add-machine',
          label: 'Add a machine',
          hint: 'command',
          to: '/machines/add',
        },
        {
          id: 'cmd:add-runners',
          label: 'Add runners',
          hint: 'command',
          to: '/runners/add',
        },
        {
          id: 'cmd:pool-on',
          label: 'Turn on the pool',
          hint: 'command',
          to: '/repositories',
        },
      );
    }
    if (session.can('owner'))
      items.push({
        id: 'cmd:users',
        label: 'Add a user',
        hint: 'command',
        to: '/settings/users',
      });
    return items;
  }, [live.overview, found, session]);

  const shown = all
    .filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 12);
  const go = (id: string) => {
    const hit = all.find((i) => i.id === id);
    if (hit) {
      onClose();
      void navigate(hit.to);
    }
  };

  return (
    <Dialog title="Commands" onClose={onClose} initialFocus="first">
      <div
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(shown.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter') {
            const it = shown[active];
            if (it) go(it.id);
          }
        }}
      >
        <SearchBar
          value={q}
          onChange={(v) => {
            setQ(v);
            setActive(0);
          }}
          label="Search areas, items and commands"
        />
        {shown.length === 0 ? (
          <Text>Nothing matches. Clear the search to see every area.</Text>
        ) : (
          <ResultList label="Results" items={shown} active={active} onPick={go} />
        )}
      </div>
    </Dialog>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const session = useSession();
  const live = useLiveState();
  const navigate = useNavigate();
  const location = useLocation();
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [setup, setSetup] = useState<Schemas['SetupState'] | undefined>(undefined);
  const client = useClient();
  // The Overview says in one line while a repository runs on GitHub-hosted runners (github-integration R5.68).
  const [hosted, setHosted] = useState(0);
  const onOverview = location.pathname === '/';
  useEffect(() => {
    if (!onOverview) return;
    let on = true;
    const read = () =>
      allRepositories(client, { pool: 'on' })
        .then(
          (r) =>
            on && setHosted(r.items.filter((x) => x.routing?.where === 'hosted').length),
        )
        .catch(() => undefined);
    void read();
    const t = setInterval(() => void read(), 30_000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, [client, onOverview]);
  useEffect(() => {
    let on = true;
    unwrap(client.GET('/api/v1/setup'))
      .then((s) => on && setSetup(s))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [client]);

  // Layout effect: the listener is on before the first paint, so a key pressed
  // the moment the page shows is never lost to a deferred passive effect.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      handleKey(e, {
        openPalette: () => setPalette(true),
        openHelp: () => setHelp(true),
      });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (session.state.status !== 'ready') return null;
  const user = session.state.session.user;

  const jobs: ActivityJob[] = Object.values(live.progress)
    .map((ev): ActivityJob | undefined => {
      if (ev.change && ev.change.state !== 'done' && ev.change.state !== 'cancelled') {
        const waiting = ev.change.waiting_for.length;
        return {
          id: `change:${ev.change.id}`,
          label: `${ev.change.kind === 'drain' ? 'Draining' : 'Working on'} a machine, waiting for ${waiting} ${waiting === 1 ? 'job' : 'jobs'}`,
        };
      }
      if (ev.cache && ev.cache.state === 'wiping') {
        return { id: `cache:${ev.cache.id}`, label: wipingLabel(ev.cache) };
      }
      if (ev.plan && (ev.plan.state === 'applying' || ev.plan.state === 'planned')) {
        const done = ev.plan.steps.filter((s) => s.state === 'done').length;
        return {
          id: `plan:${ev.plan.id}`,
          label: `Applying a plan, ${done} of ${ev.plan.steps.length}`,
          value: done,
          max: ev.plan.steps.length,
        };
      }
      return undefined;
    })
    .filter((j): j is ActivityJob => j !== undefined);

  const banners: ReactNode[] = [];
  if (setup && Object.values(setup.steps).some((v) => v === 'todo'))
    banners.push(
      <Message
        key="first-run"
        tone="needs-you"
        action={<TextLink to="/setup">Open the setup page</TextLink>}
      >
        First run is not finished.
      </Message>,
    );
  if (onOverview && hosted > 0)
    banners.push(
      <Message
        key="hosted-fallback"
        tone="needs-you"
        action={<TextLink to="/repositories">Open Repositories</TextLink>}
      >
        {hosted === 1
          ? '1 repository runs on GitHub-hosted runners because no crsp machine is up.'
          : `${hosted} repositories run on GitHub-hosted runners because no crsp machine is up.`}
      </Message>,
    );
  if (live.status === 'paused')
    banners.push(
      <Message key="live" tone="note">
        Live updates paused. The data on screen is the last that arrived. The console
        reconnects by itself.
      </Message>,
    );

  return (
    <>
      <Frame
        header={
          <Header
            product="CI Runners Shared Pool"
            status={<PoolStatus />}
            live={<LiveState />}
            paletteHint={isMac() ? 'Cmd+K' : 'Ctrl+K'}
            onPalette={() => setPalette(true)}
            menu={
              <UserMenu
                login={user.login}
                role={user.role}
                busy={signingOut}
                onSignOut={() => {
                  setSigningOut(true);
                  void session.signOut().finally(() => {
                    setSigningOut(false);
                    void navigate('/sign-in');
                  });
                }}
              />
            }
          />
        }
        menu={<TopMenu items={AREAS} />}
        banner={<BannerSlot>{banners.length ? banners : undefined}</BannerSlot>}
        strip={<ActivityStrip jobs={jobs} />}
      >
        {children ?? <Outlet />}
      </Frame>
      {palette ? <Palette onClose={() => setPalette(false)} /> : null}
      {help ? (
        <Dialog title="Shortcuts" onClose={() => setHelp(false)}>
          <ShortcutTable items={SHORTCUTS} />
        </Dialog>
      ) : null}
      {session.ended ? (
        <Dialog
          title="Session ended"
          onClose={() => undefined}
          cancelLabel="Stay on this page"
          primary={{
            label: 'Sign in with GitHub',
            onPress: () => {
              window.location.assign(signInUrl(location.pathname + location.search));
            },
          }}
        >
          <p className="ds-text">
            Your session ended. Sign in again to go on. This page and what you typed stay
            as they are.
          </p>
          <TextLink to="/sign-in">Open the sign-in page</TextLink>
        </Dialog>
      ) : null}
    </>
  );
}
