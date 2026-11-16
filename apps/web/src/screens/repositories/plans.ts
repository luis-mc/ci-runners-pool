// Repository plans (github-integration R5.20): plan the change, show it, apply it, and read the stored result.
import type { ApiClient } from '@crsp/contract';
import { TIMING } from '../../timing';
import { unwrap, type Schemas } from '../../api/api';

export type Plan = Schemas['Plan'];
export type Repository = Schemas['Repository'];

/** Every repository of the installations: pages are read until the controller has no more. */
export async function allRepositories(
  client: ApiClient,
  query: { pool?: 'on' | 'off'; q?: string; refresh?: boolean } = {},
): Promise<{ items: Repository[]; stale: Schemas['Staleness'] }> {
  const items: Repository[] = [];
  let cursor: string | undefined;
  let stale: Schemas['Staleness'] = { stale: false };
  for (let page = 0; page < 50; page += 1) {
    const res = await unwrap(
      client.GET('/api/v1/github/repositories', {
        params: { query: { ...query, limit: 100, ...(cursor ? { cursor } : {}) } },
      }),
    );
    items.push(...res.items);
    stale = res.stale;
    cursor = res.next_cursor;
    if (!cursor) break;
  }
  return { items, stale };
}

/** Whether the user is a GitHub admin of the repository: yes, no, or not known yet (CRSP125). */
export function adminState(r: Repository): 'yes' | 'no' | 'unknown' {
  if (r.user_is_github_admin) return 'yes';
  return r.user_admin_known === false ? 'unknown' : 'no';
}

/**
 * The notes under the repository choice. "No admin rights" is said only for repositories GitHub
 * answered about; the ones not asked yet are said apart and never blamed on rights (CRSP125).
 */
export function adminNotes(repos: Repository[]): { noRights?: string; unknown?: string } {
  const no = repos.filter((r) => adminState(r) === 'no').length;
  const unknown = repos.filter((r) => adminState(r) === 'unknown').length;
  const out: { noRights?: string; unknown?: string } = {};
  if (no > 0)
    out.noRights = `${no} ${no === 1 ? 'repository is' : 'repositories are'} not listed: you need admin rights on ${no === 1 ? 'it' : 'them'} in GitHub.`;
  if (unknown > 0)
    out.unknown = `${unknown} ${unknown === 1 ? 'repository is' : 'repositories are'} not listed yet: GitHub has not said whether you have admin rights on ${unknown === 1 ? 'it' : 'them'}.`;
  return out;
}

export function needsYes(plan: Plan): string[] {
  return plan.steps.filter((s) => s.needs_yes).map((s) => s.id);
}

export function planProgress(plan: Plan): {
  done: number;
  total: number;
  current?: string;
} {
  const total = plan.steps.length;
  const done = plan.steps.filter(
    (s) => s.state === 'done' || s.state === 'skipped',
  ).length;
  const current = plan.steps.find(
    (s) => s.state === 'running' || s.state === 'waiting',
  )?.text;
  return { done, total, ...(current ? { current } : {}) };
}

/** Plan and apply one change, then read the plan until it ends. */
export async function applyChanges(
  client: ApiClient,
  changes: { repository_id: number; pool: 'on' | 'off' }[],
  poll: () => Promise<void> = () => new Promise((r) => setTimeout(r, TIMING.planPollMs)),
): Promise<Plan> {
  const planned = await unwrap(
    client.POST('/api/v1/repository-plans', { body: { changes } }),
  );
  let plan = await unwrap(
    client.POST('/api/v1/repository-plans/{planId}/apply', {
      params: { path: { planId: planned.id } },
      body: { approved_steps: needsYes(planned) },
    }),
  );
  for (
    let i = 0;
    i < 600 && (plan.state === 'applying' || plan.state === 'planned');
    i += 1
  ) {
    await poll();
    plan = await unwrap(
      client.GET('/api/v1/repository-plans/{planId}', {
        params: { path: { planId: plan.id } },
      }),
    );
  }
  return plan;
}
