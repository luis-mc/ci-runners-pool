// The PROPOSED data of the Images and caches section (RES19). None of this is in the generated contract yet; the
// shapes are the sketch of section 6 and 7 of docs/review/RES19/REPORT.md. The review build answers them from
// fixtures; the production console does not read this folder.

/** One image of a profile on one machine. The words are the ones the user reads (UX-58). */
export type BuildState =
  'not_built' | 'queued' | 'building' | 'ready' | 'failed' | 'stale';

export type Arch = 'x64' | 'arm64';

/** Why a build started: it is shown in the history so a build never looks like it came from nowhere. */
export type BuildReason =
  | 'first runner'
  | 'layers changed'
  | 'pin updated'
  | 'base updated'
  | 'asked by you'
  | 'stack changed';

/** Where the image came from: built on the machine, or pulled ready-made from a registry. */
export type Origin = 'built here' | 'pulled';

export interface LayerRef {
  id: string;
  name: string;
  /** What it adds, one short line. */
  adds: string;
  size_mb: number;
  /** `on`: part of the image. `suggested`: the scan found a need, the user has not confirmed it. */
  state: 'on' | 'suggested';
}

export interface Toolchain {
  tool: string;
  version: string;
  /** Where the version was read from, for example `.nvmrc` or `go.mod`. */
  found_in: string;
  layer: string;
}

export interface ServiceSpec {
  name: string;
  image: string;
  /** What it is for, in plain words. */
  role: string;
  /** Starts with the job (a service container) or stays up with the runner (a compose group). */
  lifetime: 'per job' | 'with the runner';
}

export interface Profile {
  id: string;
  name: string;
  /** `automatic`: made from the scan, kept in step with it. `custom`: the user edits it. */
  kind: 'automatic' | 'custom';
  purpose: string;
  base: string;
  arches: Arch[];
  layers: LayerRef[];
  toolchains: Toolchain[];
  services: ServiceSpec[];
  /** The `runs-on` labels and job types that choose this profile. */
  labels: string[];
  repositories: string[];
  /** The key of the image: base, layers, pins, in the words of runners R5.33. */
  key: string;
  /** What changed since the key was made, when it is stale. */
  stale_because?: string;
}

export interface BuildStep {
  name: string;
  state: 'done' | 'running' | 'waiting' | 'failed' | 'skipped';
  seconds?: number;
  note?: string;
}

export interface ImageBuild {
  id: string;
  profile_id: string;
  profile: string;
  machine_id: string;
  machine: string;
  arch: Arch;
  key: string;
  state: BuildState;
  origin: Origin;
  reason: BuildReason;
  started_at?: string;
  finished_at?: string;
  /** Typical run time of this profile on this machine, from earlier builds; the time left is read from it. */
  typical_seconds: number;
  steps: BuildStep[];
  size_mb?: number;
  /** Plain words for a failed build: what failed and the next step. The raw error stays in the log. */
  failure?: { step: string; kind: string; why: string; next: string };
  /** The old image of this machine keeps serving while this one builds or when it fails. */
  previous_image?: string;
  log: string[];
}

/** What the scan found in a repository. */
export type FindingKind =
  | 'language'
  | 'package manager'
  | 'toolchain'
  | 'service'
  | 'browser'
  | 'build tool'
  | 'container';

export interface Finding {
  id: string;
  kind: FindingKind;
  name: string;
  version?: string;
  /** The file it was read from, with the line when it is one setting. */
  file: string;
  /** What crsp does with it. */
  becomes: string;
  /** `covered`: the profile already has it. `new`: crsp would add it. `conflict`: two files disagree. */
  state: 'covered' | 'new' | 'conflict';
  note?: string;
}

export interface RepoScan {
  repository: string;
  scanned_at: string;
  commit: string;
  files_read: number;
  workflows: number;
  profile_id: string;
  profile: string;
  /** `needs_you`: there are new findings to confirm. `confirmed`: the user said yes. `scanning`, `failed`. */
  state: 'needs_you' | 'confirmed' | 'scanning' | 'failed';
  failure?: string;
  findings: Finding[];
}

export interface PoolStackRow {
  kind: FindingKind;
  name: string;
  versions: string[];
  repositories: string[];
  becomes: string;
  state: 'covered' | 'new' | 'conflict';
}

export interface StackSummary {
  scans: RepoScan[];
  rows: PoolStackRow[];
}

/** A cache per tool: size, quota, hit rate. */
export interface ToolCache {
  id: string;
  tool: string;
  /** What it holds, in plain words. */
  holds: string;
  scope: 'per machine' | 'per runner' | 'pool-wide';
  size_bytes: number;
  quota_bytes: number;
  entries: number;
  hit_rate_pct: number;
  hits: number;
  misses: number;
  saved_seconds_week: number;
  last_used_at: string;
  key_rule: string;
  /** Eviction rule in one phrase. */
  eviction: string;
  per_machine: { machine: string; size_bytes: number }[];
  state: 'ok' | 'over' | 'clearing';
}

export interface DiskUse {
  machine_id: string;
  machine: string;
  total_bytes: number;
  images_bytes: number;
  caches_bytes: number;
  /** What the owner lets images and caches use on this machine (machines `cache_cap_bytes`). */
  budget_bytes: number;
  free_bytes: number;
  /** Images pruned: how many old images wait for the next sweep. */
  old_images: number;
}

export interface ImagesOverview {
  profiles: Profile[];
  builds: ImageBuild[];
  disk: DiskUse[];
  pending_findings: number;
  pending_repositories: number;
  prebuilt: { registry: string; enabled: boolean; pulled: number; built: number };
}
