// The routes of the jobs and doctor screens for the mocked controller API (CRSP35).
import type { Call, Mock } from './fixtures';

export const queuedJob = {
  id: 5,
  repository: 'octo/app',
  repository_id: 7,
  run_id: 101,
  run_attempt: 1,
  github_job_id: 5,
  workflow: 'ci.yml',
  job_name: 'e2e',
  labels: ['self-hosted', 'linux'],
  state: 'queued',
  wait_reason: 'free_slot',
  wait_text: 'waits for a free slot on any Linux machine',
  created_at: '2026-11-14T09:50:00Z',
  queued_at: '2026-11-14T09:51:00Z',
};

export const doneJob = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  repository: 'octo/app',
  repository_id: 7,
  run_id: 100 + id,
  run_attempt: 1,
  github_job_id: id,
  workflow: 'ci.yml',
  job_name: `test-${id}`,
  labels: ['self-hosted', 'linux'],
  state: 'done',
  result: 'success',
  machine_id: 'm1',
  backend: 'docker',
  created_at: '2026-11-13T09:00:00Z',
  started_at: '2026-11-13T09:00:30Z',
  completed_at: '2026-11-13T09:05:00Z',
  github_wait_seconds: 30,
  run_seconds: 270,
  html_url: `https://github.com/octo/app/actions/runs/${100 + id}/job/${id}`,
  ...over,
});

export const finding = (over: Record<string, unknown> = {}) => ({
  check: 'workflow.labels',
  subject: { kind: 'repository', id: '7', name: 'octo/app' },
  severity: 'fail',
  title: 'No online runner carries [self-hosted, linux, arm64]',
  detail: '.github/workflows/ci.yml:12 needs [self-hosted, linux, arm64]',
  fix: { text: 'Add a runner with these labels.', link: '/runners' },
  needs_admin: false,
  milestone: 1,
  checked_at: '2026-11-14T10:00:12Z',
  ...over,
});

/** The queue, a history of three jobs and a doctor with two findings. */
export function jobsAndDoctor(
  mock: Mock,
  history = [1, 2, 3].map((i) => doneJob(i)),
): Mock {
  return mock
    .on('GET', '/api/v1/jobs', (call: Call) =>
      call.query.get('state') === 'queued'
        ? { items: [queuedJob], stale: { stale: false } }
        : { items: history, stale: { stale: false } },
    )
    .on('GET', '/api/v1/jobs/:id', (_call: Call, params: Record<string, string>) =>
      doneJob(Number(params.id)),
    )
    .on('GET', '/api/v1/doctor/findings', {
      items: [
        finding(),
        finding({
          check: 'machine.online',
          severity: 'warn',
          title: 'build-2 is offline',
          detail: undefined,
          subject: { kind: 'machine', id: 'm2', name: 'build-2' },
          fix: { text: 'Start the agent.', command: 'crsp agent start' },
        }),
      ],
      last_run_at: '2026-11-14T10:00:12Z',
    });
}
