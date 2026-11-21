// LOOK44: the Help page. The stepper walks the job path, the question cards sit in their own section, a ? beside a
// term opens a short answer that links to the same card, and Down, Up, j and k move between the controls. Layout at
// 360, 393 and 1300 px is checked for every route by ux-routes.spec.ts; this file checks the behaviour.
import { expect, test } from '@playwright/test';
import { machine, signedIn } from './fixtures';

const real = machine({
  settings: {
    budget_memory_pct: 70,
    budget_cpu_pct: 55,
    job_slots: 3,
    light_slots: 1,
    heavy_slots: 2,
    allowed_backends: ['docker'],
    drain_timeout_minutes: 30,
    windows_symlink_right: false,
  },
});

test('Help is the seventh item of the menu and opens the first step', async ({
  page,
}) => {
  await signedIn().install(page);
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Areas' });
  await expect(nav.getByRole('link')).toHaveCount(7);
  await nav.getByRole('link', { name: 'Help' }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Help' })).toBeVisible();
  const steps = page.getByRole('list', { name: 'Steps' });
  await expect(steps.getByRole('button', { name: /On GitHub/ })).toHaveAttribute(
    'aria-current',
    'step',
  );
  await expect(steps.getByRole('button', { name: /In your pool/ })).toBeDisabled();
  // The question cards are a section of their own, outside the picture's pane.
  const picture = page.getByRole('region', { name: 'How a job gets run' });
  const questions = page.getByRole('region', { name: 'Questions' });
  await expect(
    questions.getByRole('heading', { name: 'What does Run elsewhere mean?' }),
  ).toBeVisible();
  await expect(
    picture.getByRole('heading', { name: 'What does Run elsewhere mean?' }),
  ).toHaveCount(0);
});

test('Next walks the three steps and Start again goes back to the first', async ({
  page,
}) => {
  await signedIn().install(page);
  await page.goto('/help');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'What is a slot?' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'What is the Doctor?' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'What is the tray app?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start again' }).click();
  await expect(
    page.getByRole('heading', { name: 'What does shared mean?' }),
  ).toBeVisible();
});

test('the cards show the real slots and load budget of each machine', async ({
  page,
}) => {
  await signedIn()
    .on('GET', '/api/v1/machines', { items: [real] })
    .install(page);
  await page.goto('/help#q-slot');
  await expect(page.getByText('1 of 3 slots in use')).toBeVisible();
  await expect(page.getByText(/Pool size makes slots/)).toBeVisible();
  await expect(page.getByText('memory 70%, CPU 55%')).toBeVisible();
  await expect(page.getByText(/85%/)).toHaveCount(0);
});

test('the ? beside Slots opens a short answer that links to its Help card', async ({
  page,
}) => {
  await signedIn().on('GET', '/api/v1/machines/:id', real).install(page);
  await page.goto('/pool/machines/m1');
  await page.getByRole('button', { name: 'What does Slots mean?' }).click();
  const panel = page.getByRole('group', { name: 'Slots' });
  await expect(panel).toBeVisible();
  await panel.getByRole('link', { name: 'More about this in Help' }).click();
  await expect(page).toHaveURL(/\/help#q-slot$/);
  await expect(page.getByRole('heading', { name: 'What is a slot?' })).toBeVisible();
});

test('Escape closes the ? answer', async ({ page }) => {
  await signedIn().install(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'What does Queue mean?' }).click();
  await expect(page.getByRole('group', { name: 'Queue' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Queue' })).toHaveCount(0);
});

test('Down and j reach the boxes of the picture, Up and k come back', async ({
  page,
}) => {
  await signedIn().install(page);
  await page.goto('/help');
  const repo = page.getByRole('button', { name: /Repository/ });
  await repo.focus();
  await page.keyboard.press('j');
  await expect(
    page
      .getByRole('button', { name: /^2\s*Run/ })
      .or(page.getByRole('button', { name: /Run\s*one start/ })),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: /Job\s*asks/ })).toBeFocused();
  await page.keyboard.press('k');
  await expect(page.getByRole('button', { name: /Run\s*one start/ })).toBeFocused();
});

test('the first-run Overview shows the picture and Open Help', async ({ page }) => {
  await signedIn()
    .on('GET', '/api/v1/machines', { items: [] })
    .on('GET', '/api/v1/runners', { items: [] })
    .install(page);
  await page.goto('/');
  const picture = page.getByRole('region', { name: 'How a job gets run' });
  await expect(picture).toBeVisible();
  await picture.getByRole('button', { name: 'Open Help' }).click();
  await expect(page).toHaveURL(/\/help$/);
});

for (const width of [360, 393, 1300]) {
  test(`Help does not scroll sideways at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signedIn().install(page);
    await page.goto('/help');
    await expect(page.getByRole('heading', { level: 1, name: 'Help' })).toBeVisible();
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(over).toBeLessThanOrEqual(0);
  });
}
