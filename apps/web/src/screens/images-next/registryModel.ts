// The PROPOSED data of the Registry section (RES20). None of this is in the generated contract yet; the shapes are
// the sketch of section 9 of docs/review/RES20/REPORT.md. The review build answers them from fixtures.
import type { Arch } from './model';

export type RegistryKind = 'standard' | 'custom';

/** What an image is to the registry, in the words the user reads (UX-58). */
export type RegistryState =
  'in use' | 'current' | 'update found' | 'superseded' | 'unused' | 'variant';

export interface RegistryMachineUse {
  machine: string;
  /** `holds`: a copy is on the machine. `used now`: a runner runs a job from it. */
  state: 'holds' | 'used now';
  /** The runner and the job that use it now. */
  runner?: string;
  job?: string;
  pulled_at: string;
}

export interface SharedLayers {
  image_id: string;
  name: string;
  key: string;
  shared_bytes: number;
}

export interface VulnCount {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface RegistryImage {
  id: string;
  /** The profile's name; a custom image of a branch adds the branch in `branch`. */
  profile: string;
  profile_id: string;
  kind: RegistryKind;
  arch: Arch;
  /** Short form of profile + stack hash + arch + base digest (report, section 5). */
  key: string;
  stack_hash: string;
  base: string;
  repositories: string[];
  size_bytes: number;
  /** Bytes only this image holds; the rest is shared with other images. */
  unique_bytes: number;
  state: RegistryState;
  /** For `variant`: the branch whose stack files differ. */
  branch?: string;
  /** Days since the last pull, when the state is `unused`. */
  unused_days?: number;
  pushed_at: string;
  pushed_by: string;
  last_pulled_at: string | null;
  pulls_week: number;
  pulls_total: number;
  /** Seconds a pull saved against a local build, summed over the week. */
  saved_seconds_week: number;
  /** Pulls per day for the last 14 days, oldest first. */
  pulls_by_day: number[];
  replaces?: string;
  replaced_by?: string;
  /** For a superseded image: the day it is deleted unless it is rolled back to. */
  keep_until?: string;
  machines: RegistryMachineUse[];
  shared: SharedLayers[];
  sbom_packages: number;
  vulns: VulnCount;
  signed: boolean;
  /** The stack files the key was made from, with a short content hash each. */
  stack_files: { path: string; hash: string }[];
}

export type RecommendationKind =
  'replace' | 'unused' | 'over budget' | 'variant' | 'dangling layers';

export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  /** One line, plain words. */
  title: string;
  why: string;
  saves_bytes: number;
  /** `you`: waits for your yes. `crsp`: crsp does it alone, on `when`. */
  decides: 'you' | 'crsp';
  when?: string;
  /** Where the Open button goes. */
  to: string;
}

export interface Budget {
  used_bytes: number;
  budget_bytes: number;
  shared_bytes: number;
}

export interface RegistryOverview {
  where: string;
  path: string;
  free_bytes: number;
  last_cleanup_at: string;
  next_cleanup_at: string;
  standard: Budget;
  custom: Budget;
  unused_days: number;
  keep_old_days: number;
  images: RegistryImage[];
  recommendations: Recommendation[];
  pulls_week: number;
  pulls_prev_week: number;
  saved_seconds_week: number;
  builds_avoided_week: number;
  dangling_bytes: number;
}

/** One stack file of the compare step: what the old image was made from and what the new one is. */
export interface FileDiff {
  path: string;
  before: string;
  after: string;
}

export interface ReplaceCompare {
  old: RegistryImage;
  next: RegistryImage;
  files: FileDiff[];
  /** Repositories that switch to the new image. */
  switching: string[];
  freed_bytes: number;
}
