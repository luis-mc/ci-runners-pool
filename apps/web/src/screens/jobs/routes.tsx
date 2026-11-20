// The routes of the Jobs section, and the redirects of the old Jobs addresses (web-console R5.117).
import { Navigate, Route } from 'react-router-dom';
import { ChartsTab } from './Charts';
import { GroupTab } from './Groups';
import { DoneTab, JobsLayout, QueueTab, RunningTab } from './JobsHome';
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

export const jobsRoutes = (
  <>
    <Route element={<JobsLayout />}>
      <Route path="jobs" element={<QueueTab />} />
      <Route path="jobs/running" element={<RunningTab />} />
      <Route path="jobs/done" element={<DoneTab />} />
      <Route path="jobs/repository" element={<GroupTab by="repository" />} />
      <Route path="jobs/machine" element={<GroupTab by="machine" />} />
      <Route path="jobs/runner" element={<GroupTab by="runner" />} />
      <Route path="jobs/runner-type" element={<GroupTab by="runner-type" />} />
      <Route path="jobs/job-type" element={<GroupTab by="job-type" />} />
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
