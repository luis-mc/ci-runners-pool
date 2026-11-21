// LOOK44, LOOK47: the Help page (layout G, no wizard), the job path and the ? popover.
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { machine, renderApp, signedIn } from '../../testing/mock';
import { CARDS } from './helpContent';

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

describe('Help (LOOK47)', () => {
  it('opens at /help with the picture on top and every card visible, no wizard', async () => {
    renderApp(signedIn(), '/help');
    expect(await screen.findByRole('heading', { level: 1, name: 'Help' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Areas' });
    expect(
      within(nav).getByRole('link', { name: 'Help' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(screen.getByRole('region', { name: 'How a job gets run' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Questions' })).toBeTruthy();
    for (const t of [
      'What does shared mean?',
      'What is a slot?',
      'What is the Doctor?',
      'What is the tray app?',
      'What does Run elsewhere mean?',
    ]) {
      expect(screen.getByRole('heading', { name: t })).toBeTruthy();
    }
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(CARDS.length);
    expect(screen.queryByRole('list', { name: 'Steps' })).toBeNull();
    for (const n of ['Back', 'Next', 'Start again']) {
      expect(screen.queryByRole('button', { name: n })).toBeNull();
    }
  });

  it('presses a part of the picture and nothing is locked', async () => {
    renderApp(signedIn(), '/help');
    await screen.findByRole('heading', { level: 1, name: 'Help' });
    const box = screen.getByRole<HTMLButtonElement>('button', {
      name: /Slot\s*room for one job/,
    });
    expect(box.disabled).toBe(false);
    fireEvent.click(box);
    expect(screen.getByRole('heading', { name: 'What is a slot?' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'What does shared mean?' })).toBeTruthy();
  });

  it('keeps an address that ends in a card, with every card still shown', async () => {
    renderApp(signedIn(), '/help#q-budget');
    expect(
      await screen.findByRole('heading', { name: 'What is the load budget?' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'What is the Doctor?' })).toBeTruthy();
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
