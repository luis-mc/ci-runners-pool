// R5.26: findings grouped by area with a status word (UX-58), what is wrong and its fix, the time of the last run
// (UX-53), and "Run checks again" as the one primary, busy with progress while the run lasts (UX-13, UX-29).
// R5.31: loading, empty, could not load.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Schemas } from '../../api/api';
import {
  FakeEventSource,
  apiError,
  renderApp,
  signedIn,
  viewer,
} from '../../testing/mock';
import { areaOf, groupFindings, severityStatus } from './Doctor';

afterEach(cleanup);

type Finding = Schemas['DoctorFinding'];

function finding(over: Partial<Finding> = {}): Finding {
  return {
    check: 'workflow.labels',
    subject: { kind: 'repository', id: '7', name: 'octo/app' },
    severity: 'fail',
    title: 'No online runner carries [self-hosted, linux, arm64]',
    detail: '.github/workflows/ci.yml:12 needs [self-hosted, linux, arm64]',
    fix: { text: 'Add a runner with these labels.', link: '/pool/runners' },
    needs_admin: false,
    milestone: 1,
    checked_at: '2026-11-14T10:00:12Z',
    ...over,
  };
}

const lastRun = new Date(Date.now() - 5 * 60_000).toISOString();

function run(over: Partial<Schemas['DoctorRun']> = {}): Schemas['DoctorRun'] {
  return {
    id: 'run1',
    trigger: 'web',
    state: 'running',
    started_at: lastRun,
    counts: {},
    findings: [],
    ...over,
  };
}

describe('doctor words', () => {
  it('names the area of a check by its first part', () => {
    expect(areaOf('machine.online')).toBe('Machines');
    expect(areaOf('github.app')).toBe('GitHub registration');
    expect(areaOf('repo.vars')).toBe('Repository variables');
    expect(areaOf('cache.mirror')).toBe('Cache');
  });

  it('gives every severity a word, a glyph kind and a colour (UX-58)', () => {
    expect(severityStatus('fail')).toEqual({ kind: 'failed', word: 'failed' });
    expect(severityStatus('warn')).toEqual({ kind: 'waiting', word: 'warning' });
    expect(severityStatus('ok').word).toBe('ok');
    expect(severityStatus('skip').word).toBe('skipped');
  });

  it('groups the findings by area in screen order and leaves out the ok ones', () => {
    const groups = groupFindings([
      finding(),
      finding({ check: 'machine.online', severity: 'warn' }),
      finding({ check: 'machine.clock', severity: 'ok' }),
      finding({ check: 'zzz.thing', severity: 'info' }),
    ]);
    expect(groups.map((g) => g.area)).toEqual(['Machines', 'Workflow labels', 'Zzz']);
    expect(groups[0]?.items.length).toBe(1);
  });
});

describe('Doctor screen', () => {
  it('shows the loading state first', async () => {
    renderApp(signedIn().on('GET', '/api/v1/doctor/findings', { items: [] }), '/doctor');
    expect(await screen.findByText('Loading the doctor findings')).toBeTruthy();
  });

  it('lists findings by area with status word, what is wrong, the fix and the last run', async () => {
    const api = signedIn().on('GET', '/api/v1/doctor/findings', {
      items: [
        finding(),
        finding({
          check: 'machine.online',
          severity: 'warn',
          title: 'build-2 is offline',
          subject: { kind: 'machine', id: 'm2', name: 'build-2' },
          fix: { text: 'Start the agent.', command: 'crsp agent start' },
          needs_admin: true,
        }),
      ],
      last_run_at: lastRun,
    });
    renderApp(api, '/doctor');
    const machines = await screen.findByRole('region', { name: 'Machines' });
    expect(within(machines).getByText('warning')).toBeTruthy();
    expect(within(machines).getByText('build-2 is offline')).toBeTruthy();
    expect(within(machines).getByText('Start the agent.')).toBeTruthy();
    expect(within(machines).getByLabelText('Fix command').textContent).toBe(
      'crsp agent start',
    );
    const labels = screen.getByRole('region', { name: 'Workflow labels' });
    expect(within(labels).getByText('failed')).toBeTruthy();
    // LOOK19: the detail is one clipped line with a Details button; the full text opens in a row under it.
    const details = within(labels).getByRole('button', { name: 'Details' });
    expect(details.getAttribute('aria-expanded')).toBe('false');
    expect(within(labels).queryByRole('region', { name: /Details/ })).toBeNull();
    fireEvent.click(details);
    expect(details.getAttribute('aria-expanded')).toBe('true');
    expect(within(labels).getByRole('region', { name: /Details/ }).textContent).toBe(
      '.github/workflows/ci.yml:12 needs [self-hosted, linux, arm64]',
    );
    expect(details.getAttribute('aria-controls')).toBe(
      within(labels).getByRole('region', { name: /Details/ }).id,
    );
    expect(
      within(labels).getByRole('button', { name: 'Open' }).getAttribute('href'),
    ).toBe('/pool/runners');
    expect(
      screen.getByText(/Last run \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(5 min ago\)\./),
    ).toBeTruthy();
    expect(screen.getByText(/2 problems found/)).toBeTruthy();
    expect(screen.queryByText('needs admin')).toBeNull(); // the owner is admin
  });

  it('says No problems found with the time of the run when every finding is ok', async () => {
    const api = signedIn().on('GET', '/api/v1/doctor/findings', {
      items: [finding({ severity: 'ok', title: 'fine' })],
      last_run_at: lastRun,
    });
    renderApp(api, '/doctor');
    expect(await screen.findByText(/No problems found\. The doctor ran/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('says no checks have run and offers to run them', async () => {
    const api = signedIn()
      .on('GET', '/api/v1/doctor/findings', { items: [] })
      .on('POST', '/api/v1/doctor/runs', run({ state: 'done' }));
    renderApp(api, '/doctor');
    expect(
      await screen.findByText(
        'No checks have run yet. Use Run checks below to look for problems.',
      ),
    ).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Run checks' });
    expect(buttons.length).toBe(1); // one primary, not a second one in the empty state
    expect(screen.getByRole('heading', { level: 1, name: 'Doctor' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Findings' })).toBeTruthy();
    fireEvent.click(buttons[0] as HTMLElement);
    await waitFor(() => expect(api.count('POST', '/api/v1/doctor/runs')).toBe(1));
  });

  it('says what failed when the findings could not load, and tries again (UX-28)', async () => {
    let n = 0;
    const api = signedIn().on('GET', '/api/v1/doctor/findings', () => {
      n += 1;
      return n === 1
        ? apiError(500, 'internal', 'the findings could not be read')
        : { items: [finding()], last_run_at: lastRun };
    });
    renderApp(api, '/doctor');
    expect(await screen.findByText('Could not load the doctor findings.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Workflow labels' })).toBeTruthy();
  });

  it('runs the doctor: busy with progress while it runs, findings reload when it ends (UX-13, UX-29)', async () => {
    let state: 'running' | 'done' = 'running';
    let findings: Finding[] = [];
    const api = signedIn()
      .on('GET', '/api/v1/doctor/findings', () => ({
        items: findings,
        last_run_at: lastRun,
      }))
      .on('POST', '/api/v1/doctor/runs', () => run({ state: 'running' }))
      .on('GET', '/api/v1/doctor/runs/:id', () => run({ state, counts: { fail: 1 } }));
    renderApp(api, '/doctor');
    await screen.findByText(/No problems found/);
    fireEvent.click(screen.getByRole('button', { name: 'Run checks again' }));
    const busy = await screen.findByRole<HTMLButtonElement>('button', {
      name: 'Running the doctor',
    });
    expect(busy.disabled).toBe(true);
    expect(screen.getByRole('progressbar', { name: 'Running the doctor' })).toBeTruthy();
    expect(
      await screen.findByText(/Running the doctor\. 1 check done so far\./),
    ).toBeTruthy();
    state = 'done';
    findings = [finding()];
    act(() =>
      FakeEventSource.latest().emit({ id: '2', type: 'doctor.progress', at: 'x' }),
    );
    expect(await screen.findByRole('region', { name: 'Workflow labels' })).toBeTruthy();
    const again = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Run checks again',
    });
    expect(again.disabled).toBe(false);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('says in one line when the run could not start', async () => {
    const api = signedIn()
      .on('GET', '/api/v1/doctor/findings', { items: [finding()], last_run_at: lastRun })
      .on(
        'POST',
        '/api/v1/doctor/runs',
        apiError(500, 'internal', 'the doctor could not start'),
      );
    renderApp(api, '/doctor');
    await screen.findByRole('region', { name: 'Workflow labels' });
    fireEvent.click(screen.getByRole('button', { name: 'Run checks again' }));
    expect(
      await screen.findByText(/Could not run the doctor\. the doctor could not start/),
    ).toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Run checks again' })
        .disabled,
    ).toBe(false);
  });

  it('keeps Run checks again as the one primary, in the bar; a fix button in a row stays normal (D27)', async () => {
    const api = signedIn().on('GET', '/api/v1/doctor/findings', {
      items: [finding({ fix: { text: 'Open it.', link: '/machines' } })],
      last_run_at: lastRun,
    });
    renderApp(api, '/doctor');
    const bar = await screen.findByRole('region', { name: 'Actions' });
    const again = await within(bar).findByRole('button', { name: 'Run checks again' });
    expect(again.getAttribute('data-primary')).toBe('true');
    const fix = screen.getByRole('button', { name: 'Open' });
    expect(fix.hasAttribute('data-primary')).toBe(false);
    expect(document.querySelectorAll('[data-primary]')).toHaveLength(1);
  });

  it('keeps a viewer from running it and says why (UX-38)', async () => {
    const api = signedIn(viewer).on('GET', '/api/v1/doctor/findings', {
      items: [finding({ needs_admin: true })],
      last_run_at: lastRun,
    });
    renderApp(api, '/doctor');
    const button = await screen.findByRole<HTMLButtonElement>('button', {
      name: 'Run checks again',
    });
    expect(button.disabled).toBe(true);
    expect(await screen.findByText('needs admin')).toBeTruthy();
  });
});
