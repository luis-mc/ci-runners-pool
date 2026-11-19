// Shared Pool > Images and caches, the PROPOSED section (RES19). One page, four tabs: Overview (what is built and
// building, the disk), Profiles (what the images are made of), Stacks (what the scan found) and Caches. The page's
// one primary is the next step (UX-4); an overview only shows and links (UX-52).
import {
  ActionBar,
  Button,
  Card,
  CardGrid,
  Facts,
  LevelBar,
  LinkButton,
  Message,
  Page,
  PageHeader,
  Progress,
  Section,
  Stack,
  Status,
  Table,
  Tabs,
  Text,
  Cut,
  formatCount,
  formatSize,
  useNow,
  type Column,
} from '@crsp/ui';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Load } from '../common';
import { useGet } from './api';
import { CachesTab } from './Caches';
import type { DiskUse, ImageBuild, ImagesOverview } from './model';
import { ProfilesTab } from './Profiles';
import { RegistryTab } from './Registry';
import { StacksTab } from './Stacks';
import {
  STATE_WORD,
  builtOf,
  durationOf,
  latestPerPair,
  sizeOf,
  stepLine,
  timing,
} from './words';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'stacks', label: 'Stacks' },
  { id: 'caches', label: 'Caches' },
  { id: 'registry', label: 'Registry' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ImagesHome() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const raw = params.get('tab');
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : 'overview';
  const { result, reload } = useGet<ImagesOverview>('/api/v1/image-overview', true);
  const ready = result.state === 'ready' ? result.data : undefined;
  const failed = ready?.builds.find(
    (b) => b.state === 'failed' && latestFailed(ready.builds, b),
  );
  const next = tab === 'registry' ? undefined : nextStep(ready, failed);
  return (
    <Page>
      <PageHeader
        title="Images and caches"
        lead="The job images your machines build, what your repositories need, and the caches that keep jobs fast."
      />
      <Tabs
        label="Images and caches"
        tabs={TABS}
        current={tab}
        onChange={(id) => setParams(id === 'overview' ? {} : { tab: id })}
      />
      <Load result={result} what="images and caches" reload={reload}>
        {(data) => (
          <>
            {tab === 'overview' ? <OverviewTab data={data} /> : null}
            {tab === 'profiles' ? <ProfilesTab data={data} /> : null}
            {tab === 'stacks' ? <StacksTab /> : null}
            {tab === 'caches' ? <CachesTab /> : null}
            {tab === 'registry' ? <RegistryTab /> : null}
          </>
        )}
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
    </Page>
  );
}

/** A failed build counts only when no later build of the same pair has started. */
function latestFailed(all: readonly ImageBuild[], b: ImageBuild): boolean {
  return latestPerPair(all).some((x) => x.id === b.id);
}

/** The one next step of the page and the reason beside it (UX-4, CORE-5). */
function nextStep(
  data: ImagesOverview | undefined,
  failed: ImageBuild | undefined,
): { label: string; reason: string; to: string } | undefined {
  if (!data) return undefined;
  if (failed)
    return {
      label: 'Open the failed build',
      reason: `The ${failed.profile} image on ${failed.machine} did not build. The old image keeps serving.`,
      to: `/pool/images/builds/${failed.id}`,
    };
  if (data.pending_repositories > 0)
    return {
      label: `Review ${data.pending_repositories} new ${data.pending_repositories === 1 ? 'stack' : 'stacks'}`,
      reason: `${data.pending_findings} findings wait for your yes. Nothing changes until you confirm.`,
      to: '/pool/images?tab=stacks',
    };
  return {
    label: 'Add a profile',
    reason: 'Every repository is covered by a profile.',
    to: '/pool/images/profiles/new',
  };
}

// ---------------------------------------------------------------------------------------------- overview

function OverviewTab({ data }: { data: ImagesOverview }) {
  const now = useNow();
  const latest = latestPerPair(data.builds);
  const active = latest.filter((b) => ['building', 'queued', 'failed'].includes(b.state));
  const columns: Column<ImageBuild>[] = [
    {
      id: 'machine',
      header: 'Machine',
      cell: (b) => b.machine,
      sort: (b) => b.machine,
      kind: 'fit',
    },
    {
      id: 'profile',
      header: 'Profile',
      cell: (b) => <Cut>{b.profile}</Cut>,
      title: (b) => b.profile,
      sort: (b) => b.profile,
      kind: 'grow',
    },
    { id: 'arch', header: 'Arch', cell: (b) => b.arch, kind: 'fit' },
    {
      id: 'state',
      header: 'State',
      cell: (b) => <Status {...STATE_WORD[b.state]} />,
      sort: (b) => b.state,
      kind: 'fit',
    },
    {
      id: 'from',
      header: 'From',
      cell: (b) => (b.state === 'not_built' ? '–' : b.origin),
      kind: 'fit',
    },
    { id: 'size', header: 'Size', cell: (b) => sizeOf(b), kind: 'fit' },
    { id: 'built', header: 'Built', cell: (b) => builtOf(b, now), kind: 'fit' },
  ];
  return (
    <Stack>
      {active.length > 0 ? (
        <Section title="Building now" count={active.length}>
          <CardGrid>
            {active.map((b) => (
              <BuildCard key={b.id} build={b} />
            ))}
          </CardGrid>
        </Section>
      ) : null}
      <Section
        title="Images on your machines"
        count={latest.length}
        hint="Each machine builds an image for each profile it serves, once, and keeps it until the profile changes."
      >
        <Table
          caption="Images on your machines"
          columns={columns}
          rows={latest}
          rowKey={(b) => b.id}
          oneLine
          action={{
            label: 'Open',
            to: (b) => `/pool/images/builds/${b.id}`,
            name: (b) => `${b.profile} on ${b.machine}`,
          }}
        />
      </Section>
      <Section title="Disk used by images and caches" count={data.disk.length}>
        <CardGrid>
          {data.disk.map((d) => (
            <DiskCard key={d.machine_id} disk={d} />
          ))}
        </CardGrid>
      </Section>
      <Section title="Ready-made images">
        <Facts
          items={[
            { name: 'Registry', value: data.prebuilt.registry },
            { name: 'Pulled', value: formatCount(data.prebuilt.pulled, 'image') },
            { name: 'Built here', value: formatCount(data.prebuilt.built, 'image') },
          ]}
        />
        <Text tone="muted">
          A machine pulls a ready-made image when the registry has its key, and builds it
          itself when not.
        </Text>
      </Section>
    </Stack>
  );
}

function BuildCard({ build }: { build: ImageBuild }) {
  const now = useNow();
  const word = STATE_WORD[build.state];
  const t = timing(build, now);
  return (
    <Card
      title={`${build.machine}: ${build.profile}`}
      footer={
        <LinkButton
          to={`/pool/images/builds/${build.id}`}
        >{`Open build on ${build.machine}`}</LinkButton>
      }
    >
      <Stack gap="tight">
        <Status {...word} />
        {build.state === 'building' ? (
          <>
            <Progress
              label={`Building ${build.profile} on ${build.machine}`}
              value={t.pct}
              max={100}
            />
            <Text>{stepLine(build)}</Text>
            <Text tone="muted">{`${durationOf(t.ran)} so far, about ${durationOf(t.left)} left`}</Text>
          </>
        ) : null}
        {build.state === 'queued' ? (
          <Text tone="muted">
            Waits for a free build slot on {build.machine}. One build runs at a time.
          </Text>
        ) : null}
        {build.state === 'failed' && build.failure ? (
          <Message tone="problem">{`${build.failure.step}: ${build.failure.why}`}</Message>
        ) : null}
      </Stack>
    </Card>
  );
}

function DiskCard({ disk }: { disk: DiskUse }) {
  const used = disk.images_bytes + disk.caches_bytes;
  return (
    <Card title={disk.machine}>
      <Stack gap="tight">
        <LevelBar
          label="Images and caches"
          value={used}
          max={disk.budget_bytes}
          text={`${formatSize(used)} of ${formatSize(disk.budget_bytes)}`}
        />
        <Facts
          items={[
            { name: 'Images', value: formatSize(disk.images_bytes) },
            { name: 'Caches', value: formatSize(disk.caches_bytes) },
            { name: 'Free on the disk', value: formatSize(disk.free_bytes) },
            {
              name: 'Old images',
              value:
                disk.old_images === 0
                  ? 'none'
                  : `${disk.old_images} wait for the next sweep`,
            },
          ]}
        />
      </Stack>
    </Card>
  );
}
