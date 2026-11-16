// RES3 (owner decision D59): the add-machine wizard is copy-and-wait with live progress waiting -> connected
// -> ready, plus an optional "I have SSH" path for Linux and macOS whose key is used once and never kept.
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMING } from '../../timing';
import { MockApi, apiError, machine, renderApp, signedIn } from '../../testing/mock';
import { progressOf } from './AddMachine';

afterEach(cleanup);
beforeEach(() => {
  TIMING.joinPollMs = 10;
});

const code = (extra: object = {}) => ({
  id: 'j1',
  state: 'waiting',
  progress: 'waiting',
  created_at: '2026-11-14T10:00:00Z',
  expires_at: '2099-11-14T10:15:00Z',
  ...extra,
});

function api(poll: () => object): MockApi {
  return signedIn()
    .on('GET', '/api/v1/machines', { items: [] })
    .on('GET', '/api/v1/machines/:id', machine())
    .on('GET', '/api/v1/install-command', {
      controller_address: 'c',
      agent_port: 8461,
      cert_sha256: 'ab',
      items: [
        { os: 'linux', command: 'sudo crsp agent install --join-code <join code>' },
      ],
    })
    .on('POST', '/api/v1/join-codes', {
      code: 'CODE-1',
      join_code: code(),
      commands: {
        controller_address: 'c',
        agent_port: 8461,
        cert_sha256: 'ab',
        items: [{ os: 'linux', command: 'sudo crsp agent install --join-code CODE-1' }],
      },
    })
    .on('GET', '/api/v1/join-codes/:id', () => poll())
    .on('DELETE', '/api/v1/join-codes/:id', undefined);
}

const press = async (label: string | RegExp) =>
  fireEvent.click(await screen.findByRole('button', { name: label }));

describe('progressOf', () => {
  it('reads the progress, and treats a joined code with none as ready', () => {
    const base = code();
    expect(progressOf({ ...base, state: 'waiting' } as never)).toBe('waiting');
    expect(progressOf({ ...base, progress: 'connected' } as never)).toBe('connected');
    const old = { ...base, state: 'joined' } as Record<string, unknown>;
    delete old['progress'];
    expect(progressOf(old as never)).toBe('ready');
  });
});

describe('Copy and wait', () => {
  it('shows one Copy button with the join command, then waiting, connected and ready', async () => {
    let n = 0;
    const a = api(() => {
      n += 1;
      if (n < 3) return code();
      if (n < 6)
        return code({ state: 'joined', progress: 'connected', machine_id: 'm1' });
      return code({ state: 'joined', progress: 'ready', machine_id: 'm1' });
    });
    renderApp(a, '/machines/add');
    await screen.findByRole('radio', { name: 'Linux' });
    fireEvent.click(screen.getByRole('radio', { name: 'Copy a command' }));
    await press('Next');
    await screen.findByText(/Nothing has changed yet/);
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    await press('Join a machine');
    const block = await screen.findByLabelText('Join command');
    expect(block.textContent).toContain('--join-code CODE-1');
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(1);
    expect(screen.getByText('Waiting for the agent')).toBeTruthy();
    await screen.findByText('The machine joined the pool.');
    expect(a.count('GET', '/api/v1/join-codes/j1')).toBeGreaterThanOrEqual(6);
  });

  it('stays in progress while the agent is connected but not ready', async () => {
    const a = api(() =>
      code({ state: 'joined', progress: 'connected', machine_id: 'm1' }),
    );
    renderApp(a, '/machines/add');
    await screen.findByRole('radio', { name: 'Linux' });
    await press('Next');
    await press('Join a machine');
    await screen.findByLabelText('Join command');
    await waitFor(() =>
      expect(a.count('GET', '/api/v1/join-codes/j1')).toBeGreaterThan(2),
    );
    expect(screen.queryByText('The machine joined the pool.')).toBeNull();
    const group = screen.getByRole('group', { name: 'Add a machine' });
    expect(within(group).getAllByText('in progress')).toHaveLength(1);
  });

  it('offers the SSH choice for Windows with its note', async () => {
    renderApp(
      api(() => code()),
      '/machines/add',
    );
    await screen.findByRole('radio', { name: 'Windows' });
    fireEvent.click(screen.getByRole('radio', { name: 'Windows' }));
    expect(screen.getByRole('radio', { name: 'I have SSH' })).toBeTruthy();
    expect(
      screen.getByText(/Run the copied command in an administrator terminal/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'I have SSH' }));
    expect(screen.getByText(/needs the OpenSSH server/)).toBeTruthy();
  });
});

describe('I have SSH', () => {
  const fill = () => {
    fireEvent.click(screen.getByRole('radio', { name: 'I have SSH' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Host' }), {
      target: { value: 'build1.lan' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'User' }), {
      target: { value: 'ci' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'SSH key file' }), {
      target: { value: '-----BEGIN KEY-----\nabc\n-----END KEY-----' },
    });
  };

  it('asks for what is missing before Review', async () => {
    renderApp(
      api(() => code()),
      '/machines/add',
    );
    await screen.findByRole('radio', { name: 'Linux' });
    fireEvent.click(screen.getByRole('radio', { name: 'I have SSH' }));
    await press('Next');
    expect(await screen.findByText('Enter the host name or address.')).toBeTruthy();
    expect(screen.getByText('Paste the SSH key file.')).toBeTruthy();
    expect(screen.queryByText(/Nothing has changed yet/)).toBeNull();
  });

  it('confirms the host key, sends the key once and then waits for the agent', async () => {
    let posts = 0;
    const a = api(() =>
      code({ state: 'joined', progress: 'ready', machine_id: 'm1' }),
    ).on('POST', '/api/v1/join-codes/ssh', (c) => {
      posts += 1;
      const body = c.body as { host_fingerprint?: string };
      if (!body.host_fingerprint)
        return apiError(409, 'needs_confirmation', 'Confirm the host key.', [
          { kind: 'item', text: 'SHA256:hostkey' },
        ]);
      return Response.json(code(), { status: 201 });
    });
    renderApp(a, '/machines/add');
    await screen.findByRole('radio', { name: 'Linux' });
    fill();
    await press('Next');
    await screen.findByText(/Nothing has changed yet/);
    expect(screen.getByText('Over SSH as ci on build1.lan')).toBeTruthy();
    await press('Join a machine');
    const dialog = await screen.findByRole('dialog', { name: 'Is this the host key?' });
    expect(within(dialog).getByText(/SHA256:hostkey/)).toBeTruthy();
    expect(posts).toBe(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, sign in' }));
    await screen.findByText('The machine joined the pool.');
    expect(posts).toBe(2);
    const sent = a.calls.filter((c) => c.path === '/api/v1/join-codes/ssh');
    expect(sent[1]?.body).toMatchObject({
      os: 'linux',
      host: 'build1.lan',
      user: 'ci',
      port: 22,
      host_fingerprint: 'SHA256:hostkey',
    });
    expect(JSON.stringify(sent[1]?.body)).toContain('BEGIN KEY');
    // The key never reaches a URL, and the page does not show it again.
    expect(sent.every((c) => !c.query.toString().includes('KEY'))).toBe(true);
    expect(document.body.textContent).not.toContain('BEGIN KEY');
  });

  it('says why SSH failed and goes back to Review', async () => {
    const a = api(() => code()).on(
      'POST',
      '/api/v1/join-codes/ssh',
      apiError(400, 'bad_request', 'the install command did not finish on build1.lan'),
    );
    renderApp(a, '/machines/add');
    await screen.findByRole('radio', { name: 'Linux' });
    fill();
    await press('Next');
    await press('Join a machine');
    expect(await screen.findByText(/Could not join over SSH/)).toBeTruthy();
    expect(screen.getByText(/did not finish on build1.lan/)).toBeTruthy();
  });

  it('sends os windows over SSH and shows the reason when the user is not an administrator', async () => {
    const a = api(() => code()).on('POST', '/api/v1/join-codes/ssh', (c) => {
      const body = c.body as { host_fingerprint?: string };
      if (!body.host_fingerprint)
        return apiError(409, 'needs_confirmation', 'Confirm the host key.', [
          { kind: 'item', text: 'SHA256:hostkey' },
        ]);
      return apiError(
        400,
        'bad_request',
        'the SSH user is not an administrator on this machine',
      );
    });
    renderApp(a, '/machines/add');
    await screen.findByRole('radio', { name: 'Windows' });
    fireEvent.click(screen.getByRole('radio', { name: 'Windows' }));
    fill();
    expect(screen.getByText(/needs the OpenSSH server/)).toBeTruthy();
    await press('Next');
    await press('Join a machine');
    const dialog = await screen.findByRole('dialog', { name: 'Is this the host key?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, sign in' }));
    expect(await screen.findByText(/not an administrator on this machine/)).toBeTruthy();
    const sent = a.calls.filter((c) => c.path === '/api/v1/join-codes/ssh');
    expect(sent[1]?.body).toMatchObject({
      os: 'windows',
      host_fingerprint: 'SHA256:hostkey',
    });
  });
});
