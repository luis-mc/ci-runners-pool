// The words of the Registry section (RES20). Every one of them is listed in the proposal for content.md
// (docs/design-system/next-version/content.md, "Registry words").
import { formatPast, type StatusKind } from '@crsp/ui';
import type { RegistryImage, RegistryState } from './registryModel';

export function stateOf(i: RegistryImage): { kind: StatusKind; word: string } {
  const table: Record<RegistryState, { kind: StatusKind; word: string }> = {
    'in use': { kind: 'ok', word: 'in use' },
    current: { kind: 'ok', word: 'current' },
    'update found': { kind: 'waiting', word: 'newer one found' },
    superseded: { kind: 'off', word: 'superseded' },
    unused: { kind: 'waiting', word: `unused ${i.unused_days ?? 0} days` },
    variant: { kind: 'off', word: `variant of ${i.branch ?? 'a branch'}` },
  };
  return table[i.state];
}

export const lastPulled = (i: RegistryImage, now: number): string =>
  i.last_pulled_at ? formatPast(i.last_pulled_at, now) : 'never';

/** "Python and uv, variant of rust-wasm": what a list calls an image when the profile's name is not enough. */
export const imageName = (i: RegistryImage): string =>
  `${i.profile}${i.state === 'variant' && i.branch ? `, variant of ${i.branch}` : ''}`;

/** Decimal, as `formatSize` writes sizes, so a budget and the size shown beside it agree. */
export const GB = 1e9;
