// Add or edit a profile, and confirm what a scan found (RES19). One wizard for all three: Choose, Review, Building,
// Done (UX-5, UX-30). The shared Wizard part owns the step, the locks, Stop and the busy state (UX-54); this page
// passes data only. Nothing changes before Review is accepted ("Nothing has changed yet.").
import {
  CheckRow,
  Facts,
  Message,
  Page,
  PageHeader,
  Section,
  Stack,
  Status,
  Table,
  Text,
  TextField,
  Wizard,
  Breadcrumbs,
  formatSize,
  type Column,
} from '@crsp/ui';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMachines } from '../../api/machines';
import { Load } from '../common';
import { useGet } from './api';
import type { ImageBuild, LayerRef, Profile, RepoScan } from './model';
import { PhasePicker, stepOfPhase, usePhase, useRunClock } from './PhaseKit';

type Mode = 'new' | 'edit' | 'scan';

const STEPS = ['Choose', 'Review', 'Building', 'Done'] as const;

interface ProfileAnswer {
  profile: Profile;
  builds: ImageBuild[];
}

export function ProfileWizardPage({ mode }: { mode: Mode }) {
  const { id = '', owner = '', name = '' } = useParams();
  const repo = `${owner}/${name}`;
  const catalog = useGet<{ items: LayerRef[] }>('/api/v1/image-layers');
  const profile = useGet<ProfileAnswer>(`/api/v1/image-profiles/${id || 'none'}`);
  const scan = useGet<RepoScan>(
    `/api/v1/stack-scans/${encodeURIComponent(repo || 'none')}`,
  );
  const title =
    mode === 'new'
      ? 'Add a profile'
      : mode === 'edit'
        ? 'Edit profile'
        : `Confirm findings of ${repo}`;
  return (
    <Page>
      <Breadcrumbs
        trail={[
          { to: '/pool/images?tab=profiles', label: '‹ Profiles' },
          {
            label: mode === 'new' ? 'New profile' : mode === 'edit' ? 'Edit' : 'Confirm',
          },
        ]}
      />
      <PageHeader
        title={title}
        lead="Choose what the image holds. crsp builds it on each machine, once, and keeps the old image until the new one is ready."
      />
      <Load result={catalog.result} what="the layers" reload={catalog.reload}>
        {(cat) =>
          mode === 'edit' ? (
            <Load result={profile.result} what="the profile" reload={profile.reload}>
              {(p) => <WizardBody mode={mode} layers={cat.items} profile={p.profile} />}
            </Load>
          ) : mode === 'scan' ? (
            <Load result={scan.result} what="the scan" reload={scan.reload}>
              {(s) => <WizardBody mode={mode} layers={cat.items} scan={s} />}
            </Load>
          ) : (
            <WizardBody mode={mode} layers={cat.items} />
          )
        }
      </Load>
    </Page>
  );
}

function WizardBody({
  mode,
  layers,
  profile,
  scan,
}: {
  mode: Mode;
  layers: LayerRef[];
  profile?: Profile;
  scan?: RepoScan;
}) {
  const navigate = useNavigate();
  const [phase, setPhase] = usePhase(mode === 'new' ? 'first-run' : 'first-run');
  const machines = useMachines();
  const suggested = useMemo(
    () =>
      new Set(
        layers
          .filter((l) =>
            scan?.findings.some((f) => f.state === 'new' && f.becomes.includes(l.name)),
          )
          .map((l) => l.id),
      ),
    [layers, scan],
  );
  const [name, setName] = useState(
    profile?.name ?? (scan ? `${scan.repository.split('/')[1] ?? ''} stack` : ''),
  );
  const [on, setOn] = useState<Set<string>>(
    new Set([
      ...(profile?.layers.filter((l) => l.state === 'on').map((l) => l.id) ?? ['base']),
      ...suggested,
    ]),
  );
  const [services, setServices] = useState<Set<string>>(
    new Set(
      profile?.services.map((s) => s.image) ??
        scan?.findings
          .filter((f) => f.kind === 'service')
          .map((f) => `${f.name.toLowerCase()}:${f.version ?? 'latest'}`) ??
        [],
    ),
  );
  const serviceChoices = useMemo(() => {
    const own = profile?.services.map((s) => s.image) ?? [];
    const found =
      scan?.findings
        .filter((f) => f.kind === 'service')
        .map((f) => `${f.name.toLowerCase()}:${f.version ?? 'latest'}`) ?? [];
    return [...new Set([...own, ...found])];
  }, [profile, scan]);
  const rows =
    machines.result.state === 'ready'
      ? machines.result.data.items.filter((m) =>
          m.backends.some((b) => b.name === 'docker' && b.usable),
        )
      : [];
  const [picked, setPicked] = useState<Set<string> | undefined>(undefined);
  const chosen = picked ?? new Set(rows.map((m) => m.id));
  const total = Math.max(1, chosen.size);
  const unit = useRunClock(phase === 'running', total, () => setPhase('done'));

  const toggle = <T,>(set: Set<T>, v: T, put: (s: Set<T>) => void) => {
    const n = new Set(set);
    if (!n.delete(v)) n.add(v);
    put(n);
  };
  const sizeMb = layers.filter((l) => on.has(l.id)).reduce((n, l) => n + l.size_mb, 0);
  const nameOk = name.trim().length > 0;

  const current = stepOfPhase(phase);
  const runningText =
    phase === 'running' || phase === 'paused'
      ? {
          text: `Building image ${unit} of ${total}, about ${Math.max(1, (total - unit + 1) * 14)} min left`,
          value: unit - 1,
          max: total,
        }
      : undefined;

  return (
    <Stack>
      <Wizard
        name="Profile"
        steps={STEPS}
        current={current}
        phase={phase}
        reading={phase === 'loading' ? 'Reading the layers' : undefined}
        progress={runningText}
        canStop
        onStop={() => setPhase('stopped')}
        onBack={
          current > 0
            ? () => setPhase(current === 1 ? 'first-run' : 'ready-to-review')
            : undefined
        }
        onStep={(i) => setPhase(i === 0 ? 'first-run' : 'ready-to-review')}
        firstStep={0}
        failedAt={2}
        review={phase === 'ready-to-review'}
        stateNote={
          phase === 'paused'
            ? 'Paused. The build went on without this page. Press Stop to end it.'
            : phase === 'done-after-reload'
              ? 'This page was reloaded. The images below are what was built.'
              : phase === 'planning'
                ? 'Planning the builds.'
                : undefined
        }
        primary={
          current === 0
            ? {
                label: 'Review',
                onPress: () => setPhase('ready-to-review'),
                disabled: !nameOk || on.size === 0,
                reason: !nameOk ? 'Name the profile.' : 'Choose at least one layer.',
              }
            : {
                label: `Build ${total} ${total === 1 ? 'image' : 'images'}`,
                busyLabel: 'Building',
                onPress: () => setPhase('running'),
              }
        }
        donePrimary={{
          label: 'Open the profile',
          onPress: () => void navigate(`/pool/images/profiles/${profile?.id ?? 'p_py'}`),
        }}
        onStartAgain={() => setPhase('first-run')}
        onTryAgain={() => setPhase('running')}
      >
        {current === 0 ? (
          <Stack>
            {scan ? (
              <Message tone="note" dismissible={false}>
                {`Found in ${scan.repository}: ${scan.findings
                  .filter((f) => f.state !== 'covered')
                  .map((f) => `${f.name}${f.version ? ` ${f.version}` : ''}`)
                  .join(', ')}. They are ticked below.`}
              </Message>
            ) : null}
            <TextField
              label="Profile name"
              help="Shown in lists and on the runners that use it."
              value={name}
              onChange={setName}
              width="medium"
              {...(name !== (profile?.name ?? '') && profile ? { changed: true } : {})}
            />
            <Section
              title="Layers"
              count={layers.length}
              hint="The basics are always in. Add what your jobs need."
            >
              {layers.map((l) => (
                <CheckRow
                  key={l.id}
                  stacked
                  label={l.name}
                  help={l.adds}
                  checked={on.has(l.id)}
                  disabledReason={
                    l.id === 'base' ? 'The basics are always included.' : undefined
                  }
                  onChange={() => toggle(on, l.id, setOn)}
                  aside={
                    suggested.has(l.id)
                      ? 'found in the scan'
                      : formatSize(l.size_mb * 1024 * 1024)
                  }
                  asideTone={
                    suggested.has(l.id) && !on.has(l.id) ? 'needs-you' : undefined
                  }
                />
              ))}
            </Section>
            {serviceChoices.length > 0 ? (
              <Section
                title="Service containers"
                hint="Started next to the runner for each job, like a database."
              >
                {serviceChoices.map((s) => (
                  <CheckRow
                    key={s}
                    label={s}
                    checked={services.has(s)}
                    onChange={() => toggle(services, s, setServices)}
                  />
                ))}
              </Section>
            ) : null}
            <Section
              title="Build on"
              count={rows.length}
              hint="Machines that can run container jobs. Each builds once and keeps the image."
            >
              {rows.map((m) => (
                <CheckRow
                  key={m.id}
                  label={m.name}
                  help={`${m.os}, ${m.arch}`}
                  checked={chosen.has(m.id)}
                  onChange={() => toggle(chosen, m.id, setPicked)}
                />
              ))}
            </Section>
          </Stack>
        ) : null}
        {current === 1 ? (
          <Stack>
            <Facts
              items={[
                { name: 'Profile', value: name },
                {
                  name: 'Layers',
                  value: layers
                    .filter((l) => on.has(l.id))
                    .map((l) => l.name)
                    .join(', '),
                },
                { name: 'Service containers', value: [...services].join(', ') || 'none' },
                {
                  name: 'Images to build',
                  value: `${total}, one on each chosen machine`,
                },
                { name: 'Size of each', value: formatSize(sizeMb * 1024 * 1024) },
                { name: 'Time', value: 'about 14 min each, one at a time on a machine' },
              ]}
            />
            <Text tone="muted">
              Old images keep serving jobs until the new one is ready. Running jobs are
              never cut.
            </Text>
          </Stack>
        ) : null}
        {current === 2 ? (
          <BuildTable
            names={rows.filter((m) => chosen.has(m.id)).map((m) => m.name)}
            unit={unit}
            phase={phase}
          />
        ) : null}
        {current === 3 ? (
          <Stack>
            <Message tone="done">{`Built ${total} ${total === 1 ? 'image' : 'images'} of ${name || 'the profile'}. Runners of this profile start from them now.`}</Message>
            <Facts
              items={[
                { name: 'Built here', value: String(Math.max(0, total - 1)) },
                { name: 'Pulled ready-made', value: '1' },
                { name: 'Took', value: '41 min' },
              ]}
            />
          </Stack>
        ) : null}
      </Wizard>
      <PhasePicker phase={phase} onChange={setPhase} />
    </Stack>
  );
}

function BuildTable({
  names,
  unit,
  phase,
}: {
  names: string[];
  unit: number;
  phase: string;
}) {
  interface Row {
    machine: string;
    state: Parameters<typeof Status>[0];
    detail: string;
  }
  const rows: Row[] = (
    names.length > 0 ? names : ['Build box', 'Studio PC', 'Pi lab']
  ).map((m, i) => {
    const done = i < unit - 1 || (phase === 'stopped' && i < unit - 1);
    const now = i === unit - 1;
    if (phase === 'failed' && now)
      return {
        machine: m,
        state: { kind: 'failed', word: 'failed' },
        detail: 'The LLVM download did not match its pin.',
      };
    if (phase === 'stopped' && !done)
      return {
        machine: m,
        state: { kind: 'off', word: 'not started' },
        detail: 'Stopped before it began.',
      };
    if (done)
      return {
        machine: m,
        state: { kind: 'ok', word: 'ready' },
        detail: 'Built, 14 min',
      };
    if (now)
      return {
        machine: m,
        state: { kind: 'running', word: 'building' },
        detail: 'Browsers layer, step 3 of 5',
      };
    return {
      machine: m,
      state: { kind: 'waiting', word: 'waits' },
      detail: 'Waits for the build before it',
    };
  });
  const cols: Column<Row>[] = [
    { id: 'machine', header: 'Machine', cell: (r) => r.machine, kind: 'fit' },
    { id: 'state', header: 'State', cell: (r) => <Status {...r.state} />, kind: 'fit' },
    { id: 'detail', header: 'Now', cell: (r) => r.detail, kind: 'grow' },
  ];
  return (
    <Stack>
      {phase === 'failed' ? (
        <Message tone="problem">
          One image did not build. The others are done and the old image of that machine
          keeps serving.
        </Message>
      ) : null}
      {phase === 'stopped' ? (
        <Message tone="needs-you">
          Stopped. Images that were built stay; the rest were not started.
        </Message>
      ) : null}
      <Table
        caption="Images being built"
        columns={cols}
        rows={rows}
        rowKey={(r) => r.machine}
        oneLine
      />
    </Stack>
  );
}
