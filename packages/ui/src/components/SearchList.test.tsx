// The shared search list (UX-31, UX-57): typing filters, Down, Up, j and k move through the results, Enter opens.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArrowNavigation } from './Navigation';
import { SearchList } from './SearchList';

afterEach(cleanup);

const items = [
  { id: 'a', label: 'Alpha', hint: 'area' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Alpine' },
];

function setup() {
  const onPick = vi.fn();
  render(
    <ArrowNavigation>
      <button type="button">Before</button>
      <SearchList items={items} onPick={onPick} label="Find" autoFocus />
      <button type="button">After</button>
    </ArrowNavigation>,
  );
  return {
    onPick,
    user: userEvent.setup(),
    box: screen.getByRole('textbox', { name: 'Find' }),
  };
}
const names = () => screen.getAllByRole('option').map((o) => o.textContent?.trim());

describe('SearchList', () => {
  it('starts with focus in the search box and lists everything', () => {
    const { box } = setup();
    expect(document.activeElement).toBe(box);
    expect(names()).toEqual(['Alpha area', 'Bravo', 'Alpine']);
  });

  it('filters while typing, and j and k type in the box', async () => {
    const { user, box } = setup();
    await user.keyboard('alp');
    expect(names()).toEqual(['Alpha area', 'Alpine']);
    await user.clear(box);
    await user.keyboard('jk');
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it('Down, Up, j and k move through the results; Enter on a result opens it', async () => {
    const { user, box, onPick } = setup();
    await user.keyboard('{ArrowDown}');
    const results = screen.getAllByRole('option').map((o) => o.querySelector('button')!);
    expect(document.activeElement).toBe(results[0]);
    await user.keyboard('j');
    expect(document.activeElement).toBe(results[1]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(results[2]);
    await user.keyboard('k');
    expect(document.activeElement).toBe(results[1]);
    await user.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith('b');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(document.activeElement).toBe(box);
  });

  it('Enter in the box opens the first result', async () => {
    const { user, onPick } = setup();
    await user.keyboard('bra{Enter}');
    expect(onPick).toHaveBeenCalledWith('b');
  });

  it('hands over to the controls around it at the first and last result', async () => {
    const { user, box } = setup();
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Before' }));
    box.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
  });

  it('Down from the box with no results goes to the next control', async () => {
    const { user } = setup();
    await user.keyboard('zzz{ArrowDown}'); // the clear button is the next control
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clear' }));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
  });
});
