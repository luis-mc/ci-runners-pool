import { writeFileSync } from 'node:fs';
const load = (m, c) => ({ memory_pct: m, cpu_pct: c, memory_known: true, cpu_known: true, sampled_at: '2026-11-20T10:00:00Z', stale: false });
const machine = (id, name, os, slots, used, m, c) => ({ id, name, os, arch: 'x64', state: 'active', online: true, taking: { taking_jobs: true }, is_controller: id === 'm1', backends: [{ name: 'docker', present: true, usable: true, allowed: true, version: '27' }],
  settings: { budget_memory_pct: 85, budget_cpu_pct: 60, job_slots: slots, light_slots: 2, heavy_slots: 1, allowed_backends: ['docker'], drain_timeout_minutes: 60, windows_symlink_right: false },
  load: load(m, c), slots_used: used, last_seen_at: '2026-11-20T10:00:00Z',
  running_jobs: Array.from({ length: used }, (_, i) => ({ id: 9 + i, repository: i ? 'octo/site' : 'octo/app', run_id: 1 + i, run_attempt: 1, github_job_id: 1 + i, job_name: i ? 'lint' : 'e2e', labels: [], state: 'running' })) });
const machines = [machine('m1', 'build-1', 'linux', 4, 2, 62, 31), machine('m2', 'win-box', 'windows', 2, 1, 48, 22)];
const runner = (id, name, mid, mn, os, kind, state) => ({ id, name, machine_id: mid, machine_name: mn, os, arch: 'x64', kind, backend: kind === 'ephemeral' ? 'docker' : 'persistent', isolation: kind === 'ephemeral' ? 'container' : 'persistent', labels: ['self-hosted', os, 'x64'], scope: { kind: 'repository', repository_id: 7 }, state, managed: true, keeps_state: kind !== 'ephemeral' });
const runners = [runner('r1', 'crsp-linux-1', 'm1', 'build-1', 'linux', 'persistent', 'busy'), runner('r2', 'crsp-linux-2', 'm1', 'build-1', 'linux', 'ephemeral', 'busy'), runner('r3', 'crsp-win-1', 'm2', 'win-box', 'windows', 'persistent', 'idle')];
const repo = (id, name, on) => ({ id, full_name: 'octo/' + name, owner: 'octo', name, installation_id: 1, visibility: 'private', pool_on: on, user_is_github_admin: true, user_admin_known: true, variables: [], policy: { priority: 10, max_parallel_jobs: 2, allow_fork_pull_requests: false, labels: ['self-hosted'], runner_groups: [] } });
const repos = [repo(7, 'app', true), repo(8, 'site', true), repo(9, 'docs', false)];
const overview = { machines, queued_count: 2, running: [], last_event_id: '1' };
const routes = {
  '/api/v1/me': { user: { id: 1, login: 'octo', role: 'owner', added_at: '2026-11-01T10:00:00Z' }, csrf: 'tok', github_signin: { state: 'active', expires_at: '2026-11-27T18:30:00Z' } },
  '/api/v1/me/preferences': { theme: 'light' },
  '/api/v1/overview': overview,
  '/api/v1/update': { current_version: '1.4.0', latest_version: '1.4.0', update_available: false, state: 'idle', auto_update: false, running_jobs: [], drain_timeout_minutes: 60 },
  '/api/v1/setup': { has_app: true, has_owner: true, setup_link_redeemed: true, steps: { connect_github: 'done', first_machine: 'done', first_repository: 'done' } },
  '/api/v1/machines': { items: machines }, '/api/v1/runners': { items: runners },
  '/api/v1/github/repositories': { items: repos, stale: { stale: false } },
};
writeFileSync(new URL('./fixtures.json', import.meta.url), JSON.stringify({ overview, routes, machines, runners, repos }, null, 1));
