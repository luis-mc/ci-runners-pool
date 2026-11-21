// LOOK44: the Help page, the job path, the stepper and the ? popover.
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { machine, renderApp, signedIn } from '../../testing/mock';

afterEach(cleanup);

const withBudget = () =>
  signedIn().on('GET', '/api/v1/machines', {
    items: [
      machine({
        name: 'build-1',
        slots_used: 2,
        settings: {
          ...machine().settings,
          job_slots: 4,
          budget_memory_pct: 70,
          budget_cpu_pct: 55,
        },
      }),
    ],
  });

describe('Help (LOOK44)', () => {
  it('opens at /help with the stepper on its first step and one primary', async () => {
    renderApp(signedIn(), '/help');
    expect(await screen.findByRole('heading', { level: 1, name: 'Help' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Areas' });
    expect(
      within(nav).getByRole('link', { name: 'Help' }).getAttribute('aria-current'),
    ).toBe('page');
    const steps = screen.getByRole('list', { name: 'Steps' });
    expect(
      within(steps)
        .getByRole('button', { name: /On GitHub/ })
        .getAttribute('aria-current'),
    ).toBe('step');
    // A later step is not pressable until the tour got there.
    expect(
      within(steps).getByRole<HTMLButtonElement>('button', { name: /In your pool/ })
        .disabled,
    ).toBe(true);
    expect(screen.getByRole('region', { name: 'Questions' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'What does Run elsewhere mean?' }),
    ).toBeTruthy();
  });

  it('walks the steps with Next and Back and starts again at the end', async () => {
    renderApp(signedIn(), '/help');
    await screen.findByRole('heading', { level: 1, name: 'Help' });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('heading', { name: 'What is a slot?' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'What does shared mean?' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByRole('heading', { name: 'What is the Doctor?' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'What is the tray app?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'What is a slot?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start again' }));
    expect(
      await screen.findByRole('heading', { name: 'What does shared mean?' }),
    ).toBeTruthy();
  });

  it('presses a part of the picture to go to its step', async () => {
    renderApp(signedIn(), '/help');
    await screen.findByRole('heading', { level: 1, name: 'Help' });
    fireEvent.click(screen.getByRole('button', { name: /Slot\s*room for one job/ }));
    expect(await screen.findByRole('heading', { name: 'What is a slot?' })).toBeTruthy();
  });

  it('opens the step of a card from the address', async () => {
    renderApp(signedIn(), '/help#q-budget');
    expect(
      await screen.findByRole('heading', { name: 'What is the load budget?' }),
    ).toBeTruthy();
  });

  it("shows each machine's real slots and load budget, never a fixed 85% and 60%", async () => {
    renderApp(withBudget(), '/help#q-budget');
    expect(await screen.findByText('memory 70%, CPU 55%')).toBeTruthy();
    expect(screen.queryByText(/85/)).toBeNull();
  });

  it('shows the slots of each machine on the slot card', async () => {
    renderApp(withBudget(), '/help#q-slot');
    expect(await screen.findByText('2 of 4 slots in use')).toBeTruthy();
    expect(screen.getByText(/Pool size makes slots/)).toBeTruthy();
  });

  it('says so when there is no machine yet', async () => {
    renderApp(signedIn().on('GET', '/api/v1/machines', { items: [] }), '/help#q-slot');
    expect((await screen.findAllByText(/No machine yet\./)).length).toBeGreaterThan(0);
  });
});

describe('the ? beside a term (LOOK44)', () => {
  it('opens a short answer with a link to the Help card and closes with Escape', async () => {
    renderApp(
      withBudget().on('GET', '/api/v1/machines/:id', machine()),
      '/pool/machines/m1',
    );
    const ask = await screen.findByRole('button', { name: 'What does Slots mean?' });
    expect(ask.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(ask);
    const panel = await screen.findByRole('group', { name: 'Slots' });
    expect(within(panel).getByText(/Room for one job at a time/)).toBeTruthy();
    expect(
      within(panel)
        .getByRole('link', { name: 'More about this in Help' })
        .getAttribute('href'),
    ).toBe('/help#q-slot');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Slots' })).toBeNull();
  });
});
