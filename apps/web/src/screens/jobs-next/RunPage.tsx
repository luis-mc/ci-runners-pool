// One run (RES15 review build): every job of the run as a waterfall (queue wait, then the run) and as a graph.
import {
  ActionBar,
  Badge,
  Breadcrumbs,
  Cluster,
  ExternalButton,
  Facts,
  JobGraph,
  Page,
  PageHeader,
  Section,
  Stack,
  Status,
  Tabs,
  TextLink,
  Waterfall,
  formatDateTime,
  formatNumber,
} from '@crsp/ui';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Load } from '../common';
import { useJobsGet } from './api';
import type { RunItem } from './model';
import { graphNodes, runRows } from './runViews';
import { etaWords, repoPath } from './words';

export function RunPage() {
  const { runId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const attempt = params.get('attempt') ?? undefined;
  const { result, reload } = useJobsGet<RunItem>(
    `/api/v1/runs/${encodeURIComponent(runId)}`,
    { attempt },
    true,
  );
  const run = result.state === 'ready' ? result.data : undefined;
  const url = run?.html_url.startsWith('https://') ? run.html_url : undefined;
  return (
    <Page>
      <Breadcrumbs
        trail={[{ to: '/jobs', label: 'Jobs' }, { label: run ? `Run ${run.id}` : 'Run' }]}
      />
      {run ? null : (
        <PageHeader title="Run" lead="One workflow run and all of its jobs." />
      )}
      <Load result={result} what="the run" reload={reload}>
        {(r) => <RunBody run={r} onAttempt={(a) => setParams({ attempt: String(a) })} />}
      </Load>
      {url ? (
        <ActionBar
          primary={
            <ExternalButton href={url} kind="primary">
              Open the run on GitHub
            </ExternalButton>
          }
        />
      ) : null}
    </Page>
  );
}

function RunBody({ run, onAttempt }: { run: RunItem; onAttempt: (a: number) => void }) {
  const navigate = useNavigate();
  const now = Date.now();
  const open = (j: { id: number }) => void navigate(`/jobs/${j.id}`);
  const view = runRows(run, now, open);
  const failed = run.jobs.filter((j) => j.result && j.result !== 'success').length;
  const word =
    run.state === 'running'
      ? 'running'
      : run.state === 'queued'
        ? 'waiting'
        : failed
          ? 'failure'
          : 'success';
  const kind =
    run.state === 'running'
      ? 'running'
      : run.state === 'queued'
        ? 'waiting'
        : failed
          ? 'failed'
          : 'ok';
  return (
    <Stack>
      <PageHeader
        title={`${run.workflow} on ${run.branch}`}
        lead={`${run.repository}, run ${formatNumber(run.id)}, attempt ${run.attempt}, ${run.jobs.length} jobs.`}
      />
      <Cluster>
        <Status kind={kind} word={word} />
        {run.attempts.length > 1 ? (
          <Badge>{`${run.attempts.length} attempts`}</Badge>
        ) : null}
      </Cluster>
      <Section title="Run">
        <Stack>
          {run.attempts.length > 1 ? (
            <Tabs
              label="Attempts of this run"
              tabs={run.attempts.map((a) => ({ id: String(a), label: `Attempt ${a}` }))}
              current={String(run.attempt)}
              onChange={(a) => onAttempt(Number(a))}
            />
          ) : null}
          <Facts
            items={[
              {
                name: 'Repository',
                value: (
                  <TextLink to={repoPath(run.repository)}>{run.repository}</TextLink>
                ),
              },
              { name: 'Branch', value: run.branch },
              { name: 'Worktree or task', value: run.worktree ?? 'not reported' },
              { name: 'Commit', value: run.head_sha.slice(0, 7) },
              {
                name: 'Pull request',
                value: run.pull_request ? `#${run.pull_request}` : 'none',
              },
              { name: 'Started', value: formatDateTime(run.created_at) },
              ...(run.eta
                ? [
                    {
                      name: 'Should end',
                      value: `${etaWords(run.eta)} (follows the critical path)`,
                    },
                  ]
                : []),
            ]}
          />
        </Stack>
      </Section>
      <Section
        title="Job graph"
        hint="An arrow means the job on its right needs the job on its left. The thick path is the longest chain."
      >
        <JobGraph
          label={`Jobs of run ${run.id}`}
          nodes={graphNodes(run, now, open)}
          edges={run.edges}
          emptyText="This run has no jobs."
        />
      </Section>
      <Section
        title="Timeline"
        hint="Each job waits in the queue (light part), then runs. A bracket is the forecast of the end."
      >
        <Waterfall
          label={`Jobs of run ${run.id}`}
          rows={view.rows}
          totalSec={view.totalSec}
          {...(view.nowSec !== undefined ? { nowSec: view.nowSec } : {})}
          emptyText="This run has no jobs."
        />
      </Section>
    </Stack>
  );
}
