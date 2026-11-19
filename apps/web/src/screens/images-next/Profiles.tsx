// Profiles (RES19): what an image is made of. The list is a table (UX-25); the page of one profile shows its layers,
// toolchains with versions, service containers, the repositories that use it, its images per machine and its builds.
import {
  ActionBar,
  Breadcrumbs,
  Button,
  Cut,
  Empty,
  LinkButton,
  Message,
  Page,
  PageHeader,
  Section,
  Stack,
  Status,
  Table,
  Tag,
  Text,
  Code,
  formatSize,
  formatPast,
  useNow,
  type Column,
} from '@crsp/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { Load } from '../common';
import { useGet } from './api';
import type {
  ImageBuild,
  ImagesOverview,
  LayerRef,
  Profile,
  ServiceSpec,
  Toolchain,
} from './model';
import {
  STATE_WORD,
  builtOf,
  durationOf,
  latestPerPair,
  readyLine,
  serviceLine,
  sizeOf,
  toolLine,
} from './words';

export function ProfilesTab({ data }: { data: ImagesOverview }) {
  const columns: Column<Profile>[] = [
    {
      id: 'name',
      header: 'Profile',
      cell: (p) => <Cut>{p.name}</Cut>,
      title: (p) => p.name,
      sort: (p) => p.name,
      kind: 'grow',
    },
    { id: 'kind', header: 'Kind', cell: (p) => <Tag>{p.kind}</Tag>, kind: 'fit' },
    {
      id: 'tools',
      header: 'Toolchains',
      cell: (p) => <Cut>{toolLine(p)}</Cut>,
      title: toolLine,
      kind: 'grow',
    },
    { id: 'services', header: 'Services', cell: (p) => serviceLine(p), kind: 'fit' },
    {
      id: 'repos',
      header: 'Repositories',
      cell: (p) => String(p.repositories.length),
      sort: (p) => p.repositories.length,
      kind: 'fit',
    },
    {
      id: 'ready',
      header: 'Images',
      cell: (p) => (
        <Status
          kind={p.stale_because ? 'waiting' : 'ok'}
          word={p.stale_because ? 'out of date' : readyLine(p, data.builds)}
        />
      ),
      kind: 'fit',
    },
  ];
  return (
    <Section
      title="Profiles"
      count={data.profiles.length}
      hint="A profile is one kind of job image: a base, layers, toolchain versions and the service containers its jobs use."
    >
      {data.profiles.length === 0 ? (
        <Empty
          title="No profiles yet. Scan a repository and crsp suggests one."
          action={<LinkButton to="/pool/images/profiles/new">Add a profile</LinkButton>}
        />
      ) : (
        <Table
          caption="Profiles"
          columns={columns}
          rows={data.profiles}
          rowKey={(p) => p.id}
          oneLine
          action={{
            label: 'Open',
            to: (p) => `/pool/images/profiles/${p.id}`,
            name: (p) => p.name,
          }}
        />
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------- one profile

interface ProfileAnswer {
  profile: Profile;
  builds: ImageBuild[];
}

export function ProfilePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { result, reload } = useGet<ProfileAnswer>(`/api/v1/image-profiles/${id}`, true);
  return (
    <Page>
      <Breadcrumbs
        trail={[
          { to: '/pool/images?tab=profiles', label: '‹ Profiles' },
          { label: 'Profile' },
        ]}
      />
      <Load result={result} what="the profile" reload={reload}>
        {({ profile, builds }) => (
          <Stack>
            <PageHeader title={profile.name} lead={profile.purpose} />
            {profile.stale_because ? (
              <Message tone="needs-you">
                {`${profile.stale_because} Machines keep the old image until you rebuild; running jobs are never cut.`}
              </Message>
            ) : null}
            <ProfileBody profile={profile} builds={builds} />
            <ActionBar
              status={
                profile.kind === 'automatic'
                  ? 'Made from the scan. Editing it makes it custom.'
                  : 'A custom profile. The scan only suggests changes.'
              }
              primary={
                <Button
                  kind="primary"
                  onPress={() =>
                    void navigate(`/pool/images/profiles/${profile.id}/edit`)
                  }
                >
                  Edit profile
                </Button>
              }
            />
          </Stack>
        )}
      </Load>
    </Page>
  );
}

function ProfileBody({ profile, builds }: ProfileAnswer) {
  const now = useNow();
  const layerCols: Column<LayerRef>[] = [
    { id: 'name', header: 'Layer', cell: (l) => l.name, kind: 'fit' },
    {
      id: 'adds',
      header: 'Adds',
      cell: (l) => <Cut>{l.adds}</Cut>,
      title: (l) => l.adds,
      kind: 'grow',
    },
    {
      id: 'size',
      header: 'Size',
      cell: (l) => formatSize(l.size_mb * 1024 * 1024),
      kind: 'fit',
    },
    {
      id: 'state',
      header: 'State',
      cell: (l) =>
        l.state === 'on' ? (
          <Status kind="ok" word="in the image" />
        ) : (
          <Status kind="waiting" word="suggested" />
        ),
      kind: 'fit',
    },
  ];
  const toolCols: Column<Toolchain>[] = [
    { id: 'tool', header: 'Tool', cell: (t) => t.tool, sort: (t) => t.tool, kind: 'fit' },
    { id: 'version', header: 'Version', cell: (t) => t.version, kind: 'fit' },
    { id: 'layer', header: 'Comes from', cell: (t) => t.layer, kind: 'fit' },
    {
      id: 'file',
      header: 'Read from',
      cell: (t) => <Code>{t.found_in}</Code>,
      title: (t) => t.found_in,
      kind: 'grow',
    },
  ];
  const serviceCols: Column<ServiceSpec>[] = [
    { id: 'name', header: 'Name', cell: (s) => s.name, kind: 'fit' },
    { id: 'image', header: 'Image', cell: (s) => <Code>{s.image}</Code>, kind: 'fit' },
    { id: 'life', header: 'Runs', cell: (s) => s.lifetime, kind: 'fit' },
    {
      id: 'role',
      header: 'What it is for',
      cell: (s) => <Cut>{s.role}</Cut>,
      title: (s) => s.role,
      kind: 'grow',
    },
  ];
  const repoCols: Column<string>[] = [
    { id: 'repo', header: 'Repository', cell: (r) => r, kind: 'grow' },
    {
      id: 'labels',
      header: 'Chosen by labels',
      cell: () => profile.labels.join(', '),
      kind: 'fit',
    },
  ];
  const images = latestPerPair(builds);
  const imageCols: Column<ImageBuild>[] = [
    { id: 'machine', header: 'Machine', cell: (b) => b.machine, kind: 'grow' },
    { id: 'arch', header: 'Arch', cell: (b) => b.arch, kind: 'fit' },
    {
      id: 'state',
      header: 'State',
      cell: (b) => <Status {...STATE_WORD[b.state]} />,
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
  const history = [...builds]
    .filter((b) => b.started_at && b.state !== 'not_built' && b.state !== 'queued')
    .sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''));
  const histCols: Column<ImageBuild>[] = [
    {
      id: 'when',
      header: 'Started',
      cell: (b) => (b.started_at ? formatPast(b.started_at, now) : '–'),
      kind: 'fit',
    },
    { id: 'machine', header: 'Machine', cell: (b) => b.machine, kind: 'grow' },
    { id: 'why', header: 'Why', cell: (b) => b.reason, kind: 'fit' },
    {
      id: 'result',
      header: 'Result',
      cell: (b) => <Status {...STATE_WORD[b.state === 'stale' ? 'ready' : b.state]} />,
      kind: 'fit',
    },
    {
      id: 'took',
      header: 'Took',
      cell: (b) =>
        b.started_at && b.finished_at
          ? durationOf((Date.parse(b.finished_at) - Date.parse(b.started_at)) / 1000)
          : '–',
      kind: 'fit',
    },
  ];
  return (
    <Stack>
      <Section
        title="Images"
        count={images.length}
        hint={`The key of this profile is ${profile.key}. A change to a layer or a pin makes a new key and a new image.`}
      >
        <Table
          caption="Images of this profile"
          columns={imageCols}
          rows={images}
          rowKey={(b) => b.id}
          oneLine
          action={{
            label: 'Open',
            to: (b) => `/pool/images/builds/${b.id}`,
            name: (b) => `${b.profile} on ${b.machine}`,
          }}
        />
      </Section>
      <Section
        title="Layers"
        count={profile.layers.length}
        hint={`Base: ${profile.base}. The basics are always in it.`}
      >
        <Table
          caption="Layers"
          columns={layerCols}
          rows={profile.layers}
          rowKey={(l) => l.id}
          oneLine
        />
      </Section>
      <Section title="Toolchains" count={profile.toolchains.length}>
        <Table
          caption="Toolchains"
          columns={toolCols}
          rows={profile.toolchains}
          rowKey={(t) => t.tool}
          oneLine
        />
      </Section>
      <Section
        title="Service containers"
        count={profile.services.length}
        hint="Containers a job needs next to the runner, like a database. A compose group keeps them up with the runner."
      >
        {profile.services.length === 0 ? (
          <Text tone="muted">
            None. Jobs of this profile need no database or other service.
          </Text>
        ) : (
          <Table
            caption="Service containers"
            columns={serviceCols}
            rows={profile.services}
            rowKey={(s) => s.name}
            oneLine
          />
        )}
      </Section>
      <Section
        title="Repositories"
        count={profile.repositories.length}
        hint="Repositories opt in to the pool; crsp picks the profile from their scan and their runs-on labels."
      >
        <Table
          caption="Repositories of this profile"
          columns={repoCols}
          rows={profile.repositories}
          rowKey={(r) => r}
          oneLine
          action={{
            label: 'Open',
            to: (r) => `/pool/images/stacks/${r}`,
            name: (r) => r,
          }}
        />
      </Section>
      <Section title="Build history" count={history.length}>
        <Table
          caption="Build history"
          columns={histCols}
          rows={history}
          rowKey={(b) => b.id}
          oneLine
          action={{
            label: 'Open',
            to: (b) => `/pool/images/builds/${b.id}`,
            name: (b) => `${b.profile} on ${b.machine}`,
          }}
        />
      </Section>
    </Stack>
  );
}
