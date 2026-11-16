// Images and caches (web-console 4.7, R5.25): what each machine keeps, and the questions before a rebuild or a
// wipe (R5.30). Images arrive with milestone 2; the caches of milestone 1 are the per-runner tool and Rust
// build caches.
import {
  Button,
  Card,
  CardGrid,
  CheckRow,
  Empty,
  Facts,
  LevelBar,
  LinkButton,
  Message,
  Page,
  PageHeader,
  Pane,
  Progress,
  Section,
  Stack,
  Status,
  ListToolbar,
  SearchBar,
  Tabs,
  Text,
  formatDateTime,
  formatNumber,
  formatPast,
  formatPercent,
  formatSize,
  useNow,
} from '@crsp/ui';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, unwrap, useClient, type Schemas } from '../../api/api';
import { useCommand, useLoad, useQuestion } from '../../api/hooks';
import { useSession } from '../../auth/session';
import { useLiveStore, useVersion } from '../../live/LiveProvider';
import { TIMING } from '../../timing';
import { Ask, Load } from '../common';
import { cacheName, wipingLabel } from './labels';

type Cache = Schemas['Cache'];
type Image = Schemas['Image'];

const TABS = [
  { id: 'images', label: 'Images' },
  { id: 'caches', label: 'Caches' },
] as const;

export function ImagesAndCaches() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'caches' ? 'caches' : 'images';
  const client = useClient();
  const mv = useVersion('machines');
  const { result: machines } = useLoad(
    () => unwrap(client.GET('/api/v1/machines')),
    [mv],
  );
  const names = useMemo(() => {
    const out = new Map<string, string>();
    if (machines.state === 'ready')
      for (const m of machines.data.items) out.set(m.id, m.name);
    return out;
  }, [machines]);
  const nameOf = (id: string) => names.get(id) ?? id;

  return (
    <Page>
      <PageHeader
        title="Images and caches"
        lead="What each machine keeps, and what you can rebuild or wipe."
      />
      <Tabs
        label="Images and caches"
        tabs={TABS}
        current={tab}
        onChange={(id) => setParams(id === 'caches' ? { tab: 'caches' } : {})}
      />
      {tab === 'images' ? <ImagesTab nameOf={nameOf} /> : <CachesTab nameOf={nameOf} />}
    </Page>
  );
}

/** What a 409 `needs_confirmation` names: what goes, and the jobs the drain waits for (UX-62). */
function split(e: ApiError): { goes: string[]; waits: string[] } {
  const text = (d: { text?: string; id?: string }) => d.text ?? d.id ?? '';
  return {
    goes: e.details
      .filter((d) => d.kind !== 'job')
      .map(text)
      .filter(Boolean),
    waits: e.details
      .filter((d) => d.kind === 'job')
      .map(text)
      .filter(Boolean),
  };
}

/** Ask the server what a step touches (it answers 409 without `confirm`), then open the question card. */
function useAskFirst(opts: {
  probe: () => Promise<unknown>;
  commit: () => Promise<unknown>;
  fallback: () => string[];
  onDone: () => void;
}) {
  const ask = useQuestion(opts.commit, opts.onDone);
  const probe = useCommand(async () => {
    try {
      await opts.probe();
      opts.onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'needs_confirmation') {
        const { goes, waits } = split(e);
        ask.ask(goes.length > 0 ? goes : opts.fallback(), waits);
        return;
      }
      throw e;
    }
  });
  return { ask, probe };
}

// ---------------------------------------------------------------------------------------------- images

function ImagesTab({ nameOf }: { nameOf: (id: string) => string }) {
  const client = useClient();
  const session = useSession();
  const v = useVersion('images');
  const { result, reload } = useLoad(() => unwrap(client.GET('/api/v1/images')), [v]);
  const [q, setQ] = useState('');
  const shownImages = (items: Image[]) =>
    items.filter((i) =>
      nameOf(i.machine_id).toLowerCase().includes(q.trim().toLowerCase()),
    );
  return (
    <Load result={result} what="images" reload={reload}>
      {(data) =>
        data.items.length === 0 ? (
          <Section title="Images" count={0}>
            <Empty
              title="No images yet. Images are built when a runner first needs one."
              action={
                session.can('admin') ? (
                  <LinkButton to="/runners/add">Add runners</LinkButton>
                ) : undefined
              }
            />
          </Section>
        ) : (
          <Section title="Images" count={shownImages(data.items).length}>
            <Stack>
              <ListToolbar
                label="Images"
                search={<SearchBar value={q} onChange={setQ} label="Search images" />}
                count={`${shownImages(data.items).length} ${shownImages(data.items).length === 1 ? 'image' : 'images'}`}
              />
              <CardGrid>
                {shownImages(data.items).map((img) => (
                  <ImageCard
                    key={img.id}
                    image={img}
                    machine={nameOf(img.machine_id)}
                    onChanged={reload}
                  />
                ))}
              </CardGrid>
            </Stack>
          </Section>
        )
      }
    </Load>
  );
}

function ImageCard({
  image,
  machine,
  onChanged,
}: {
  image: Image;
  machine: string;
  onChanged: () => void;
}) {
  const client = useClient();
  const session = useSession();
  const admin = session.can('admin');
  const why = session.whyNot('admin');
  const saved = useMemo(
    () => image.layers.filter((l) => l.enabled).map((l) => l.id),
    [image.layers],
  );
  const [draft, setDraft] = useState<string[] | undefined>(undefined);
  const enabled = draft ?? saved;
  const dirty =
    draft !== undefined && [...draft].sort().join() !== [...saved].sort().join();
  const rebuilding = image.state === 'rebuilding';

  const save = useCommand(async () => {
    await unwrap(
      client.PUT('/api/v1/images/{imageId}/layers', {
        params: { path: { imageId: image.id } },
        body: { enabled_layers: enabled },
      }),
    );
    setDraft(undefined);
    onChanged();
  });
  const { ask, probe } = useAskFirst({
    probe: () =>
      unwrap(
        client.POST('/api/v1/images/{imageId}/rebuild', {
          params: { path: { imageId: image.id } },
        }),
      ),
    commit: () =>
      unwrap(
        client.POST('/api/v1/images/{imageId}/rebuild', {
          params: { path: { imageId: image.id }, query: { confirm: true } },
        }),
      ),
    fallback: () => [`Image of ${machine}, ${image.os}`],
    onDone: onChanged,
  });

  const title = `${machine}, ${image.os}`;
  return (
    <Card
      title={title}
      footer={
        <Stack gap="tight">
          <Button
            onPress={() => void save.run()}
            busy={save.busy}
            busyLabel="Saving"
            disabled={!admin || !dirty}
            reason={!admin ? why : 'Change a layer to save.'}
          >
            Save
          </Button>
          <Button
            onPress={() => void probe.run()}
            busy={probe.busy || rebuilding}
            busyLabel={rebuilding ? 'Rebuilding' : 'Working'}
            disabled={!admin}
            reason={why}
          >
            Rebuild
          </Button>
        </Stack>
      }
    >
      <Stack gap="tight">
        <Status
          kind={
            image.state === 'ready'
              ? 'ok'
              : image.state === 'failed'
                ? 'failed'
                : 'running'
          }
          word={image.state}
        />
        <Facts
          items={[
            { name: 'Base', value: image.base },
            { name: 'Size', value: formatSize(image.size_bytes) },
            {
              name: 'Built at',
              value: image.built_at ? formatDateTime(image.built_at) : 'not built yet',
            },
            { name: 'Newest', value: image.newest ? 'yes' : 'no' },
          ]}
        />
        {image.layers.map((l) => (
          <CheckRow
            key={l.id}
            label={l.name}
            help={formatSize(l.size_bytes)}
            checked={enabled.includes(l.id)}
            onChange={(c) =>
              setDraft(c ? [...enabled, l.id] : enabled.filter((x) => x !== l.id))
            }
            {...(!admin || rebuilding
              ? { disabledReason: !admin ? why : 'The image is being rebuilt.' }
              : {})}
          />
        ))}
        {rebuilding ? <Progress label={`Rebuilding ${title}`} /> : null}
        {image.needs_rebuild && !rebuilding ? (
          <Message tone="note">
            The saved layers differ from the built image. Rebuild to use them.
          </Message>
        ) : null}
        {image.state === 'failed' && image.error ? (
          <Message tone="problem">
            Could not rebuild. {image.error} The old image keeps serving.
          </Message>
        ) : null}
        {save.error ? (
          <Message tone="problem">Could not save the layers. {save.error}</Message>
        ) : null}
        {probe.error ? (
          <Message tone="problem">Could not rebuild. {probe.error}</Message>
        ) : null}
      </Stack>
      <Ask
        title={`Rebuild the image of ${title}?`}
        action="Rebuild"
        busyLabel="Rebuilding"
        q={ask.question}
        busy={ask.busy}
        error={ask.error}
        onCancel={ask.cancel}
        onConfirm={() => void ask.confirm()}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------- caches

function CachesTab({ nameOf }: { nameOf: (id: string) => string }) {
  const client = useClient();
  const session = useSession();
  const live = useLiveStore();
  const v = useVersion('caches');
  const { result, reload } = useLoad(() => unwrap(client.GET('/api/v1/caches')), [v]);
  const items = result.state === 'ready' ? result.data.items : undefined;
  const anyWiping = items?.some((c) => c.state === 'wiping') ?? false;
  const [q, setQ] = useState('');

  // The strip and the list read the server's state (UX-19); a wipe in progress is asked again until it ends.
  useEffect(() => {
    for (const c of items ?? []) live.trackCache(c);
  }, [items, live]);
  useEffect(() => {
    if (!anyWiping) return;
    const t = setInterval(reload, TIMING.cachePollMs);
    return () => clearInterval(t);
  }, [anyWiping, reload]);

  return (
    <Load result={result} what="caches" reload={reload}>
      {(data) => {
        if (data.items.length === 0)
          return (
            <Section title="Caches" count={0}>
              <Empty
                title="No caches yet. Caches show here when a runner has been added."
                action={
                  session.can('admin') ? (
                    <LinkButton to="/runners/add">Add runners</LinkButton>
                  ) : undefined
                }
              />
            </Section>
          );
        const byMachine = new Map<string, Cache[]>();
        const found = data.items.filter((c) =>
          `${cacheName(c)} ${nameOf(c.machine_id)}`
            .toLowerCase()
            .includes(q.trim().toLowerCase()),
        );
        for (const c of found)
          byMachine.set(c.machine_id, [...(byMachine.get(c.machine_id) ?? []), c]);
        return (
          <Section title="Caches" count={found.length}>
            <Stack>
              <ListToolbar
                label="Caches"
                search={<SearchBar value={q} onChange={setQ} label="Search caches" />}
                count={`${found.length} ${found.length === 1 ? 'cache' : 'caches'}`}
              />
              {[...byMachine.entries()].map(([machineId, rows]) => (
                <Pane key={machineId} title={nameOf(machineId)} level={3}>
                  <CardGrid>
                    {rows.map((c) => (
                      <CacheCard key={c.id} cache={c} onChanged={reload} />
                    ))}
                  </CardGrid>
                </Pane>
              ))}
            </Stack>
          </Section>
        );
      }}
    </Load>
  );
}

function CacheCard({ cache, onChanged }: { cache: Cache; onChanged: () => void }) {
  const client = useClient();
  const session = useSession();
  const live = useLiveStore();
  const now = useNow();
  const admin = session.can('admin');
  const why = session.whyNot('admin');
  const wiping = cache.state === 'wiping';
  const name = cacheName(cache);

  const { ask, probe } = useAskFirst({
    probe: async () => {
      live.trackCache(
        await unwrap(
          client.POST('/api/v1/caches/{cacheId}/wipe', {
            params: { path: { cacheId: cache.id } },
          }),
        ),
      );
    },
    commit: async () => {
      live.trackCache(
        await unwrap(
          client.POST('/api/v1/caches/{cacheId}/wipe', {
            params: { path: { cacheId: cache.id }, query: { confirm: true } },
          }),
        ),
      );
    },
    fallback: () => [`${name}, ${formatSize(cache.size_bytes)}`],
    onDone: onChanged,
  });

  const cap = cache.cap_bytes;
  const waits = cache.waiting_for ?? [];
  return (
    <Card
      title={name}
      footer={
        <Button
          onPress={() => void probe.run()}
          busy={probe.busy || wiping}
          busyLabel={wiping ? 'Wiping' : 'Working'}
          disabled={!admin}
          reason={why}
        >
          Wipe
        </Button>
      }
    >
      <Stack gap="tight">
        {wiping ? <Status kind="running" word="wiping" /> : null}
        {cap !== undefined && cap > 0 ? (
          <LevelBar
            label="Size"
            value={cache.size_bytes}
            max={cap}
            text={`${formatSize(cache.size_bytes)} of ${formatSize(cap)} (${formatPercent((cache.size_bytes / cap) * 100)})${cache.size_bytes > cap ? ', over the cap' : ''}`}
          />
        ) : (
          <Text>{formatSize(cache.size_bytes)}, no cap</Text>
        )}
        <Facts
          items={[
            ...(cache.entry_count !== undefined
              ? [{ name: 'Entries', value: formatNumber(cache.entry_count) }]
              : []),
            {
              name: 'Last wiped',
              value: cache.last_wiped_at ? formatPast(cache.last_wiped_at, now) : 'never',
            },
          ]}
        />
        {wiping ? (
          <>
            <Progress label={wipingLabel(cache)} />
            <Text tone="muted">
              {waits.length > 0
                ? `Waiting for ${waits.join(', ')}.`
                : 'Wiping. No running job uses it.'}
            </Text>
          </>
        ) : null}
        {!wiping && cache.error ? (
          <Message tone="problem">
            Could not wipe {name}. {cache.error}
          </Message>
        ) : null}
        {probe.error ? (
          <Message tone="problem">
            Could not wipe {name}. {probe.error}
          </Message>
        ) : null}
      </Stack>
      <Ask
        title={`Wipe ${name}?`}
        action="Wipe"
        busyLabel="Wiping"
        q={ask.question}
        busy={ask.busy}
        error={ask.error}
        onCancel={ask.cancel}
        onConfirm={() => void ask.confirm()}
      />
    </Card>
  );
}
