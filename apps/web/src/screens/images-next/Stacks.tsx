// Stacks (RES19): what crsp read in the repositories. Per repository and summed for the pool. The scan reads files
// only; it never runs code. Nothing changes until the user confirms in the profile wizard (UX-30).
import {
  ActionBar,
  Breadcrumbs,
  Button,
  Code,
  Cut,
  Message,
  Page,
  PageHeader,
  Section,
  Stack,
  Status,
  Table,
  Text,
  formatPast,
  useNow,
  type Column,
} from '@crsp/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { Load } from '../common';
import { useGet } from './api';
import type { Finding, PoolStackRow, RepoScan, StackSummary } from './model';

const FINDING_STATUS: Record<Finding['state'], Parameters<typeof Status>[0]> = {
  covered: { kind: 'ok', word: 'covered' },
  new: { kind: 'waiting', word: 'new' },
  conflict: { kind: 'waiting', word: 'two answers' },
};

const SCAN_STATUS: Record<RepoScan['state'], Parameters<typeof Status>[0]> = {
  confirmed: { kind: 'ok', word: 'confirmed' },
  needs_you: { kind: 'waiting', word: 'needs you' },
  scanning: { kind: 'running', word: 'scanning' },
  failed: { kind: 'failed', word: 'scan failed' },
};

export function StacksTab() {
  const { result, reload } = useGet<StackSummary>('/api/v1/stack-scans');
  const now = useNow();
  return (
    <Load result={result} what="the stacks" reload={reload}>
      {(data) => {
        const needs = data.scans.filter((s) => s.state === 'needs_you').length;
        const rowCols: Column<PoolStackRow>[] = [
          {
            id: 'kind',
            header: 'Kind',
            cell: (r) => r.kind,
            sort: (r) => r.kind,
            kind: 'fit',
          },
          {
            id: 'name',
            header: 'Found',
            cell: (r) => r.name,
            sort: (r) => r.name,
            kind: 'fit',
          },
          {
            id: 'versions',
            header: 'Versions',
            cell: (r) => r.versions.join(', ') || '–',
            kind: 'fit',
          },
          {
            id: 'repos',
            header: 'Repositories',
            cell: (r) => String(r.repositories.length),
            sort: (r) => r.repositories.length,
            kind: 'fit',
          },
          {
            id: 'becomes',
            header: 'Becomes',
            cell: (r) => <Cut>{r.becomes}</Cut>,
            title: (r) => r.becomes,
            kind: 'grow',
          },
          {
            id: 'state',
            header: 'State',
            cell: (r) => <Status {...FINDING_STATUS[r.state]} />,
            kind: 'fit',
          },
        ];
        const scanCols: Column<RepoScan>[] = [
          {
            id: 'repo',
            header: 'Repository',
            cell: (s) => <Cut>{s.repository}</Cut>,
            title: (s) => s.repository,
            sort: (s) => s.repository,
            kind: 'grow',
          },
          {
            id: 'profile',
            header: 'Profile',
            cell: (s) => <Cut>{s.profile}</Cut>,
            title: (s) => s.profile,
            kind: 'grow',
          },
          {
            id: 'found',
            header: 'Findings',
            cell: (s) =>
              `${s.findings.length}, ${s.findings.filter((f) => f.state !== 'covered').length} to confirm`,
            kind: 'fit',
          },
          {
            id: 'state',
            header: 'State',
            cell: (s) => <Status {...SCAN_STATUS[s.state]} />,
            kind: 'fit',
          },
          {
            id: 'scanned',
            header: 'Scanned',
            cell: (s) => formatPast(s.scanned_at, now),
            kind: 'fit',
          },
        ];
        return (
          <Stack>
            <Message tone="note" dismissible={false}>
              crsp reads the workflows and the manifest files of each repository that uses
              the pool. It reads files only and never runs your code. It reads again after
              each push to the default branch.
            </Message>
            <Section
              title="What the pool needs"
              count={data.rows.length}
              hint={`Added up over ${data.scans.length} repositories. ${needs} ${needs === 1 ? 'repository waits' : 'repositories wait'} for your yes.`}
            >
              <Table
                caption="What the pool needs"
                columns={rowCols}
                rows={data.rows}
                rowKey={(r) => `${r.kind}:${r.name}`}
                oneLine
              />
            </Section>
            <Section title="Repositories" count={data.scans.length}>
              <Table
                caption="Repository scans"
                columns={scanCols}
                rows={data.scans}
                rowKey={(s) => s.repository}
                oneLine
                action={{
                  label: 'Open',
                  to: (s) => `/pool/images/stacks/${s.repository}`,
                  name: (s) => s.repository,
                }}
              />
            </Section>
          </Stack>
        );
      }}
    </Load>
  );
}

// ---------------------------------------------------------------------------------------------- one repository

export function StackPage() {
  const { owner = '', name = '' } = useParams();
  const repo = `${owner}/${name}`;
  const navigate = useNavigate();
  const { result, reload } = useGet<RepoScan>(
    `/api/v1/stack-scans/${encodeURIComponent(repo)}`,
  );
  return (
    <Page>
      <Breadcrumbs
        trail={[{ to: '/pool/images?tab=stacks', label: '‹ Stacks' }, { label: repo }]}
      />
      <Load result={result} what="the scan" reload={reload}>
        {(scan) => {
          const open = scan.findings.filter((f) => f.state !== 'covered');
          const now = Date.now();
          const cols: Column<Finding>[] = [
            {
              id: 'kind',
              header: 'Kind',
              cell: (f) => f.kind,
              sort: (f) => f.kind,
              kind: 'fit',
            },
            { id: 'name', header: 'Found', cell: (f) => f.name, kind: 'fit' },
            {
              id: 'version',
              header: 'Version',
              cell: (f) => f.version ?? '–',
              kind: 'fit',
            },
            {
              id: 'becomes',
              header: 'Becomes',
              cell: (f) => <Cut>{f.becomes}</Cut>,
              title: (f) => f.becomes,
              kind: 'grow',
            },
            {
              id: 'file',
              header: 'Read from',
              cell: (f) => <Code>{f.file}</Code>,
              title: (f) => f.file,
              kind: 'grow',
            },
            {
              id: 'state',
              header: 'State',
              cell: (f) => <Status {...FINDING_STATUS[f.state]} />,
              kind: 'fit',
            },
          ];
          return (
            <Stack>
              <PageHeader
                title={repo}
                lead={`Read ${scan.files_read} files and ${scan.workflows} workflows at ${scan.commit}, ${formatPast(scan.scanned_at, now)}. Profile: ${scan.profile}.`}
              />
              {scan.state === 'confirmed' ? (
                <Message tone="done">
                  Confirmed. The profile and its images match what the scan found.
                </Message>
              ) : null}
              {scan.findings.some((f) => f.state === 'conflict') ? (
                <Message tone="needs-you">
                  {scan.findings.find((f) => f.state === 'conflict')?.note ??
                    'Two files disagree.'}{' '}
                  You choose in the next step.
                </Message>
              ) : null}
              <Section
                title="Findings"
                count={scan.findings.length}
                hint="Each finding names the file it was read from and what crsp does with it."
              >
                <Table
                  caption="Findings"
                  columns={cols}
                  rows={scan.findings}
                  rowKey={(f) => f.id}
                  oneLine
                />
              </Section>
              <Text tone="muted">
                A finding that is covered needs nothing. A new finding adds a layer, a
                toolchain or a service to the profile. Nothing is built before you review
                it.
              </Text>
              <ActionBar
                status={
                  open.length > 0
                    ? `${open.length} ${open.length === 1 ? 'finding is' : 'findings are'} new`
                    : 'Nothing to confirm'
                }
                secondary={<Button onPress={reload}>Scan again</Button>}
                primary={
                  <Button
                    kind="primary"
                    disabled={open.length === 0}
                    reason="Every finding is covered."
                    onPress={() => void navigate(`/pool/images/stacks/${repo}/confirm`)}
                  >
                    {`Confirm ${open.length} ${open.length === 1 ? 'finding' : 'findings'}`}
                  </Button>
                }
              />
            </Stack>
          );
        }}
      </Load>
    </Page>
  );
}
