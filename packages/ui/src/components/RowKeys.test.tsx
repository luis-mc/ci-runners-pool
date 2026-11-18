// UX-57: Left and Right move along a horizontal row; Home and End jump; ends wrap; Up and Down are untouched.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { Chips, Segmented, Tabs } from './Controls';
import { ArrowNavigation } from './Navigation';
import { TopMenu } from './Shell';

afterEach(cleanup);
const at = () => document.activeElement;

describe('arrow keys along a horizontal row', () => {
  it('tabs: Left and Right move focus and choose, wrap, Home and End', async () => {
    const user = userEvent.setup();
    function T() {
      const [c, setC] = useState('a');
      return (
        <ArrowNavigation>
          <Tabs
            label="Parts"
            tabs={[
              { id: 'a', label: 'One' },
              { id: 'b', label: 'Two' },
              { id: 'c', label: 'Three' },
            ]}
            current={c}
            onChange={setC}
          />
        </ArrowNavigation>
      );
    }
    render(<T />);
    screen.getByRole('tab', { name: 'One' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(at()).toBe(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.getByRole('tab', { name: 'Two' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    await user.keyboard('{End}');
    expect(at()).toBe(screen.getByRole('tab', { name: 'Three' }));
    await user.keyboard('{ArrowRight}');
    expect(at()).toBe(screen.getByRole('tab', { name: 'One' }));
    await user.keyboard('{ArrowLeft}');
    expect(at()).toBe(screen.getByRole('tab', { name: 'Three' }));
    await user.keyboard('{Home}');
    expect(at()).toBe(screen.getByRole('tab', { name: 'One' }));
  });

  it('segments and chips: Left and Right move focus only', async () => {
    const user = userEvent.setup();
    const changes: string[] = [];
    render(
      <ArrowNavigation>
        <Segmented
          label="Pool"
          options={[
            { value: 'on', label: 'Pool on' },
            { value: 'off', label: 'Pool off' },
          ]}
          value=""
          onChange={(v) => changes.push(v)}
        />
        <Chips
          label="Kind"
          options={[
            { value: 'x', label: 'X' },
            { value: 'y', label: 'Y' },
          ]}
          value=""
          onChange={(v) => changes.push(v)}
        />
      </ArrowNavigation>,
    );
    screen.getByRole('button', { name: 'All' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(at()).toBe(screen.getByRole('button', { name: 'Pool on' }));
    await user.keyboard('{End}{ArrowRight}');
    expect(at()).toBe(screen.getByRole('button', { name: 'All' }));
    await user.keyboard('{ArrowLeft}');
    expect(at()).toBe(screen.getByRole('button', { name: 'Pool off' }));
    screen.getByRole('button', { name: 'X' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(at()).toBe(screen.getByRole('button', { name: 'Y' }));
    expect(changes).toEqual([]);
  });

  it('top menu: Left and Right move between links; Down still walks the page', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ArrowNavigation>
          <TopMenu
            items={[
              { to: '/a', label: 'Overview' },
              { to: '/b', label: 'Jobs' },
              { to: '/c', label: 'Settings' },
            ]}
          />
          <button type="button">After</button>
        </ArrowNavigation>
      </MemoryRouter>,
    );
    screen.getByRole('link', { name: 'Overview' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(at()).toBe(screen.getByRole('link', { name: 'Settings' }));
    await user.keyboard('{ArrowRight}');
    expect(at()).toBe(screen.getByRole('link', { name: 'Overview' }));
    await user.keyboard('{ArrowDown}');
    expect(at()).toBe(screen.getByRole('link', { name: 'Jobs' }));
  });

  it('radio group: Left and Right choose and wrap; disabled radios are skipped', async () => {
    const user = userEvent.setup();
    render(
      <ArrowNavigation>
        <fieldset role="radiogroup" aria-label="Theme">
          <input type="radio" name="t" aria-label="A" defaultChecked />
          <input type="radio" name="t" aria-label="B" disabled />
          <input type="radio" name="t" aria-label="C" />
        </fieldset>
      </ArrowNavigation>,
    );
    screen.getByRole('radio', { name: 'A' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'C' }).checked).toBe(true);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'A' }).checked).toBe(true);
    await user.keyboard('{ArrowLeft}');
    expect(at()).toBe(screen.getByRole('radio', { name: 'C' }));
  });

  it('text boxes keep Left and Right for the cursor', async () => {
    const user = userEvent.setup();
    render(
      <ArrowNavigation>
        <div role="toolbar" aria-label="t">
          <button type="button">One</button>
          <input aria-label="Name" defaultValue="ab" />
        </div>
      </ArrowNavigation>,
    );
    const box = screen.getByRole('textbox', { name: 'Name' });
    await user.click(box);
    await user.keyboard('{ArrowLeft}');
    expect(at()).toBe(box);
  });
});
