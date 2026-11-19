// Registry (RES20): the images in crsp's own container registry, standard and custom. The tab shows the disk against
// two budgets, what the registry would do, and one row per image. The page of one image shows where it came from,
// who uses it and what is in it, and deletes it (a question card names what goes, UX-62). A budgets page edits the
// two limits and the cleanup rules (UX-71).
import {
  ActionBar,
  Breadcrumbs,
  Button,
  Card,
  CardGrid,
  Code,
  Cut,
  EditBar,
  Facts,
  LevelBar,
  LinkButton,
  Message,
  NumberField,
  Page,
  PageHeader,
  Section,
  Segmented,
  Stack,
  Status,
  Table,
  Tag,
  Text,
  TrendChart,
  formatCount,
  formatDate,
  formatDuration,
  formatNumber,
  formatSize,
  useNow,
  type Column,
} from '@crsp/ui';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCommand, useQuestion } from '../../api/hooks';
import { Ask, Load } from '../common';
import { useDeleteFn, useGet, usePostFn } from './api';
import type {
  Budget,
  Recommendation,
  RegistryImage,
  RegistryKind,
  RegistryOverview,
} from './registryModel';
import { GB, imageName, lastPulled, stateOf } from './registryWords';

const REGISTRY_PATH = '/api/v1/registry';

// ---------------------------------------------------------------------------------------------- the tab

/** The next step of the Registry tab: the first recommendation that waits for the owner (UX-4). */
export function registryNext(
  data: RegistryOverview | undefined,
): { label: string; reason: string; to: string } | undefined {
  const first = data?.recommendations.find((r) => r.decides === 'you');
  if (!first) return undefined;
  const label: Record<Recommendation['kind'], string> = {
    replace: 'Review the newer image',
    unused: 'Review the unused image',
    'over budget': 'Review the budget',
    variant: 'Open the variant',
    'dangling layers': 'Open the cleanup',
  };
  return { label: label[first.kind], reason: first.title, to: first.to };
}

export function RegistryTab() {
  const { result, reload } = useGet<RegistryOverview>(REGISTRY_PATH);
  const navigate = useNavigate();
  const next = result.state === 'ready' ? registryNext(result.data) : undefined;
  return (
    <>
      <Load result={result} what="the registry" reload={reload}>
        {(data) => <RegistryBody data={data} />}
      </Load>
      {next ? (
        <ActionBar
          status={next.reason}
          primary={
            <Button kind="primary" onPress={() => void navigate(next.to)}>
              {next.label}
            </Button>
          }
        />
      ) : null}
    </>
  );
}

function RegistryBody({ data }: { data: RegistryOverview }) {
  const now = useNow();
  const [kind, setKind] = useState<RegistryKind | ''>('');
  const shown = data.images.filter((i) => kind === '' || i.kind === kind);
  const standard = data.images.filter((i) => i.kind === 'standard').length;
  const custom = data.images.length - standard;
  const delta = data.pulls_week - data.pulls_prev_week;
  const recCols: Column<Recommendation>[] = [
    {
      id: 'what',
      header: 'Recommendation',
      cell: (r) => <Cut>{r.title}</Cut>,
      title: (r) => `${r.title}. ${r.why}`,
      kind: 'grow',
    },
    {
      id: 'saves',
      header: 'Frees',
      cell: (r) => formatSize(r.saves_bytes),
      kind: 'fit',
    },
    {
      id: 'who',
      header: 'Decided by',
      cell: (r) => <Tag>{r.decides === 'you' ? 'your yes' : `crsp ${r.when ?? ''}`}</Tag>,
      kind: 'fit',
    },
  ];
  const cols: Column<RegistryImage>[] = [
    {
      id: 'profile',
      header: 'Image',
      cell: (i) => <Cut>{i.profile}</Cut>,
      title: (i) => imageName(i),
      sort: (i) => i.profile,
      kind: 'grow',
    },
    { id: 'key', header: 'Key', cell: (i) => <Code>{i.key}</Code>, kind: 'fit' },
    { id: 'kind', header: 'Kind', cell: (i) => i.kind, sort: (i) => i.kind, kind: 'fit' },
    { id: 'arch', header: 'Arch', cell: (i) => i.arch, kind: 'fit' },
    {
      id: 'repos',
      header: 'Repos',
      cell: (i) => formatNumber(i.repositories.length),
      sort: (i) => i.repositories.length,
      kind: 'fit',
    },
    {
      id: 'size',
      header: 'Size',
      cell: (i) => formatSize(i.size_bytes),
      sort: (i) => i.size_bytes,
      kind: 'fit',
    },
    {
      id: 'pulls',
      header: 'Pulls',
      cell: (i) => formatNumber(i.pulls_week),
      sort: (i) => i.pulls_week,
      kind: 'fit',
    },
    {
      id: 'last',
      header: 'Last pulled',
      cell: (i) => lastPulled(i, now),
      kind: 'fit',
    },
    {
      id: 'state',
      header: 'State',
      cell: (i) => <Status {...stateOf(i)} />,
      sort: (i) => i.state,
      kind: 'fit',
    },
  ];
  return (
    <Stack>
      <Section
        title="Disk"
        hint="Standard and custom images have a budget each. Layers two images share are stored once."
      >
        <CardGrid>
          <BudgetCard title="Standard images" budget={data.standard} count={standard} />
          <BudgetCard title="Custom images" budget={data.custom} count={custom} />
          <Card title="Last 7 days">
            <Facts
              items={[
                {
                  name: 'Pulls',
                  value: `${formatNumber(data.pulls_week)} (${delta >= 0 ? 'up' : 'down'} ${formatNumber(Math.abs(delta))} on the week before)`,
                },
                { name: 'Builds avoided', value: formatNumber(data.builds_avoided_week) },
                { name: 'Time saved', value: formatDuration(data.saved_seconds_week) },
              ]}
            />
          </Card>
          <Card
            title="Where it runs"
            footer={
              <LinkButton to="/pool/images/registry/budgets">Edit budgets</LinkButton>
            }
          >
            <Facts
              items={[
                { name: 'Machine', value: `${data.where}, the controller` },
                { name: 'Folder', value: <Code>{data.path}</Code> },
                { name: 'Free on the disk', value: formatSize(data.free_bytes) },
                { name: 'Next cleanup', value: formatDate(data.next_cleanup_at) },
              ]}
            />
          </Card>
        </CardGrid>
      </Section>
      <Section
        title="Recommendations"
        count={data.recommendations.length}
        hint="crsp never deletes what you may still want without your yes."
      >
        <Table
          caption="Recommendations"
          columns={recCols}
          rows={data.recommendations}
          rowKey={(r) => r.id}
          oneLine
          action={{ label: 'Open', to: (r) => r.to, name: (r) => r.title }}
        />
      </Section>
      <Section title="Images in the registry" count={shown.length}>
        <Stack gap="tight">
          <Segmented
            label="Kind"
            value={kind}
            onChange={setKind}
            allLabel="All"
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          <Table
            caption="Images in the registry"
            columns={cols}
            rows={shown}
            rowKey={(i) => i.id}
            oneLine
            action={{
              label: 'Open',
              to: (i) => `/pool/images/registry/${i.id}`,
              name: (i) => `${imageName(i)} ${i.key}`,
            }}
          />
        </Stack>
      </Section>
    </Stack>
  );
}

function BudgetCard({
  title,
  budget,
  count,
}: {
  title: string;
  budget: Budget;
  count: number;
}) {
  const over = budget.used_bytes > budget.budget_bytes;
  return (
    <Card title={title}>
      <Stack gap="tight">
        <LevelBar
          label={title}
          value={budget.used_bytes}
          max={budget.budget_bytes}
          text={`${formatSize(budget.used_bytes)} of ${formatSize(budget.budget_bytes)}${over ? ', over the budget' : ''}`}
        />
        <Facts
          items={[
            { name: 'Images', value: formatNumber(count) },
            { name: 'Shared layers', value: formatSize(budget.shared_bytes) },
          ]}
        />
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------- one image

export function RegistryImagePage() {
  const { id = '' } = useParams();
  const { result, reload } = useGet<RegistryImage>(`${REGISTRY_PATH}/images/${id}`);
  return (
    <Page>
      <Breadcrumbs
        trail={[
          { to: '/pool/images?tab=registry', label: '‹ Registry' },
          { label: 'Image' },
        ]}
      />
      <Load result={result} what="the image" reload={reload}>
        {(img) => <ImageBody image={img} />}
      </Load>
    </Page>
  );
}

interface Related {
  id: string;
  relation: string;
  image: RegistryImage | undefined;
}

function ImageBody({ image }: { image: RegistryImage }) {
  const now = useNow();
  const navigate = useNavigate();
  const del = useDeleteFn();
  const all = useGet<RegistryOverview>(REGISTRY_PATH).result;
  const others = all.state === 'ready' ? all.data.images : [];
  const byId = (id: string | undefined) => others.find((x) => x.id === id);
  const word = stateOf(image);
  const remove = useQuestion(
    async () => {
      await del(`${REGISTRY_PATH}/images/${image.id}`);
    },
    () => void navigate('/pool/images?tab=registry'),
  );
  const lineage: Related[] = [
    ...(image.replaces
      ? [{ id: image.replaces, relation: 'It replaces', image: byId(image.replaces) }]
      : []),
    ...(image.replaced_by
      ? [
          {
            id: image.replaced_by,
            relation: 'Replaced by',
            image: byId(image.replaced_by),
          },
        ]
      : []),
  ];
  const lineageCols: Column<Related>[] = [
    { id: 'rel', header: 'Relation', cell: (r) => r.relation, kind: 'fit' },
    {
      id: 'img',
      header: 'Image',
      cell: (r) => <Cut>{r.image ? imageName(r.image) : r.id}</Cut>,
      kind: 'grow',
    },
    {
      id: 'key',
      header: 'Key',
      cell: (r) => <Code>{r.image?.key ?? '–'}</Code>,
      kind: 'fit',
    },
    {
      id: 'state',
      header: 'State',
      cell: (r) => (r.image ? <Status {...stateOf(r.image)} /> : '–'),
      kind: 'fit',
    },
  ];
  const sharedCols: Column<RegistryImage['shared'][number]>[] = [
    { id: 'n', header: 'Image', cell: (s) => <Cut>{s.name}</Cut>, kind: 'grow' },
    { id: 'k', header: 'Key', cell: (s) => <Code>{s.key}</Code>, kind: 'fit' },
    { id: 's', header: 'Shared', cell: (s) => formatSize(s.shared_bytes), kind: 'fit' },
  ];
  const machineCols: Column<RegistryImage['machines'][number]>[] = [
    { id: 'm', header: 'Machine', cell: (m) => m.machine, kind: 'grow' },
    {
      id: 's',
      header: 'State',
      cell: (m) => (
        <Status
          kind={m.state === 'used now' ? 'running' : 'ok'}
          word={
            m.state === 'used now'
              ? `used now by ${m.runner ?? 'a runner'}`
              : 'holds a copy'
          }
        />
      ),
      kind: 'fit',
    },
    {
      id: 'p',
      header: 'Pulled',
      cell: (m) => formatDate(m.pulled_at),
      kind: 'fit',
    },
  ];
  const week = image.pulls_by_day;
  const peak = Math.max(...week);
  const peakAt = week.indexOf(peak);
  const dayLabel = (n: number) => formatDate(now - (week.length - 1 - n) * 86_400_000);
  const total = week.reduce((a, b) => a + b, 0);
  const inUse = image.machines.some((m) => m.state === 'used now');
  const v = image.vulns;
  return (
    <Stack>
      <PageHeader
        title={image.profile}
        lead={`${image.kind} · ${image.arch} · key ${image.key} · pushed by ${image.pushed_by} on ${formatDate(image.pushed_at)}`}
      />
      <Section title="State">
        <Stack gap="tight">
          <Status {...word} />
          {image.state === 'update found' ? (
            <Message tone="needs-you">
              {`A run of ${image.repositories.join(', ')} needs this newer version. The image it uses now stays until you say yes.`}
            </Message>
          ) : null}
          {image.state === 'superseded' ? (
            <Message tone="note">
              {`A newer image took its place. It is kept until ${image.keep_until ? formatDate(image.keep_until) : 'the rollback days end'} so you can go back, then it is deleted.`}
            </Message>
          ) : null}
          {image.state === 'unused' ? (
            <Message tone="needs-you">
              {`No run has pulled it for ${image.unused_days ?? 0} days. Deleting it frees ${formatSize(image.unique_bytes)}. A run that needs it builds it again.`}
            </Message>
          ) : null}
          {image.state === 'variant' ? (
            <Message tone="note">
              {`Made for the branch ${image.branch ?? ''}, whose stack files differ from main. It is deleted 7 days after the branch is merged or deleted.`}
            </Message>
          ) : null}
          <Facts
            items={[
              { name: 'Size', value: formatSize(image.size_bytes) },
              { name: 'Only this image holds', value: formatSize(image.unique_bytes) },
              { name: 'Repositories', value: image.repositories.join(', ') },
              { name: 'Last pulled', value: lastPulled(image, now) },
              {
                name: 'Pulls',
                value: `${formatNumber(image.pulls_week)} this week, ${formatNumber(image.pulls_total)} in all`,
              },
              {
                name: 'Time saved this week',
                value: formatDuration(image.saved_seconds_week),
              },
            ]}
          />
        </Stack>
      </Section>
      <Section
        title="Where it came from"
        hint="The key is made from the profile, the content of the stack files at the commit, the arch and the base image."
      >
        <Stack gap="tight">
          <Facts
            items={[
              { name: 'Profile', value: image.profile },
              { name: 'Base', value: <Code>{image.base}</Code> },
              {
                name: 'Stack files',
                value:
                  image.stack_files.length === 0
                    ? 'The profile only'
                    : image.stack_files.map((f) => `${f.path} ${f.hash}`).join(', '),
              },
            ]}
          />
          {lineage.length > 0 ? (
            <Table
              caption="Lineage"
              columns={lineageCols}
              rows={lineage}
              rowKey={(r) => r.id}
              oneLine
              action={{
                label: 'Open',
                to: (r) => `/pool/images/registry/${r.id}`,
                name: (r) => `${r.relation} ${r.image?.key ?? r.id}`,
              }}
            />
          ) : (
            <Text tone="muted">
              It does not replace an image and nothing replaced it.
            </Text>
          )}
        </Stack>
      </Section>
      {image.shared.length > 0 ? (
        <Section
          title="Layers shared with other images"
          count={image.shared.length}
          hint="A shared layer is stored once. Deleting this image frees only what no other image holds."
        >
          <Table
            caption="Layers shared with other images"
            columns={sharedCols}
            rows={image.shared}
            rowKey={(s) => s.image_id}
            oneLine
            action={{
              label: 'Open',
              to: (s) => `/pool/images/registry/${s.image_id}`,
              name: (s) => `${s.name} ${s.key}`,
            }}
          />
        </Section>
      ) : null}
      <Section title="Pulls by day" hint="The last 14 days.">
        <Stack gap="tight">
          <TrendChart
            label={`Pulls of ${image.profile} ${image.key} by day`}
            unit="count"
            emptyText="No pulls in the last 14 days."
            series={[
              {
                id: 'pulls',
                label: 'Pulls',
                kind: 'column',
                points: week.map((y, n) => ({
                  x: dayLabel(n),
                  y,
                  note: `${formatCount(y, 'pull')} on ${dayLabel(n)}`,
                })),
              },
            ]}
          />
          <Text tone="muted">
            {total === 0
              ? 'No pulls in the last 14 days.'
              : `${formatCount(total, 'pull')} in 14 days, most on ${dayLabel(peakAt)} (${peak}).`}
          </Text>
        </Stack>
      </Section>
      <Section title="Machines that hold it" count={image.machines.length}>
        {image.machines.length > 0 ? (
          <Table
            caption="Machines that hold it"
            columns={machineCols}
            rows={image.machines}
            rowKey={(m) => m.machine}
            oneLine
          />
        ) : (
          <Text tone="muted">No machine holds a copy. Nothing runs from it.</Text>
        )}
      </Section>
      <Section
        title="What is in it"
        hint="Made by crsp when the registry stored the image. It never blocks a pull."
      >
        <Facts
          items={[
            { name: 'Software', value: `${formatNumber(image.sbom_packages)} packages` },
            {
              name: 'Known vulnerabilities',
              value: `${v.critical} critical, ${v.high} high, ${v.medium} medium, ${v.low} low`,
            },
            { name: 'Signed by crsp', value: image.signed ? 'yes' : 'no' },
          ]}
        />
      </Section>
      <Section
        title="Delete"
        hint="Deleting removes the image from the registry. Machines that hold a copy keep it until their next sweep."
        actions={
          <Button
            onPress={() =>
              remove.ask(
                [
                  `${imageName(image)}, ${image.arch}, key ${image.key}`,
                  `${formatSize(image.unique_bytes)} freed; the layers shared with other images stay`,
                ],
                [],
              )
            }
          >
            Delete
          </Button>
        }
      >
        <Text tone="muted">
          {inUse
            ? 'A runner uses it now. The registry refuses to delete it until that job ends.'
            : `${formatSize(image.unique_bytes)} would be freed.`}
        </Text>
      </Section>
      <Ask
        title={`Delete ${image.profile} ${image.key}?`}
        action="Delete"
        busyLabel="Deleting"
        q={remove.question}
        busy={remove.busy}
        error={remove.error}
        onCancel={remove.cancel}
        onConfirm={() => void remove.confirm()}
      />
      {image.state === 'update found' ? (
        <ActionBar
          status="Nothing changes until you confirm."
          secondary={
            <LinkButton to="/pool/images?tab=registry">Open the registry</LinkButton>
          }
          primary={
            <Button
              kind="primary"
              onPress={() => void navigate(`/pool/images/registry/${image.id}/replace`)}
            >
              Review the replacement
            </Button>
          }
        />
      ) : null}
    </Stack>
  );
}

// ---------------------------------------------------------------------------------------------- budgets

export function RegistryBudgetsPage() {
  const { result, reload } = useGet<RegistryOverview>(REGISTRY_PATH);
  return (
    <Page>
      <Breadcrumbs
        trail={[
          { to: '/pool/images?tab=registry', label: '‹ Registry' },
          { label: 'Budgets' },
        ]}
      />
      <Load result={result} what="the registry" reload={reload}>
        {(data) => <BudgetsBody data={data} reload={reload} />}
      </Load>
    </Page>
  );
}

function BudgetsBody({ data, reload }: { data: RegistryOverview; reload: () => void }) {
  const post = usePostFn();
  const base = {
    standard: Math.round(data.standard.budget_bytes / GB),
    custom: Math.round(data.custom.budget_bytes / GB),
    unused: data.unused_days,
    keep: data.keep_old_days,
  };
  const [draft, setDraft] = useState<Partial<typeof base>>({});
  const v = { ...base, ...draft };
  const changes = (Object.keys(base) as (keyof typeof base)[]).filter(
    (k) => v[k] !== base[k],
  ).length;
  const save = useCommand(async () => {
    await post(
      `${REGISTRY_PATH}/budgets?standard=${v.standard}&custom=${v.custom}&unused=${v.unused}&keep=${v.keep}`,
    );
    setDraft({});
    reload();
  });
  const set = (k: keyof typeof base) => (n: number | undefined) =>
    setDraft((d) => ({ ...d, [k]: n ?? base[k] }));
  return (
    <Stack>
      <PageHeader
        title="Registry budgets"
        lead="How much disk the registry may use, and when crsp suggests a deletion."
      />
      <Section title="Disk used now">
        <CardGrid>
          <BudgetCard
            title="Standard images"
            budget={data.standard}
            count={data.images.filter((i) => i.kind === 'standard').length}
          />
          <BudgetCard
            title="Custom images"
            budget={data.custom}
            count={data.images.filter((i) => i.kind === 'custom').length}
          />
        </CardGrid>
      </Section>
      <Section
        title="Budgets"
        hint="Over a budget, crsp recommends what to delete. It never deletes for this reason without your yes."
      >
        <Stack gap="tight">
          <NumberField
            label="Standard images"
            unit="GB"
            min={5}
            max={2000}
            value={v.standard}
            onChange={set('standard')}
            help="crsp's own profile images."
            changed={v.standard !== base.standard}
          />
          <NumberField
            label="Custom images"
            unit="GB"
            min={5}
            max={2000}
            value={v.custom}
            onChange={set('custom')}
            help="Images made for your repositories, branch variants included."
            changed={v.custom !== base.custom}
          />
        </Stack>
      </Section>
      <Section
        title="Cleanup rules"
        hint="crsp does the first two alone. An unused image and an image over a budget wait for your yes."
      >
        <Stack gap="tight">
          <NumberField
            label="Suggest deleting an image unused for"
            unit="days"
            min={7}
            max={365}
            value={v.unused}
            onChange={set('unused')}
            help="An image no run has pulled for this long shows up in Recommendations."
            changed={v.unused !== base.unused}
          />
          <NumberField
            label="Keep a replaced image for"
            unit="days"
            min={1}
            max={60}
            value={v.keep}
            onChange={set('keep')}
            help="So you can go back. After that crsp deletes it."
            changed={v.keep !== base.keep}
          />
          <Facts
            items={[
              { name: 'Last cleanup', value: formatDate(data.last_cleanup_at) },
              { name: 'Next cleanup', value: formatDate(data.next_cleanup_at) },
              { name: 'Layers no image uses', value: formatSize(data.dangling_bytes) },
            ]}
          />
        </Stack>
      </Section>
      {save.error ? (
        <Message tone="problem">{`Could not save. ${save.error}`}</Message>
      ) : null}
      <EditBar
        changes={changes}
        onSave={() => void save.run()}
        onCancel={() => setDraft({})}
        busy={save.busy}
        submit={false}
      />
    </Stack>
  );
}
