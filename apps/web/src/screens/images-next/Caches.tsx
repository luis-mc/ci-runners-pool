// Caches (RES19): one row per tool with size, quota, hit rate and what it saved. The page of one cache shows the
// size per machine, how its key is made, when it is evicted, and has the quota and Wipe (a question card names
// what goes, UX-62).
import {
  Breadcrumbs,
  Button,
  Card,
  CardGrid,
  Cut,
  EditBar,
  Facts,
  LevelBar,
  Message,
  NumberField,
  Page,
  PageHeader,
  Section,
  Stack,
  Status,
  Table,
  Tag,
  Text,
  formatNumber,
  formatPast,
  formatPercent,
  formatSize,
  useNow,
  type Column,
} from '@crsp/ui';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCommand, useQuestion } from '../../api/hooks';
import { Ask, Load } from '../common';
import { useGet, usePostFn } from './api';
import type { ToolCache } from './model';
import { durationOf } from './words';

const GB = 1024 ** 3;

const stateOf = (c: ToolCache): Parameters<typeof Status>[0] =>
  c.size_bytes === 0
    ? { kind: 'off', word: 'empty' }
    : c.size_bytes > c.quota_bytes
      ? { kind: 'failed', word: 'over its quota' }
      : c.size_bytes > c.quota_bytes * 0.9
        ? { kind: 'waiting', word: 'near its quota' }
        : { kind: 'ok', word: 'within its quota' };

export function CachesTab() {
  const { result, reload } = useGet<{ items: ToolCache[] }>('/api/v1/cache-tools');
  return (
    <Load result={result} what="the caches" reload={reload}>
      {({ items }) => {
        const hits = items.reduce((n, c) => n + c.hits, 0);
        const misses = items.reduce((n, c) => n + c.misses, 0);
        const saved = items.reduce((n, c) => n + c.saved_seconds_week, 0);
        const size = items.reduce((n, c) => n + c.size_bytes, 0);
        const over = items.filter((c) => c.size_bytes > c.quota_bytes);
        const cols: Column<ToolCache>[] = [
          {
            id: 'tool',
            header: 'Cache',
            cell: (c) => c.tool,
            sort: (c) => c.tool,
            kind: 'fit',
          },
          {
            id: 'holds',
            header: 'Holds',
            cell: (c) => <Cut>{c.holds}</Cut>,
            title: (c) => c.holds,
            kind: 'grow',
          },
          { id: 'scope', header: 'Kept', cell: (c) => <Tag>{c.scope}</Tag>, kind: 'fit' },
          {
            id: 'size',
            header: 'Size',
            cell: (c) => formatSize(c.size_bytes),
            sort: (c) => c.size_bytes,
            kind: 'fit',
          },
          {
            id: 'quota',
            header: 'Quota',
            cell: (c) => formatSize(c.quota_bytes),
            kind: 'fit',
          },
          {
            id: 'hit',
            header: 'Hit rate',
            cell: (c) => (c.hits + c.misses === 0 ? '–' : formatPercent(c.hit_rate_pct)),
            sort: (c) => c.hit_rate_pct,
            kind: 'fit',
          },
          {
            id: 'state',
            header: 'State',
            cell: (c) => <Status {...stateOf(c)} />,
            kind: 'fit',
          },
        ];
        return (
          <Stack>
            {over.length > 0 ? (
              <Message tone="needs-you">
                {`${over.map((c) => c.tool).join(', ')} ${over.length === 1 ? 'is' : 'are'} over ${over.length === 1 ? 'its' : 'their'} quota. The oldest entries go after the next job; no running job is cut.`}
              </Message>
            ) : null}
            <CardGrid>
              <Card title="Hit rate this week">
                <Facts
                  items={[
                    {
                      name: 'Hit rate',
                      value: formatPercent((hits / Math.max(1, hits + misses)) * 100),
                    },
                    { name: 'Hits', value: formatNumber(hits) },
                    { name: 'Misses', value: formatNumber(misses) },
                  ]}
                />
              </Card>
              <Card title="Time saved this week">
                <Facts
                  items={[
                    { name: 'Saved', value: durationOf(saved) },
                    { name: 'Per job', value: 'about 3 min 10 s' },
                  ]}
                />
              </Card>
              <Card title="Disk used by caches">
                <Facts
                  items={[
                    { name: 'Total', value: formatSize(size) },
                    { name: 'Caches', value: String(items.length) },
                    { name: 'Over quota', value: String(over.length) },
                  ]}
                />
              </Card>
            </CardGrid>
            <Section
              title="Caches by tool"
              count={items.length}
              hint="A quota is a cap per cache. crsp removes the oldest entries between jobs, never during one."
            >
              <Table
                caption="Caches by tool"
                columns={cols}
                rows={items}
                rowKey={(c) => c.id}
                oneLine
                action={{
                  label: 'Open',
                  to: (c) => `/pool/images/caches/${c.id}`,
                  name: (c) => c.tool,
                }}
              />
            </Section>
          </Stack>
        );
      }}
    </Load>
  );
}

// ---------------------------------------------------------------------------------------------- one cache

export function CachePage() {
  const { id = '' } = useParams();
  const { result, reload } = useGet<{ items: ToolCache[] }>('/api/v1/cache-tools');
  return (
    <Page>
      <Breadcrumbs
        trail={[{ to: '/pool/images?tab=caches', label: '‹ Caches' }, { label: 'Cache' }]}
      />
      <Load result={result} what="the cache" reload={reload}>
        {({ items }) => {
          const c = items.find((x) => x.id === id);
          return c ? (
            <CacheBody cache={c} reload={reload} />
          ) : (
            <Message tone="problem">No such cache.</Message>
          );
        }}
      </Load>
    </Page>
  );
}

function CacheBody({ cache, reload }: { cache: ToolCache; reload: () => void }) {
  const now = useNow();
  const post = usePostFn();
  const [quota, setQuota] = useState<number | undefined>(undefined);
  const quotaGb = quota ?? Math.round(cache.quota_bytes / GB);
  const changes = quotaGb !== Math.round(cache.quota_bytes / GB) ? 1 : 0;
  const wipe = useQuestion(async () => {
    await post(`/api/v1/cache-tools/${cache.id}/wipe`);
  }, reload);
  const save = useCommand(async () => {
    await post(`/api/v1/cache-tools/${cache.id}/quota`);
    setQuota(undefined);
    reload();
  });
  const machineCols: Column<{ machine: string; size_bytes: number }>[] = [
    { id: 'machine', header: 'Machine', cell: (m) => m.machine, kind: 'grow' },
    { id: 'size', header: 'Size', cell: (m) => formatSize(m.size_bytes), kind: 'fit' },
  ];
  return (
    <Stack>
      <PageHeader title={cache.tool} lead={cache.holds} />
      <Section title="Size">
        <Stack gap="tight">
          <LevelBar
            label="Size"
            value={cache.size_bytes}
            max={cache.quota_bytes}
            text={`${formatSize(cache.size_bytes)} of ${formatSize(cache.quota_bytes)}${cache.size_bytes > cache.quota_bytes ? ', over the quota' : ''}`}
          />
          <Facts
            items={[
              { name: 'Entries', value: formatNumber(cache.entries) },
              {
                name: 'Hit rate',
                value:
                  cache.hits + cache.misses === 0
                    ? 'no jobs yet'
                    : `${formatPercent(cache.hit_rate_pct)} (${formatNumber(cache.hits)} hits, ${formatNumber(cache.misses)} misses)`,
              },
              { name: 'Saved this week', value: durationOf(cache.saved_seconds_week) },
              {
                name: 'Last used',
                value:
                  cache.entries === 0 ? 'never' : formatPast(cache.last_used_at, now),
              },
              { name: 'Kept', value: cache.scope },
            ]}
          />
        </Stack>
      </Section>
      {cache.per_machine.length > 0 ? (
        <Section title="On each machine" count={cache.per_machine.length}>
          <Table
            caption="Size on each machine"
            columns={machineCols}
            rows={cache.per_machine}
            rowKey={(m) => m.machine}
            oneLine
          />
        </Section>
      ) : null}
      <Section title="How it works">
        <Facts
          items={[
            { name: 'Key', value: cache.key_rule },
            { name: 'Eviction', value: cache.eviction },
          ]}
        />
        <Text tone="muted">
          A new key never replaces an old entry. The old one leaves when the eviction rule
          says so.
        </Text>
      </Section>
      <Section title="Quota">
        <NumberField
          label="Quota"
          unit="GB"
          min={1}
          max={500}
          value={quotaGb}
          onChange={setQuota}
          help="The most this cache may hold on each machine. It is checked after each job."
          changed={changes > 0}
        />
      </Section>
      <Section
        title="Wipe"
        hint="Wiping empties the cache. Running jobs that use it finish first. The next jobs fill it again and run slower once."
        actions={
          <Button
            onPress={() =>
              wipe.ask(
                [
                  `${cache.tool}, ${formatSize(cache.size_bytes)}, ${formatNumber(cache.entries)} entries`,
                ],
                [],
              )
            }
            disabled={cache.size_bytes === 0}
            reason="It is empty."
          >
            Wipe
          </Button>
        }
      >
        <Text tone="muted">
          {cache.size_bytes === 0
            ? 'Nothing is in this cache.'
            : `${formatSize(cache.size_bytes)} would be freed.`}
        </Text>
      </Section>
      <Ask
        title={`Wipe ${cache.tool}?`}
        action="Wipe"
        busyLabel="Wiping"
        q={wipe.question}
        busy={wipe.busy}
        error={wipe.error}
        onCancel={wipe.cancel}
        onConfirm={() => void wipe.confirm()}
      />
      <EditBar
        changes={changes}
        onSave={() => void save.run()}
        onCancel={() => setQuota(undefined)}
        busy={save.busy}
        submit={false}
      />
    </Stack>
  );
}
