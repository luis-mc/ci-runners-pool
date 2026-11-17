// R5.24: the queue with each job's wait reason (UX-29), the history on a time axis with filters, the detail with a
// link to the run on GitHub, and Export of every row of the filter (UX-39). R5.31: loading, empty, could not load.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schemas } from '../../api/api';
import {
  FakeEventSource,
  apiError,
  machine,
  renderApp,
  signedIn,
} from '../../testing/mock';
import { jobStatus, waitWords } from './Jobs';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type Job = Schemas['Job'];

function job(over: Partial<Job> = {}): Job {
  return {
    id: 1,
    repository: 'octo/app',
    repository_id: 7,
    run_id: 100,
    run_attempt: 1,
    github_job_id: 1,
    workflow: 'ci.yml',
    job_name: 'test',
    labels: ['self-hosted', 'linux'],
    state: 'done',
    result: 'success',
    machine_id: 'm1',
    backend: 'docker',
    created_at: '2026-11-13T09:00:00Z',
    started_at: '2026-11-13T09:00:30Z',
    completed_at: '2026-11-13T09:05:00Z',
    github_wait_seconds: 30,
    run_seconds: 270,
    html_url: 'https://github.com/octo/app/actions/runs/100/job/1',
    ...over,
  };
}

const queued: Job = job({
  id: 5,
  state: 'queued',
  job_name: 'e2e',
  wait_reason: 'free_slot',
  wait_text: 'waits for a free slot on any Linux machine',
  queued_at: new Date(Date.now() - 125_000).toISOString(),
});

/** True when a `from` bound is under five days back: a day range shows nothing, a week shows the job. */
function recent(from: string | null): boolean {
  return from !== null && Date.now() - new Date(from).getTime() < 5 * 86_400_000;
}

function jobsApi(items: { queue?: Job[]; history?: Job[]; next?: string } = {}) {
  return signedIn()
    .on('GET', '/api/v1/machines', { items: [machine()] })
    .on('GET', '/api/v1/github/repositories', {
      items: [
        {
          id: 7,
          full_name: 'octo/app',
          owner: 'octo',
          name: 'app',
          installation_id: 1,
          visibility: 'private',
          pool_on: true,
          user_is_github_admin: true,
          user_admin_known: true,
          variables: [],
          policy: {
            priority: 10,
            max_parallel_jobs: 2,
            allow_fork_pull_requests: false,
            light_runner: true,
            labels: [],
            runner_groups: [],
          },
        },
      ],
      stale: { stale: false },
    })
    .on('GET', '/api/v1/jobs', (call) => {
      if (call.query.get('state') === 'queued')
        return { items: items.queue ?? [], stale: { stale: false } };
      return {
        items: items.history ?? [],
        ...(items.next && !call.query.get('cursor') ? { next_cursor: items.next } : {}),
        stale: { stale: false },
      };
    });
}

describe('wait reasons and results in words', () => {
  it('says why a queued job waits (UX-29), preferring the server line', () => {
    expect(waitWords({ wait_reason: 'free_slot', wait_text: 'waits on box-1' })).toBe(
      'waits on box-1',
    );
    expect(waitWords({ wait_reason: 'no_runner_with_labels' })).toBe(
      'waits for a runner with its labels',
    );
    expect(waitWords({})).toBe('waits to be placed');
  });

  it('gives every result a word and a glyph kind (UX-58)', () => {
    expect(jobStatus({ state: 'done', result: 'failure' })).toEqual({
      kind: 'failed',
      word: 'failure',
    });
    expect(jobStatus({ state: 'done', result: 'timed_out' }).word).toBe('timed out');
    expect(jobStatus({ state: 'queued' }).kind).toBe('waiting');
    expect(jobStatus({ state: 'running' }).kind).toBe('running');
  });
});

describe('Jobs screen', () => {
  it('shows the loading state first', async () => {
    renderApp(jobsApi(), '/jobs');
    expect(await screen.findByText('Loading the queue')).toBeTruthy();
  });

  it('shows the queue with each job and why it waits', async () => {
    renderApp(jobsApi({ queue: [queued], history: [job()] }), '/jobs');
    const table = await screen.findByRole('table', { name: 'Queued jobs' });
    expect(within(table).getByText('e2e')).toBeTruthy();
    expect(
      within(table).getByText('waits for a free slot on any Linux machine'),
    ).toBeTruthy();
    expect(within(table).getByText('2 min 5 s')).toBeTruthy();
  });

  it('shows the history grouped by day with result, machine, backend, wait and run time', async () => {
    renderApp(
      jobsApi({
        queue: [],
        history: [
          job(),
          job({
            id: 2,
            job_name: 'lint',
            result: 'failure',
            completed_at: '2026-11-12T10:00:00Z',
          }),
        ],
      }),
      '/jobs',
    );
    const row = (await screen.findByText('ci.yml / test')).closest('li');
    expect(row).toBeTruthy();
    const r = within(row as HTMLElement);
    expect(r.getByText('success')).toBeTruthy();
    expect(r.getByText(/on build-1, docker/)).toBeTruthy();
    expect(r.getByText('Waited 30 s')).toBeTruthy();
    expect(r.getByText('Ran 4 min 30 s')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(2);
    expect(screen.getByText('Showing all time')).toBeTruthy();
    expect(screen.getByText('Nothing is waiting. Every job has a slot.')).toBeTruthy();
  });

  it('filters by result, repository, machine and time range', async () => {
    const api = jobsApi({ history: [job()] });
    renderApp(api, '/jobs');
    await screen.findByText('ci.yml / test');
    fireEvent.click(screen.getByRole('button', { name: 'Failure' }));
    await waitFor(() =>
      expect(
        api.calls.some(
          (c) => c.path === '/api/v1/jobs' && c.query.get('result') === 'failure',
        ),
      ).toBe(true),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    await waitFor(() =>
      expect(
        api.calls.some(
          (c) => c.query.get('result') === 'failure' && c.query.get('from') !== null,
        ),
      ).toBe(true),
    );
    fireEvent.click(await screen.findByRole('radio', { name: 'build-1' }));
    await waitFor(() =>
      expect(api.calls.some((c) => c.query.get('machine_id') === 'm1')).toBe(true),
    );
    const repo = await screen.findByRole('radio', { name: 'octo/app' });
    fireEvent.click(repo);
    await waitFor(() =>
      expect(api.calls.some((c) => c.query.get('repository_id') === '7')).toBe(true),
    );
    expect(
      screen.getByText(/Showing \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/),
    ).toBeTruthy();
  });

  it('offers to widen the range when the period is empty (component 24)', async () => {
    renderApp(jobsApi({ history: [] }), '/jobs');
    // Nothing at all: the page says so.
    expect(
      await screen.findByText(
        'No jobs yet. Jobs show here when a workflow runs on the pool.',
      ),
    ).toBeTruthy();
  });

  it('says a filtered range is empty and widens it', async () => {
    const api = jobsApi({ queue: [queued] }).on('GET', '/api/v1/jobs', (call) =>
      call.query.get('state') === 'queued'
        ? { items: [queued], stale: { stale: false } }
        : {
            items: recent(call.query.get('from')) ? [] : [job()],
            stale: { stale: false },
          },
    );
    renderApp(api, '/jobs');
    await screen.findByText('ci.yml / test');
    fireEvent.click(screen.getByRole('button', { name: 'Last day' }));
    expect(
      await screen.findByText('No jobs match the filters in this range.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Widen the range' }));
    expect(await screen.findByText('ci.yml / test')).toBeTruthy();
  });

  it('loads earlier jobs with Show earlier and keeps the rows when that fails', async () => {
    let calls = 0;
    const api = jobsApi({ history: [job()], next: 'j1' }).on(
      'GET',
      '/api/v1/jobs',
      (call) => {
        if (call.query.get('state') === 'queued')
          return { items: [], stale: { stale: false } };
        if (call.query.get('cursor')) {
          calls += 1;
          return calls === 1
            ? apiError(500, 'internal', 'internal error')
            : { items: [job({ id: 0, job_name: 'older' })], stale: { stale: false } };
        }
        return { items: [job()], next_cursor: 'j1', stale: { stale: false } };
      },
    );
    renderApp(api, '/jobs');
    await screen.findByText('ci.yml / test');
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier' }));
    expect(await screen.findByText(/Could not load earlier jobs/)).toBeTruthy();
    expect(screen.getByText('ci.yml / test')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('ci.yml / older')).toBeTruthy();
  });

  it('says what failed when the history could not load, and tries again (UX-28)', async () => {
    let n = 0;
    const api = jobsApi({}).on('GET', '/api/v1/jobs', (call) => {
      if (call.query.get('state') === 'queued')
        return { items: [queued], stale: { stale: false } };
      n += 1;
      return n === 1
        ? apiError(500, 'internal', 'internal error')
        : { items: [job()], stale: { stale: false } };
    });
    renderApp(api, '/jobs');
    expect(await screen.findByText('Could not load the job history.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('ci.yml / test')).toBeTruthy();
  });

  it('reloads when a job event arrives (live)', async () => {
    let n = 0;
    const api = jobsApi({}).on('GET', '/api/v1/jobs', (call) => {
      if (call.query.get('state') === 'queued')
        return { items: [], stale: { stale: false } };
      n += 1;
      return {
        items: n === 1 ? [job()] : [job(), job({ id: 3, job_name: 'fresh' })],
        stale: { stale: false },
      };
    });
    renderApp(api, '/jobs');
    await screen.findByText('ci.yml / test');
    act(() =>
      FakeEventSource.latest().emit({
        id: '2',
        type: 'job.finished',
        at: 'x',
        job: job(),
      }),
    );
    expect(await screen.findByText('ci.yml / fresh')).toBeTruthy();
  });
});

describe('Export (component 29, UX-39)', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  it('exports every row of the filter and names the file as the server did', async () => {
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
    const api = jobsApi({ history: [job()] }).on(
      'GET',
      '/api/v1/exports/jobs',
      () =>
        new Response('id,repository\n1,octo/app\n', {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="crsp-jobs-2026-11-14-1005.csv"',
          },
        }),
    );
    renderApp(api, '/jobs');
    await screen.findByText('ci.yml / test');
    fireEvent.click(screen.getByRole('button', { name: 'Failure' }));
    await waitFor(() =>
      expect(api.calls.some((c) => c.query.get('result') === 'failure')).toBe(true),
    );
    await screen.findByText('ci.yml / test');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(downloads).toEqual(['crsp-jobs-2026-11-14-1005.csv']));
    const call = api.calls.find((c) => c.path === '/api/v1/exports/jobs');
    expect(call?.query.get('result')).toBe('failure');
    expect(call?.query.get('state')).toBe('done');
    expect(call?.query.get('limit')).toBeNull(); // no paging: the server holds every row
  });

  it('says in one line when the export fails, and keeps the button usable', async () => {
    const api = jobsApi({ history: [job()] }).on(
      'GET',
      '/api/v1/exports/jobs',
      apiError(500, 'internal', 'The file could not be written.'),
    );
    renderApp(api, '/jobs');
    await screen.findByText('ci.yml / test');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(
      await screen.findByText(/Could not export jobs\. The file could not be written\./),
    ).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Export' }).disabled,
    ).toBe(false);
  });
});

describe('Jobs panes and states (UX-4, UX-6, UX-10, UX-17)', () => {
  const paneNames = () =>
    Array.from(document.querySelectorAll('section.ds-pane')).map((e) =>
      e.getAttribute('aria-label'),
    );

  it('puts the queue, the filters and the history each in a pane, with the filters outside the list pane', async () => {
    renderApp(jobsApi({ queue: [queued], history: [job()] }), '/jobs');
    await screen.findByText('ci.yml / test');
    expect(paneNames()).toEqual(['Queue', 'Filters', 'History']);
    const filters = screen.getByRole('region', { name: 'Filters' });
    expect(within(filters).getByRole('group', { name: 'Result' })).toBeTruthy();
    expect(within(filters).getByText('Repository')).toBeTruthy();
    const history = screen.getByRole('region', { name: 'History' });
    expect(within(history).getByRole('button', { name: /Export/ })).toBeTruthy();
  });

  it('offers Add runners once, as the one primary, when there are no jobs', async () => {
    renderApp(jobsApi(), '/jobs');
    const add = await screen.findByRole('button', { name: 'Add runners' });
    expect(add.getAttribute('href')).toBe('/runners/add');
    expect(screen.getAllByRole('button', { name: 'Add runners' })).toHaveLength(1);
    expect(
      screen
        .getAllByRole('button')
        .filter((b) => b.getAttribute('data-kind') === 'primary'),
    ).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Jobs' })).toBeTruthy();
    expect(paneNames()).toEqual(['Jobs']);
  });

  it('keeps the h1 when the history could not load', async () => {
    const api = jobsApi({}).on('GET', '/api/v1/jobs', (call) =>
      call.query.get('state') === 'queued'
        ? { items: [queued], stale: { stale: false } }
        : apiError(500, 'internal', 'internal error'),
    );
    renderApp(api, '/jobs');
    await screen.findByText('Could not load the job history.');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('draws the queue rows as list rows the cursor reaches (reverse video row)', async () => {
    renderApp(jobsApi({ queue: [queued] }), '/jobs');
    await screen.findByText('e2e');
    const queue = screen.getByRole('region', { name: 'Queue' });
    const rows = within(queue).getAllByRole('row').slice(1);
    expect(rows.length).toBe(1);
    expect(rows.every((r) => r.hasAttribute('data-list-row') && r.tabIndex === 0)).toBe(
      true,
    );
  });
});

describe('Job detail', () => {
  it('shows the placement and times with a link to the run on GitHub', async () => {
    const api = jobsApi().on('GET', '/api/v1/jobs/:id', job());
    renderApp(api, '/jobs/1');
    expect(await screen.findByRole('heading', { level: 1, name: 'test' })).toBeTruthy();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    fireEvent.click(screen.getByRole('button', { name: 'Open the run on GitHub' }));
    expect(open).toHaveBeenCalledWith(
      'https://github.com/octo/app/actions/runs/100/job/1',
      '_blank',
      'noopener,noreferrer',
    );
    open.mockRestore();
    expect(screen.getByText('2026-11-13 09:05')).toBeTruthy();
    expect(screen.getByText('4 min 30 s')).toBeTruthy();
    expect(screen.getByText('docker')).toBeTruthy();
  });

  it('says so when the job is not found', async () => {
    const api = jobsApi().on(
      'GET',
      '/api/v1/jobs/:id',
      apiError(404, 'not_found', 'no such job'),
    );
    renderApp(api, '/jobs/99');
    expect(await screen.findByText('Could not load the job.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Job' })).toBeTruthy();
  });
});
