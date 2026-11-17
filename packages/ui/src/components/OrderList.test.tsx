// The shared ordered list (component 45): moves, disabled ends, keyboard, normalising.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normaliseOrder, OrderList } from './OrderList';

afterEach(cleanup);

const items = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' },
];
const names = () =>
  screen.getAllByRole('listitem').map((li) => li.querySelector('.ds-order__name')?.textContent);

function Host({ start, spy }: { start: string[]; spy?: (v: string[]) => void }) {
  const [v, setV] = useState(start);
  return (
    <OrderList
      label="Order"
      items={items}
      value={v}
      onChange={(n) => {
        spy?.(n);
        setV(n);
      }}
    />
  );
}

describe('OrderList', () => {
  it('moves a row with the buttons and says the new place', async () => {
    const spy = vi.fn();
    render(<Host start={['a', 'b', 'c']} spy={spy} />);
    await userEvent.click(screen.getByRole('button', { name: 'Move Bravo up' }));
    expect(names()).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(spy).toHaveBeenCalledWith(['b', 'a', 'c']);
    expect(screen.getByRole('status').textContent).toBe('Bravo moved to place 1 of 3.');
    await userEvent.click(screen.getByRole('button', { name: 'Move Bravo down' }));
    expect(names()).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('disables Move up on the first row and Move down on the last', () => {
    render(<Host start={['a', 'b', 'c']} />);
    const b = (n: string) => screen.getByRole<HTMLButtonElement>('button', { name: n });
    expect(b('Move Alpha up').disabled).toBe(true);
    expect(b('Move Alpha down').disabled).toBe(false);
    expect(b('Move Charlie down').disabled).toBe(true);
  });

  it('Alt+ArrowDown and Alt+ArrowUp move the focused row and focus follows it', async () => {
    render(<Host start={['a', 'b', 'c']} />);
    const user = userEvent.setup();
    screen.getByRole('listitem', { name: '1, Alpha' }).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(names()).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(document.activeElement).toBe(screen.getByRole('listitem', { name: '2, Alpha' }));
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(names()).toEqual(['Alpha', 'Bravo', 'Charlie']);
    await user.keyboard('{ArrowDown}');
    expect(names()).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('shows duplicates and missing ids once each', () => {
    render(<Host start={['c', 'c', 'a', 'x']} />);
    expect(names()).toEqual(['Charlie', 'Alpha', 'Bravo']);
    expect(normaliseOrder(['c', 'c', 'a'], items)).toEqual(['c', 'a', 'b']);
  });
});
