// The words of the images and caches screen and of its activity strip entry (content.md).
import type { Schemas } from '../../api/api';

const KIND: Record<Schemas['CacheKind'], string> = {
  tool_cache: 'Tool cache',
  rust_cache: 'Rust build cache',
  actions_cache: 'Actions cache',
  git_mirror: 'Git mirror',
  registry_mirror: 'Registry mirror',
};

export const cacheKindLabel = (k: Schemas['CacheKind']): string => KIND[k];

/** The name of one cache: its kind, and the runner it belongs to. */
export function cacheName(c: Pick<Schemas['Cache'], 'kind' | 'runner_name'>): string {
  return c.runner_name
    ? `${cacheKindLabel(c.kind)} of ${c.runner_name}`
    : cacheKindLabel(c.kind);
}

/** The activity strip line of a wiping cache (UX-34): what it wipes and what it waits for. */
export function wipingLabel(c: Schemas['Cache']): string {
  const waits = c.waiting_for ?? [];
  return waits.length > 0
    ? `Wiping ${cacheName(c)}, waiting for ${waits.join(', ')}`
    : `Wiping ${cacheName(c)}`;
}
