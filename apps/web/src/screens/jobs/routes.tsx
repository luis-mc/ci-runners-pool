// The routes of the Jobs section, and the redirects of the old Jobs addresses (web-console R5.117).
import { Navigate, Route } from 'react-router-dom';
import { ChartsTab } from './Charts';
import { GroupTab } from './Groups';
import { DoneTab, JobsLayout, QueueTab, RunningTab } from './JobsHome';
import { JobPage } from './JobPage';
import { RunPage } from './RunPage';

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
      <Route path="jobs/charts" element={<ChartsTab />} />
      <Route path="jobs/trends" element={<Navigate to="/jobs/charts" replace />} />
    </Route>
    <Route path="jobs/run/:runId" element={<RunPage />} />
    <Route path="jobs/:id" element={<JobPage />} />
  </>
);
