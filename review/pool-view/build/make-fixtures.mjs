// LOOK51: console-chrome fixtures (nav, overview, machines) for the 3-machine example. Domain data lives in model.mjs.
import { writeFileSync } from 'node:fs';
const load = (m, c) => ({ memory_pct: m, cpu_pct: c, memory_known: true, cpu_known: true, sampled_at: '2026-11-21T14:12:00Z', stale: false });
const machine = (id, name, os, slots, used, m, c) => ({ id, name, os, arch: os === 'macos' ? 'arm64' : 'x64', state: 'active', online: true, taking: { taking_jobs: true }, is_controller: id === 'm1', backends: [{ name: 'docker', present: true, usable: true, allowed: true, version: '27' }],
  settings: { budget_memory_pct: 85, budget_cpu_pct: 60, job_slots: slots, light_slots: 2, heavy_slots: 1, allowed_backends: ['docker'], drain_timeout_minutes: 60, windows_symlink_right: false },
  load: load(m, c), slots_used: used, last_seen_at: '2026-11-21T14:12:00Z', running_jobs: [] });
const machines = [machine('m1', 'GameRoomPC', 'linux', 2, 2, 80, 55), machine('m2', 'BuildTower', 'linux', 3, 2, 40, 45), machine('m3', 'MacMini', 'macos', 1, 1, 20, 20)];
const overview = { machines, queued_count: 4, running: [], last_event_id: '1' };
const routes = {
  '/api/v1/me': { user: { id: 1, login: 'octo', role: 'owner', added_at: '2026-11-01T10:00:00Z' }, csrf: 'tok', github_signin: { state: 'active', expires_at: '2026-11-27T18:30:00Z' } },
  '/api/v1/me/preferences': { theme: 'dark' }, '/api/v1/overview': overview,
  '/api/v1/update': { current_version: '1.4.0', latest_version: '1.4.0', update_available: false, state: 'idle', auto_update: false, running_jobs: [], drain_timeout_minutes: 60 },
  '/api/v1/setup': { has_app: true, has_owner: true, setup_link_redeemed: true, steps: { connect_github: 'done', first_machine: 'done', first_repository: 'done' } },
  '/api/v1/machines': { items: machines }, '/api/v1/runners': { items: [] }, '/api/v1/github/repositories': { items: [], stale: { stale: false } },
};
writeFileSync(new URL('./fixtures.json', import.meta.url), JSON.stringify({ overview, routes, machines }, null, 1));
