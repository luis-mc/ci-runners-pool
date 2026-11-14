// R5.4, R5.5, UX-57: the palette, /, j and k, Enter and ?.
import { expect, test } from '@playwright/test';
import { signedIn } from './fixtures';

test('Ctrl+K opens the palette, finds an area and goes to it', async ({ page }) => {
  await signedIn().install(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Commands' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox').fill('runn');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Runners' })).toBeVisible();
});

test('the palette lists a command only to a role that may use it', async ({ page }) => {
  await signedIn({
    id: 2,
    login: 'view',
    role: 'viewer',
    added_at: '2026-11-02T10:00:00Z',
  }).install(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Commands' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Add a machine')).toHaveCount(0);
});

test('? lists the shortcuts and Escape closes the list', async ({ page }) => {
  await signedIn().install(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('/ goes to the search bar, and nothing fires while typing in it', async ({
  page,
}) => {
  await signedIn().install(page);
  await page.goto('/machines');
  await expect(page.getByRole('table', { name: 'Machines' })).toBeVisible();
  await page.keyboard.press('/');
  await expect(page.getByRole('textbox', { name: 'Search machines' })).toBeFocused();
  await page.keyboard.type('?j');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Search machines' })).toHaveValue('?j');
});

test('j moves down the list and Enter opens the row', async ({ page }) => {
  await signedIn().install(page);
  await page.goto('/machines');
  await expect(page.getByRole('table', { name: 'Machines' })).toBeVisible();
  await page.keyboard.press('j');
  await expect(page.locator('[data-list-row]').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'build-1' })).toBeVisible();
});
