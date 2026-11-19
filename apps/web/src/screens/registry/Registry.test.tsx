// REG5 (R5.37 to R5.40): the Registry tab and the image page read the real API, say could not load when it does not
// answer, and delete only from the image page behind a question card (UX-62).
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { apiError, machine, renderApp, signedIn } from '../../testing/mock';
import type { Schemas } from '../../api/api';
import { stateOf } from './words';

afterEach(cleanup);

const GB = 1e9;
type Summary = Schemas['RegistryImageSummary'];

const img = (over: Partial<Summary> = {}): Summary => ({
  id: 'img_a',
  kind: 'standard',
  name: 'crsp/std/go',
  key: 'b7e204a1c9d3',
  profile: 'Go and Node',
  arch: 'arm64',
  state: 'current',
  manifest_digest: 'sha256:aa',
  size_bytes: 3.4 * GB,
  unique_bytes: 1 * GB,
  pulls_7_days: 4,
  scan_state: 'not_scanned',
  pushed_at: '2026-11-10T09:00:00Z',
  ...over,
});

const overview = (
  over: Partial<Schemas['RegistryOverview']> = {},
): Schemas['RegistryOverview'] => ({
  where: { host: 'ctl:5443', folder: '/srv/registry', read_only: false, running: true },
  budgets: [
    {
      kind: 'standard',
      limit_bytes: 20 * GB,
      used_bytes: 8 * GB,
      shared_bytes: 0,
      over: false,
    },
    {
      kind: 'custom',
      limit_bytes: 10 * GB,
      used_bytes: 12 * GB,
      shared_bytes: 0,
      over: true,
    },
  ],
  last_7_days: { pulls: 9, builds_avoided: 6, saved_seconds: 5400, bytes_pulled: 1 },
  recommendations: [
    {
      id: 'r1',
      rule: 'replace',
      image_id: 'img_b',
      kind: 'custom',
      frees_bytes: 2 * GB,
      decider: 'owner',
      created_at: '2026-11-18T09:00:00Z',
    },
  ],
  images: { standard: 1, custom: 1 },
  in_flight: { builds: 0, pulls: 0, pushes: 0 },
  ...over,
});

const detail = (
  s: Summary,
  over: Partial<Schemas['RegistryImage']> = {},
): Schemas['RegistryImage'] => ({
  ...s,
  lineage: [],
  layers: [],
  pulls_by_day: Array.from({ length: 14 }, (_, n) => ({
    day: `2026-11-${String(6 + n).padStart(2, '0')}`,
    pulls: n % 3,
  })),
  machines: [],
  pointers: [],
  scan: { state: 'not_scanned' },
  ...over,
});

const api = (
  images: Summary[] = [
    img(),
    img({ id: 'img_b', kind: 'custom', profile: 'Node web', update_found: true }),
  ],
) =>
  signedIn()
    .on('GET', '/api/v1/machines', { items: [machine()] })
    .on('GET', '/api/v1/images', { items: [] })
    .on('GET', '/api/v1/registry/overview', overview())
    .on('GET', '/api/v1/registry/images', { items: images });

describe('words', () => {
  it('names the state of an image in the approved words', () => {
    expect(stateOf({ state: 'current' }).word).toBe('current');
    expect(stateOf({ state: 'current', update_found: true }).word).toBe(
      'newer one found',
    );
    expect(stateOf({ state: 'variant', branch: 'rust-wasm' }).word).toBe(
      'variant of rust-wasm',
    );
    expect(stateOf({ state: 'current' }, { unusedDays: 70 }).word).toBe('unused 70 days');
    expect(stateOf({ state: 'current' }, { inUse: true }).word).toBe('in use');
  });
});

describe('Registry tab', () => {
  it('shows the budgets, the recommendations and one row per image, with one primary', async () => {
    renderApp(api(), '/pool/images?tab=registry');
    expect((await screen.findAllByText('Images in the registry')).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText('Standard images').length).toBeGreaterThan(0);
    expect(screen.getByText(/12\.0 GB of 10\.0 GB, over the budget/)).toBeTruthy();
    expect(screen.getAllByText('Recommendations').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Go and Node').length).toBeGreaterThan(0);
    expect(screen.getAllByText('newer one found').length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: 'Review the newer image' }),
    ).toHaveLength(1);
    expect(screen.queryAllByText('Add runners')).toHaveLength(0);
    expect(screen.queryAllByText(/^Delete/)).toHaveLength(0);
  });

  it('says could not load when the registry answers 501', async () => {
    renderApp(
      api().on('GET', '/api/v1/registry/overview', () =>
        apiError(501, 'not_implemented', 'Not built yet.'),
      ),
      '/pool/images?tab=registry',
    );
    expect(await screen.findByText(/Could not load the registry\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('says when the registry is not running', async () => {
    renderApp(
      api().on(
        'GET',
        '/api/v1/registry/overview',
        overview({
          where: {
            host: 'ctl:5443',
            folder: '/srv/registry',
            read_only: false,
            running: false,
            why_not: 'The folder is full.',
          },
        }),
      ),
      '/pool/images?tab=registry',
    );
    expect(
      await screen.findByText(/The registry is not running\. The folder is full\./),
    ).toBeTruthy();
  });

  it('says so when the registry holds no image', async () => {
    renderApp(
      api([]).on(
        'GET',
        '/api/v1/registry/overview',
        overview({ recommendations: [], images: { standard: 0, custom: 0 } }),
      ),
      '/pool/images?tab=registry',
    );
    expect(await screen.findByText(/No images yet\./)).toBeTruthy();
  });
});

describe('Image page', () => {
  it('asks first, names what goes, and deletes after the yes (UX-62)', async () => {
    const calls: string[] = [];
    renderApp(
      api()
        .on('GET', '/api/v1/registry/images/:id', detail(img()))
        .on('DELETE', '/api/v1/registry/images/:id', (c) => {
          calls.push(c.query?.get('confirm') ?? 'none');
          return c.query?.get('confirm') === 'true'
            ? detail(img())
            : apiError(409, 'needs_confirmation', 'Name what goes.', [
                { kind: 'image', id: 'img_a', text: '1.0 GB freed' },
              ]);
        }),
      '/pool/images/registry/img_a',
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('1.0 GB freed')).toBeTruthy();
    expect(calls).toEqual(['none']);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1)!);
    await waitFor(() => expect(calls).toEqual(['none', 'true']));
  });

  it('refuses to delete an image a runner uses: the card stays open and names the job (UX-73)', async () => {
    renderApp(
      api()
        .on(
          'GET',
          '/api/v1/registry/images/:id',
          detail(img(), {
            machines: [
              {
                machine_id: 'm1',
                machine_name: 'build-1',
                holds: true,
                in_use_by_runner: true,
              },
            ],
          }),
        )
        .on('DELETE', '/api/v1/registry/images/:id', () =>
          apiError(409, 'conflict', 'A runner uses this image.', [
            { kind: 'job', id: '8133', text: 'job 8133 of octo/app' },
          ]),
        ),
      '/pool/images/registry/img_a',
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText(/job 8133 of octo\/app/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1)!);
    expect(await screen.findByText(/Problem: A runner uses this image\./)).toBeTruthy();
    expect(screen.getAllByText(/job 8133 of octo\/app/).length).toBeGreaterThan(0);
  });

  it('says not scanned yet', async () => {
    renderApp(
      api().on('GET', '/api/v1/registry/images/:id', detail(img())),
      '/pool/images/registry/img_a',
    );
    expect(await screen.findByText(/Not scanned yet\./)).toBeTruthy();
  });
});
