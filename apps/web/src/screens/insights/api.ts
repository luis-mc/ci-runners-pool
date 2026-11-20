// Reads of the insights API for the screens. Until CIX21 joins they answer from mock.ts; the join swaps each body
// for a call of the generated client and deletes mock.ts. Every hook has the shape of the Jobs hooks.
import { useLoad, type Loaded } from '../../api/hooks';
import type { Schemas } from '../../api/api';
import * as mock from './mock';

type Hook<T> = { result: Loaded<T>; reload: () => void };
type S = Schemas;

export const useFindings = (repositoryId: number | undefined): Hook<S['InsightFindingList']> =>
  useLoad(() => Promise.resolve(mock.mockFindings({ repository_id: repositoryId })), [repositoryId]);

export const useFinding = (id: number): Hook<S['InsightFinding']> =>
  useLoad(() => {
    const f = mock.MOCK_FINDINGS.find((x) => x.id === id);
    return f ? Promise.resolve(f) : Promise.reject(new Error('This finding is not there any more.'));
  }, [id]);

export const useInsightSummary = (): Hook<S['InsightSummary']> =>
  useLoad(() => Promise.resolve(mock.mockSummary()), []);

export const useDigests = (): Hook<S['InsightDigestList']> =>
  useLoad(() => Promise.resolve(mock.mockDigests()), []);

export const useWaits = (
  days: 7 | 14 | 30,
  group: 'repository' | 'job_key' | 'day',
): Hook<S['WaitSplit']> =>
  useLoad(() => Promise.resolve(mock.mockWaits(days, group)), [days, group]);

export const useTimeline = (hours: number): Hook<S['PoolTimeline']> =>
  useLoad(() => Promise.resolve(mock.mockTimeline(hours)), [hours]);

export const usePoolSizing = (days: 7 | 14 | 30): Hook<S['PoolSizing']> =>
  useLoad(() => Promise.resolve(mock.mockSizing(days)), [days]);

export const useTests = (view: string): Hook<S['TestInsightList']> =>
  useLoad(() => Promise.resolve(mock.mockTests(view)), [view]);

export const useGuardrails = (): Hook<S['GuardrailStatusList']> =>
  useLoad(() => Promise.resolve(mock.mockGuardrails()), []);

export const useRunSavings = (runId: number): Hook<S['RunSavings']> =>
  useLoad(() => Promise.resolve(mock.mockSavings()), [runId]);

export const useJobResources = (jobId: number): Hook<S['JobResources']> =>
  useLoad(() => Promise.resolve(mock.mockResources()), [jobId]);

export const useWorkflowChecks = (repositoryId: number): Hook<S['WorkflowCheckList']> =>
  useLoad(() => Promise.resolve(mock.mockChecks()), [repositoryId]);

/** The plan of a finding's setup change (nothing changes until it is started). */
export const planFor = (findingId: number): Promise<S['InsightPlan']> =>
  Promise.resolve(mock.mockPlan(findingId));

/** Starts the plan; the mocked answer is the plan done, as the real one ends. */
export const startPlan = (plan: S['InsightPlan']): Promise<S['InsightPlan']> =>
  Promise.resolve({
    ...plan,
    state: 'done',
    results: plan.changes.map((c) => ({ target: c.target, field: c.field, state: 'done' as const })),
    finished_at: new Date().toISOString(),
  });
