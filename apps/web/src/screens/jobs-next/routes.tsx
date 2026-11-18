// The routes of the new Jobs section. They reach the console only through the `jobsRoutes` prop of App, which the
// review entry passes and the production entry does not.
import { Route } from 'react-router-dom';
import { ChartsTab } from './Charts';
import { GroupTab } from './Groups';
import { DoneTab, JobsNextLayout, QueueTab, RunningTab } from './JobsHome';
import { JobPage } from './JobPage';
import { RunPage } from './RunPage';

export const jobsNextRoutes = (
  <>
    <Route element={<JobsNextLayout />}>
      <Route path="jobs" element={<QueueTab />} />
      <Route path="jobs/running" element={<RunningTab />} />
      <Route path="jobs/done" element={<DoneTab />} />
      <Route path="jobs/repository" element={<GroupTab by="repository" />} />
      <Route path="jobs/machine" element={<GroupTab by="machine" />} />
      <Route path="jobs/runner" element={<GroupTab by="runner" />} />
      <Route path="jobs/runner-type" element={<GroupTab by="runner-type" />} />
      <Route path="jobs/job-type" element={<GroupTab by="job-type" />} />
      <Route path="jobs/charts" element={<ChartsTab />} />
    </Route>
    <Route path="jobs/run/:runId" element={<RunPage />} />
    <Route path="jobs/:id" element={<JobPage />} />
  </>
);
