// The route table of the console (web-console section 7). Every signed-in screen sits in the shell (R5.3).
import { Button, ClockProvider, Failed, Loading, Page, PageHeader } from '@crsp/ui';
import type { ApiClient } from '@crsp/contract';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ApiProvider } from './api/api';
import { SignInPage, NoAccess } from './auth/SignIn';
import { SessionProvider, useSession } from './auth/session';
import { LiveProvider } from './live/LiveProvider';
import type { EventSourceFactory } from './live/store';
import { AppShell } from './shell/Shell';
import { FaultBoundary } from './screens/common';
import { Later, NotFound } from './screens/Later';
import { MachineDetail, MachinesList } from './screens/machines/Machines';
import { AddMachinePage } from './screens/machines/AddMachine';
import { Overview } from './screens/overview/Overview';
import { RepositoriesList, RepositoryDetail } from './screens/repositories/Repositories';
import { TurnOnPoolPage } from './screens/repositories/TurnOnPool';
import { AddRunnersPage } from './screens/runners/AddRunners';
import { RunnersList } from './screens/runners/Runners';
import {
  AppearanceSettings,
  BackupsSettings,
  RetentionSettings,
  SettingsLayout,
  ThemeApplier,
  UsersSettings,
} from './screens/settings/Settings';
import { AuditLogSettings, ConfigExportSettings } from './screens/settings/AuditLog';
import { UpdateReviewPage, UpdatesSettings } from './screens/settings/Updates';
import { SetupPage } from './screens/setup/Setup';

/** No valid session: every path but /sign-in and /setup goes to /sign-in and keeps the path (R5.8). */
function Gate({ factory }: { factory: EventSourceFactory | undefined }) {
  const session = useSession();
  const location = useLocation();
  const s = session.state;
  if (s.status === 'loading')
    return (
      <main>
        <Page>
          <PageHeader title="CI Runners Shared Pool" />
          <Loading what="Loading your session" />
        </Page>
      </main>
    );
  if (s.status === 'signed-out')
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (s.status === 'no-access')
    return <NoAccess login={s.login} onSignOut={() => void session.signOut()} />;
  if (s.status === 'failed')
    return (
      <main>
        <Page>
          <PageHeader title="CI Runners Shared Pool" />
          <Failed
            what="Could not load your session."
            why={`${s.message} Try again.`}
            action={<Button onPress={session.refresh}>Try again</Button>}
          />
        </Page>
      </main>
    );
  return (
    <LiveProvider {...(factory ? { factory } : {})}>
      <ThemeApplier />
      <AppShell>
        <FaultBoundary key={location.pathname}>
          <Outlet />
        </FaultBoundary>
      </AppShell>
    </LiveProvider>
  );
}

export function App({
  client,
  eventSource,
}: {
  client?: ApiClient;
  /** A stream factory for tests; the browser's EventSource is used when it is not given. */
  eventSource?: EventSourceFactory;
}) {
  return (
    <ApiProvider {...(client ? { client } : {})}>
      <ClockProvider>
        <SessionProvider>
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route element={<Gate factory={eventSource} />}>
              <Route index element={<Overview />} />
              <Route path="repositories" element={<RepositoriesList />} />
              <Route path="repositories/turn-on" element={<TurnOnPoolPage />} />
              <Route path="repositories/:owner/:name" element={<RepositoryDetail />} />
              <Route path="machines" element={<MachinesList />} />
              <Route path="machines/add" element={<AddMachinePage />} />
              <Route path="machines/:id" element={<MachineDetail />} />
              <Route path="runners" element={<RunnersList />} />
              <Route path="runners/add" element={<AddRunnersPage />} />
              <Route
                path="jobs/*"
                element={
                  <Later title="Jobs" what="The job history" milestone="milestone 2" />
                }
              />
              <Route
                path="images"
                element={
                  <Later
                    title="Images and caches"
                    what="Images and caches"
                    milestone="milestone 2 and 7"
                  />
                }
              />
              <Route
                path="caches"
                element={
                  <Later
                    title="Images and caches"
                    what="Caches"
                    milestone="milestone 7"
                  />
                }
              />
              <Route
                path="doctor"
                element={
                  <Later title="Doctor" what="The doctor" milestone="milestone 2" />
                }
              />
              <Route path="settings/updates/review" element={<UpdateReviewPage />} />
              <Route path="settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="users" replace />} />
                <Route path="users" element={<UsersSettings />} />
                <Route path="appearance" element={<AppearanceSettings />} />
                <Route path="retention" element={<RetentionSettings />} />
                <Route path="backups" element={<BackupsSettings />} />
                <Route
                  path="budgets"
                  element={
                    <Later
                      title="Budgets"
                      what="The pool budgets"
                      milestone="a later milestone"
                    />
                  }
                />
                <Route
                  path="notifications"
                  element={
                    <Later
                      title="Notifications"
                      what="Notifications"
                      milestone="milestone 8"
                    />
                  }
                />
                <Route path="updates" element={<UpdatesSettings />} />
                <Route path="audit" element={<AuditLogSettings />} />
                <Route path="export" element={<ConfigExportSettings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </SessionProvider>
      </ClockProvider>
    </ApiProvider>
  );
}
