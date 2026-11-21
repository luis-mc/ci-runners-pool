// The routes of the Jobs section, and the redirects of the old Jobs addresses (web-console R5.117). Jobs has six tabs
// (UX-74): Overview, Live, Done, Run elsewhere, Run insights, Charts. The old Queue, Running and By tabs go to the
// list or the Group by choice that replaced them, with their filter kept.
import { Navigate, Route, useLocation } from 'react-router-dom';
import { ChartsTab } from './Charts';
import { type GroupBy } from './Groups';
import { DoneTab, ElsewhereTab, JobsLayout, LiveTab } from './JobsHome';
import { JobsIndex } from './Overview';
import { JobPage } from './JobPage';
import { RunPage } from './RunPage';
import { ActionWizard } from '../insights/ActionWizard';
import { DoNext } from '../insights/DoNext';
import { FindingPage } from '../insights/Finding';
import { Guardrails } from '../insights/Guardrails';
import { InsightsLayout } from '../insights/InsightsLayout';
import { Tests } from '../insights/Tests';
import { Timeline } from '../insights/Timeline';
import { Waits } from '../insights/Waits';

/** An old address goes to its new one; the filter of its query stays, and `set` adds what the old tab meant. */
function Moved({ to, set }: { to: string; set: Record<string, string> }) {
  const { search } = useLocation();
  const q = new URLSearchParams(search);
  for (const [k, v] of Object.entries(set)) q.set(k, v);
  const s = q.toString();
  return <Navigate to={`${to}${s ? `?${s}` : ''}`} replace />;
}

const group = (by: GroupBy) => <Moved to="/jobs/done" set={{ group: by }} />;

export const jobsRoutes = (
  <>
    <Route element={<JobsLayout />}>
      <Route path="jobs" element={<JobsIndex />} />
      <Route path="jobs/live" element={<LiveTab />} />
      <Route
        path="jobs/running"
        element={<Moved to="/jobs/live" set={{ state: 'running' }} />}
      />
      <Route path="jobs/done" element={<DoneTab />} />
      <Route path="jobs/elsewhere" element={<ElsewhereTab />} />
      <Route path="jobs/repository" element={group('repository')} />
      <Route path="jobs/machine" element={group('machine')} />
      <Route path="jobs/runner" element={group('runner')} />
      <Route path="jobs/runner-type" element={group('runner-type')} />
      <Route path="jobs/job-type" element={group('job-type')} />
      <Route path="jobs/insights" element={<InsightsLayout />}>
        <Route index element={<DoNext />} />
        <Route path="waits" element={<Waits />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="tests" element={<Tests />} />
        <Route path="guardrails" element={<Guardrails />} />
      </Route>
      <Route path="jobs/charts" element={<ChartsTab />} />
      <Route path="jobs/trends" element={<Navigate to="/jobs/charts" replace />} />
    </Route>
    <Route path="jobs/insights/finding/:id" element={<FindingPage />} />
    <Route path="jobs/insights/finding/:id/change" element={<ActionWizard />} />
    <Route path="jobs/run/:runId" element={<RunPage />} />
    <Route path="jobs/:id" element={<JobPage />} />
  </>
);
