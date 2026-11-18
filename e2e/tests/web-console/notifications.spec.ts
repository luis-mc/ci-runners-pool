// Settings, Notifications (notifications R5.7 to R5.9, R5.29 to R5.31; web-console 4.9) against the mocked API:
// add a webhook, edit it, Send test (busy and disabled while it runs, then one result line), delete with a question
// card; and the DOM layout of the page at 360, 393 and 1300 px.
import { expect, test } from '@playwright/test';
import { expectDomLayout } from '../../../scripts/design/dom-layout';
import { failure, signedIn, type Call } from './fixtures';

const hook = (over: Record<string, unknown> = {}) => ({
  id: 'nch_1',
  kind: 'webhook',
  name: 'Team chat',
  scope: 'pool',
  enabled: true,
  events: ['machine.offline', 'job.waiting'],
  min_severity: 'warning',
  url: 'https://hooks.example.com/crsp',
  secret_set: true,
  ...over,
});
const mail = {
  id: 'nch_2',
  kind: 'email',
  name: 'My mail',
  scope: 'personal',
  enabled: true,
  events: ['disk.low'],
  min_severity: 'error',
  address: 'octo@example.com',
  secret_set: false,
  smtp: {
    host: 'smtp.example.com',
    port: 587,
    username: 'mailer',
    from: 'crsp@example.com',
    has_password: true,
  },
  last_test_at: '2026-11-14T10:00:00Z',
  last_test_ok: false,
};

test('Add a webhook, send a test, edit it and delete it with a question card', async ({
  page,
}) => {
  let channels: unknown[] = [mail];
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const mock = signedIn()
    .on('GET', '/api/v1/notification-channels', () => ({ items: channels }))
    .on('POST', '/api/v1/notification-channels', (call: Call) => {
      const b = call.body as Record<string, unknown>;
      expect(String(b.secret)).toHaveLength(64);
      channels = [...channels, hook({ name: b.name, url: b.url })];
      return hook({ name: b.name, url: b.url });
    })
    .on('PATCH', '/api/v1/notification-channels/:id', (call: Call) => {
      const b = call.body as Record<string, unknown>;
      channels = channels.map((c) =>
        (c as { id: string }).id === 'nch_1' ? hook({ name: b.name }) : c,
      );
      return hook({ name: b.name });
    })
    .on('DELETE', '/api/v1/notification-channels/:id', () => {
      channels = channels.filter((c) => (c as { id: string }).id !== 'nch_1');
      return undefined;
    });
  await mock.install(page);
  // The test answer waits for the gate, so the busy state can be looked at.
  await page.route('**/api/v1/notification-channels/nch_1/test', async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      json: {
        ok: true,
        message: 'Delivered. hooks.example.com answered HTTP 204.',
        sent_at: '2026-11-14T10:05:00Z',
      },
    });
  });

  await page.goto('/settings/notifications');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Notification channels' })).toContainText(
    'My mail',
  );

  // Add a webhook.
  await page.getByRole('button', { name: 'Add channel' }).click();
  const form = page.getByRole('region', { name: 'Add a channel' });
  await form.getByRole('radio', { name: /^Webhook/ }).check();
  await form.getByRole('textbox', { name: 'Name', exact: true }).fill('Team chat');
  await form
    .getByRole('textbox', { name: 'Web address' })
    .fill('https://hooks.example.com/crsp');
  await form.getByRole('button', { name: 'Make a secret' }).click();
  await form.getByRole('checkbox', { name: 'Job waiting' }).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Channel Team chat saved.')).toBeVisible();
  const table = page.getByRole('table', { name: 'Notification channels' });
  await expect(table).toContainText('hooks.example.com');
  await expect(table).toContainText('Machine offline, Job waiting');

  // Send test: the button is busy and disabled and says so; the other row says why it waits.
  const row = table.getByRole('row', { name: /Team chat/ });
  await row.getByRole('button', { name: 'Send test' }).click();
  await expect(row.locator('[aria-busy="true"]')).toBeDisabled();
  await expect(row.getByRole('button', { name: /Sending/ })).toBeVisible();
  await expect(page.getByText('Sending a test. Waiting for the answer.')).toBeVisible();
  release();
  await expect(
    page.getByText('Team chat: Delivered. hooks.example.com answered HTTP 204.'),
  ).toBeVisible();

  // Edit: the secret is not shown again.
  await row.getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('region', { name: 'Edit Team chat' });
  await expect(edit.getByLabel(/Signing secret/)).toHaveValue('');
  await edit.getByRole('textbox', { name: 'Name', exact: true }).fill('Ops chat');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Channel Ops chat saved.')).toBeVisible();
  const patch = mock.calls.find((c) => c.method === 'PATCH');
  expect(patch?.body).not.toHaveProperty('secret');

  // Delete asks first and names the channel and its events.
  await table
    .getByRole('row', { name: /Ops chat/ })
    .getByRole('button', { name: 'Delete' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Delete Ops chat?' });
  await expect(dialog).toContainText(
    'Channel Ops chat stops carrying Machine offline, Job waiting.',
  );
  expect(mock.count('DELETE', '/api/v1/notification-channels/nch_1')).toBe(0);
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Channel Ops chat deleted.')).toBeVisible();
  await expect(table).not.toContainText('Ops chat');
});

test('A failed test says what failed; Cancel leaves the form', async ({ page }) => {
  const mock = signedIn()
    .on('GET', '/api/v1/notification-channels', { items: [mail] })
    .on('POST', '/api/v1/notification-channels/:id/test', {
      ok: false,
      message:
        'Could not reach smtp.example.com:587. The connection timed out after 15 s.',
      sent_at: '2026-11-14T10:05:00Z',
    });
  await mock.install(page);
  await page.goto('/settings/notifications');
  await page.getByRole('button', { name: 'Send test' }).click();
  await expect(page.getByText(/Test failed\. My mail: Could not reach/)).toBeVisible();
  await page.getByRole('button', { name: 'Add channel' }).click();
  await expect(page.getByRole('region', { name: 'Add a channel' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('region', { name: 'Add a channel' })).toHaveCount(0);
  expect(
    mock.calls.filter((c) => c.method === 'POST' && !c.path.endsWith('/test')),
  ).toHaveLength(0);
});

test('The server refusing a channel is shown on the form', async ({ page }) => {
  const mock = signedIn()
    .on('GET', '/api/v1/notification-channels', { items: [] })
    .on(
      'POST',
      '/api/v1/notification-channels',
      failure(403, 'forbidden', 'only an admin or the owner may change a webhook'),
    );
  await mock.install(page);
  await page.goto('/settings/notifications');
  await expect(
    page.getByText(
      'No channels yet. Add a channel to be told when a machine, job or disk needs you.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add channel' }).click();
  await page.getByRole('radio', { name: /^Desktop/ }).check();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Desk');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Could not save the channel/)).toBeVisible();
});

for (const state of ['list', 'add form', 'edit form']) {
  test(`layout: settings notifications, ${state}`, async ({ page }) => {
    await signedIn()
      .on('GET', '/api/v1/notification-channels', { items: [hook(), mail] })
      .install(page);
    await page.goto('/settings/notifications');
    await expect(
      page.getByRole('table', { name: 'Notification channels' }),
    ).toBeVisible();
    if (state === 'add form') {
      await page.getByRole('button', { name: 'Add channel' }).click();
      await expect(page.getByRole('region', { name: 'Add a channel' })).toBeVisible();
    }
    if (state === 'edit form') {
      await page.getByRole('button', { name: 'Edit' }).first().click();
      await expect(page.getByRole('region', { name: 'Edit Team chat' })).toBeVisible();
    }
    await page.waitForLoadState('networkidle');
    await expectDomLayout(page, `settings notifications ${state}`, {
      spaceVar: '--ds-space-',
    });
  });
}
