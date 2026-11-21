// Components 64, 65, 66 (LOOK44): job path, stepper, term help.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobPath, Stepper, TermHelp } from './Help';

afterEach(cleanup);

const groups = [
  { id: 'a', label: 'On GitHub' },
  { id: 'b', label: 'In your pool' },
];
const parts = [
  { id: 'run', title: 'Run', line: 'one start of a workflow', group: 'a' },
  { id: 'slot', title: 'Slot', line: 'room for one job', group: 'b' },
];

describe('JobPath', () => {
  it('numbers the parts across the groups and lights the chosen ones', () => {
    render(<JobPath label="Path" groups={groups} parts={parts} lit={['slot']} />);
    const list = screen.getByRole('list', { name: 'Path' });
    expect(within(list).getByText('On GitHub')).toBeTruthy();
    expect(list.querySelectorAll('[data-lit]')).toHaveLength(1);
    expect(list.querySelectorAll('.ds-jobpath__n')[1]?.textContent).toBe('2');
  });

  it('is read only without onSelect and presses with it', () => {
    const { rerender } = render(<JobPath label="Path" groups={groups} parts={parts} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    const pick = vi.fn();
    rerender(<JobPath label="Path" groups={groups} parts={parts} onSelect={pick} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Run\s*one start of a workflow/ }),
    );
    expect(pick).toHaveBeenCalledWith('run');
  });
});

describe('Stepper', () => {
  it('locks the steps the tour has not reached and marks the current one', () => {
    const go = vi.fn();
    render(
      <Stepper
        label="Steps"
        steps={['One', 'Two', 'Three']}
        current={1}
        reached={1}
        onStep={go}
      />,
    );
    const one = screen.getByRole<HTMLButtonElement>('button', { name: /One/ });
    const three = screen.getByRole<HTMLButtonElement>('button', { name: /Three/ });
    expect(screen.getByRole('button', { name: /Two/ }).getAttribute('aria-current')).toBe(
      'step',
    );
    expect(three.disabled).toBe(true);
    fireEvent.click(one);
    expect(go).toHaveBeenCalledWith(0);
  });
});

describe('TermHelp', () => {
  it('opens and closes the answer and links to Help', () => {
    render(
      <MemoryRouter>
        <TermHelp term="Slots" answer="Room for one job." to="/help#q-slot" />
      </MemoryRouter>,
    );
    const ask = screen.getByRole('button', { name: 'What does Slots mean?' });
    expect(ask.hasAttribute('data-term-help')).toBe(true);
    fireEvent.click(ask);
    expect(
      screen.getByRole('link', { name: 'More about this in Help' }).getAttribute('href'),
    ).toBe('/help#q-slot');
    fireEvent.click(ask);
    expect(screen.queryByRole('group', { name: 'Slots' })).toBeNull();
  });
});
