// The words of the Images and caches section (RES19). Every one of them is listed in the proposal for content.md
// (docs/design-system/next-version/content.md, "Images and caches, second round").
import { formatDuration, formatPast, formatSize, type StatusKind } from '@crsp/ui';
import type { BuildState, ImageBuild, Profile } from './model';

export const STATE_WORD: Record<BuildState, { kind: StatusKind; word: string }> = {
  ready: { kind: 'ok', word: 'ready' },
  building: { kind: 'running', word: 'building' },
  queued: { kind: 'waiting', word: 'waits to build' },
  failed: { kind: 'failed', word: 'build failed' },
  stale: { kind: 'waiting', word: 'out of date' },
  not_built: { kind: 'off', word: 'not built yet' },
};

/** The one line that says how far a build is: "step 4 of 6, Browsers layer". */
export function stepLine(b: ImageBuild): string {
  const i = b.steps.findIndex((s) => s.state === 'running');
  if (i < 0) return b.steps.length > 0 ? `${b.steps.length} steps` : 'Not started';
  return `Step ${i + 1} of ${b.steps.length}, ${b.steps[i]?.name ?? ''}`;
}

/** Seconds a running build has run and the time left, from the typical time of earlier builds. */
export function timing(
  b: ImageBuild,
  now: number,
): { ran: number; left: number; pct: number } {
  const started = b.started_at ? Date.parse(b.started_at) : now;
  const ran = Math.max(0, Math.round((now - started) / 1000));
  const left = Math.max(60, b.typical_seconds - ran);
  const pct = Math.min(95, Math.round((ran / Math.max(1, b.typical_seconds)) * 100));
  return { ran, left, pct };
}

export function sizeOf(b: ImageBuild): string {
  return b.size_mb ? formatSize(b.size_mb * 1024 * 1024) : '–';
}

export function builtOf(b: ImageBuild, now: number): string {
  if (b.state === 'building') return 'now';
  return b.finished_at ? formatPast(b.finished_at, now) : '–';
}

export const durationOf = (seconds: number): string => formatDuration(seconds);

/** The newest build of each profile and machine: what a machine has now. */
export function latestPerPair(builds: readonly ImageBuild[]): ImageBuild[] {
  const seen = new Map<string, ImageBuild>();
  for (const b of builds) {
    const key = `${b.machine_id}/${b.profile_id}`;
    const old = seen.get(key);
    const at = (x: ImageBuild) =>
      Date.parse(x.started_at ?? '') || Number.MAX_SAFE_INTEGER;
    if (!old || at(b) >= at(old)) seen.set(key, b);
  }
  return [...seen.values()];
}

/** "Ready on 3 of 3 machines" for a profile. */
export function readyLine(p: Profile, builds: readonly ImageBuild[]): string {
  const mine = latestPerPair(builds.filter((b) => b.profile_id === p.id));
  const ready = mine.filter((b) => b.state === 'ready').length;
  return `${ready} of ${mine.length} ready`;
}

export const toolLine = (p: Profile): string =>
  p.toolchains.map((t) => `${t.tool} ${t.version}`).join(', ');

export const serviceLine = (p: Profile): string =>
  p.services.length === 0 ? 'none' : p.services.map((s) => s.image).join(', ');
