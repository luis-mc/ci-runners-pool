// The data model of the Jobs section (RES15 review build): Run -> Job -> Step, in the wire shape the proposed
// endpoints answer. A Job extends the contract's Job, so the shell and the overview read the same rows.
import type { Schemas } from '../../api/api';

export type WaitReason = Schemas['WaitReason'];
export type JobResult = Schemas['JobResult'];
export type JobState = Schemas['Job']['state'];

/** Where a forecast came from: the job key, else its workflow, else its repository, else nothing (5 samples needed). */
export type ForecastBasis = 'job_key' | 'workflow' | 'repository' | 'not_enough_history';

/** A forecast in seconds: the median and a range (p25 to p90, at least 10 percent either way). */
export interface Forecast {
  p50: number;
  lo: number;
  hi: number;
  /** The quartiles, for a run's ETA range (sum of p25 to sum of p75 along the critical path). */
  p25?: number;
  p75?: number;
  basis: ForecastBasis;
  samples: number;
  /** The machine class the sample is from, when the same-machine sample was used. */
  machine?: string;
  /** The median of the last 10 moved by more than a quarter against the 20 before; the last 10 are used. */
  changed_lately?: boolean;
}

export interface StepItem {
  number: number;
  name: string;
  state: 'queued' | 'running' | 'done' | 'skipped';
  result?: 'success' | 'failure' | 'cancelled' | 'skipped';
  started_at?: string;
  completed_at?: string;
  run_seconds?: number;
  forecast?: Forecast;
}

export type RunnerKind = 'persistent' | 'ephemeral';
export type JobType = 'light' | 'standard' | 'heavy';

export interface RunnerRef {
  id: string;
  name: string;
  kind: RunnerKind;
  machine_id: string;
  machine_name: string;
  backend: string;
  isolation: Schemas['Isolation'];
  cache: 'warm' | 'cold';
}

/** An ETA in seconds from now: when a queued job starts, or when a run ends. */
export interface Eta {
  p50: number;
  lo: number;
  hi: number;
}

type ContractJob = Schemas['Job'];

export interface JobItem extends ContractJob {
  /** repo + workflow + job name + matrix values; the same job of another run has the same key. */
  jobKey: string;
  /** The id of the job inside its run: job name plus matrix values. Edges use it. */
  node_id: string;
  matrix: string[];
  branch: string;
  pull_request?: number;
  /** The worktree or task id, only when the job reported it. */
  worktree?: string;
  job_type: JobType;
  /** node_id of the jobs this one needs. */
  needs: string[];
  runner?: RunnerRef;
  /** Seconds the clean-up after the job took. */
  cleanup_seconds?: number;
  /** 1-based place in the queue, queued jobs only. */
  queue_position?: number;
  queue_eta?: Eta;
  forecast: Forecast;
  /** Present on the detail answer, and on a run's jobs. */
  steps?: StepItem[];
  /** A job that calls a reusable workflow: its own jobs are only known when the run starts. */
  reusable?: boolean;
}

export interface HistoryPoint {
  at: string;
  seconds: number;
  result: JobResult;
  branch: string;
  machine?: string;
}

export interface AttemptRef {
  attempt: number;
  job_id: number;
  result?: JobResult;
  state: JobState;
}

export interface JobDetail extends JobItem {
  steps: StepItem[];
  /** The last 30 durations of this job key, oldest first. */
  history: HistoryPoint[];
  attempts: AttemptRef[];
  /** Where the forecast of the whole run stands, when the job is part of an open run. */
  run_eta?: Eta;
}

export interface RunItem {
  id: number;
  attempt: number;
  attempts: number[];
  repository: string;
  workflow: string;
  branch: string;
  head_sha: string;
  pull_request?: number;
  worktree?: string;
  trigger: string;
  html_url: string;
  state: JobState;
  created_at: string;
  jobs: JobItem[];
  /** [a, b]: b needs a. Node ids. */
  edges: [string, string][];
  /** Node ids on the critical path. */
  critical_path: string[];
  eta?: Eta;
  /**
   * Where the edges come from: the workflow file at the commit (read once per commit, cached), or, when the file
   * could not be read, only the overlap of the jobs in time (then `edges` is empty).
   */
  graph?: { source: 'workflow_file' | 'timing'; sha: string };
}

export interface RunPageData {
  items: RunItem[];
  next_cursor?: string;
  total: number;
  stale: Schemas['Staleness'];
}

export interface JobPage {
  items: JobItem[];
  next_cursor?: string;
  total: number;
  stale: Schemas['Staleness'];
}

export interface DayStat {
  day: string;
  jobs: number;
  wait_p50: number;
  wait_p90: number;
  run_p50: number;
  run_p90: number;
}
export interface HourStat {
  weekday: number;
  hour: number;
  count: number;
}
export interface ForecastPoint {
  job_id: number;
  forecast_seconds: number;
  actual_seconds: number;
  lo: number;
  hi: number;
  note: string;
}
export interface JobStats {
  days: DayStat[];
  hours: HourStat[];
  forecast_points: ForecastPoint[];
}

export interface ForecastAnswer {
  jobKey: string;
  forecast: Forecast;
  steps: { name: string; forecast: Forecast }[];
  history: HistoryPoint[];
}

/** The job key: the same job in two runs has the same key (repository, workflow, job name, matrix values). */
export function makeJobKey(
  repository: string,
  workflow: string,
  jobName: string,
  matrix: readonly string[],
): string {
  return [
    repository,
    workflow,
    jobName,
    ...(matrix.length ? [`[${matrix.join(', ')}]`] : []),
  ].join(' / ');
}

/** The job name as shown: "test [ubuntu, 22]" for a matrix job (the name already holds the values). */
export function jobTitle(j: Pick<JobItem, 'job_name'>): string {
  return j.job_name;
}
