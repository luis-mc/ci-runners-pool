// UX-57: Down, Up, j and k move focus through the page in page order; the radio group, the multi-line box and
// typing keep their own keys.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ArrowNavigation } from './Navigation';

afterEach(cleanup);

function Page() {
  const [v, setV] = useState('');
  return (
    <ArrowNavigation>
      <button type="button">First</button>
      <input aria-label="Name" value={v} onChange={(e) => setV(e.target.value)} />
      <fieldset>
        <legend>Size</legend>
        <label>
          <input type="radio" name="size" value="s" defaultChecked /> Small
        </label>
        <label>
          <input type="radio" name="size" value="m" /> Medium
        </label>
        <label>
          <input type="radio" name="size" value="l" /> Large
        </label>
      </fieldset>
      <textarea aria-label="Notes" defaultValue={'one\ntwo\nthree'} />
      <table>
        <tbody>
          <tr data-list-row tabIndex={0} aria-label="row a">
            <td>a</td>
          </tr>
          <tr data-list-row tabIndex={0} aria-label="row b">
            <td>b</td>
          </tr>
        </tbody>
      </table>
      <button type="button" disabled>
        Off
      </button>
      <button type="button">Last</button>
    </ArrowNavigation>
  );
}

const at = () => document.activeElement;

describe('arrow navigation (UX-57)', () => {
  it('moves through every control and list item in page order with Down, first to last', async () => {
    const user = userEvent.setup();
    render(<Page />);
    screen.getByRole('button', { name: 'First' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(at()).toBe(screen.getByRole('textbox', { name: 'Name' }));
    await user.keyboard('{ArrowDown}');
    expect(at()).toBe(screen.getByRole('radio', { name: 'Small' }));
    await user.keyboard('{ArrowDown}');
    expect(at()).toBe(screen.getByRole('textbox', { name: 'Notes' }));
    await user.keyboard('{Tab}');
    expect(at()).toBe(screen.getByRole('row', { name: 'row a' }));
  });

  it('hands over from the last list item to the next control and back from the first', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const a = screen.getByRole('row', { name: 'row a' });
    const b = screen.getByRole('row', { name: 'row b' });
    a.focus();
    await user.keyboard('{ArrowDown}');
    expect(at()).toBe(b);
    await user.keyboard('{ArrowDown}');
    expect(at()).toBe(screen.getByRole('button', { name: 'Last' })); // the disabled one is skipped
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(at()).toBe(a);
    await user.keyboard('{ArrowUp}');
    expect(at()).toBe(screen.getByRole('textbox', { name: 'Notes' })); // the previous control
  });

  it('j and k do the same as Down and Up', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const a = screen.getByRole('row', { name: 'row a' });
    a.focus();
    await user.keyboard('j');
    expect(at()).toBe(screen.getByRole('row', { name: 'row b' }));
    await user.keyboard('k');
    expect(at()).toBe(a);
  });

  it('stays on the first and last stop', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const first = screen.getByRole('button', { name: 'First' });
    first.focus();
    await user.keyboard('{ArrowUp}k');
    expect(at()).toBe(first);
    const last = screen.getByRole('button', { name: 'Last' });
    last.focus();
    await user.keyboard('{ArrowDown}j');
    expect(at()).toBe(last);
  });

  it('with nothing focused Down goes to the first stop and Up to the last', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.keyboard('j');
    expect(at()).toBe(screen.getByRole('button', { name: 'First' }));
    (at() as HTMLElement).blur();
    await user.keyboard('k');
    expect(at()).toBe(screen.getByRole('button', { name: 'Last' }));
  });

  it('typing j or k in a text box types; Down and Up still leave the box', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const name = screen.getByRole<HTMLInputElement>('textbox', { name: 'Name' });
    await user.click(name);
    await user.keyboard('jak');
    expect(name.value).toBe('jak');
    expect(at()).toBe(name);
    await user.keyboard('{ArrowDown}');
    expect(at()).toBe(screen.getByRole('radio', { name: 'Small' }));
  });

  it('in a radio group Up and Down leave the group; Left, Right and Space change the choice', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const small = screen.getByRole<HTMLInputElement>('radio', { name: 'Small' });
    const medium = screen.getByRole<HTMLInputElement>('radio', { name: 'Medium' });
    small.focus();
    await user.keyboard('{ArrowRight}');
    expect(medium.checked).toBe(true);
    expect(at()).toBe(medium);
    await user.keyboard('{ArrowDown}');
    expect(at()).toBe(screen.getByRole('textbox', { name: 'Notes' }));
    expect(medium.checked).toBe(true);
    medium.focus();
    await user.keyboard('{ArrowUp}'); // the group is one stop, so Up goes to the control before it

    expect(at()).toBe(screen.getByRole('textbox', { name: 'Name' }));
    await user.keyboard('{ArrowDown}{ArrowLeft}');
    expect(at()).toBe(small);
    expect(small.checked).toBe(true);
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Large' })).toHaveProperty('checked', true);
    await user.keyboard('{ArrowLeft} ');
    expect(medium.checked).toBe(true);
  });

  it('in a multi-line box Up and Down move the text cursor and focus stays', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const notes = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Notes' });
    await user.click(notes);
    await user.keyboard('{ArrowDown}{ArrowUp}jk');
    expect(at()).toBe(notes);
    expect(notes.value).toContain('jk');
  });

  it('does nothing with a modifier key held', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const first = screen.getByRole('button', { name: 'First' });
    first.focus();
    await user.keyboard('{Control>}j{/Control}');
    expect(at()).toBe(first);
  });

  it('skips what is inert or hidden', async () => {
    const user = userEvent.setup();
    render(
      <ArrowNavigation>
        <button type="button">A</button>
        <div inert>
          <button type="button">B</button>
        </div>
        <div hidden>
          <button type="button">C</button>
        </div>
        <button type="button">D</button>
      </ArrowNavigation>,
    );
    screen.getByRole('button', { name: 'A' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(at()).toBe(screen.getByRole('button', { name: 'D' }));
  });
});

describe('roving members and zero-size controls', () => {
  it('skips tabindex -1 buttons (inactive tabs, stepper buttons) and keeps list rows', async () => {
    const user = userEvent.setup();
    render(
      <ArrowNavigation>
        <button type="button">A</button>
        <button type="button" tabIndex={-1}>
          Inactive tab
        </button>
        <button type="button">B</button>
      </ArrowNavigation>,
    );
    screen.getByRole('button', { name: 'A' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'B' }));
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'A' }));
  });
});
