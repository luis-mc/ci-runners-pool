// Component 64: the search table. Focus starts in the search box, words and `field:word` filter, the details button
// opens the panel of the chosen row, and Down, Up, j and k move through every control (UX-57).
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ArrowNavigation, handleNavigationKey } from './Navigation';
import { SearchTable, matchesSearch, parseSearch } from './SearchTable';

afterEach(cleanup);

interface Row {
  id: string;
  repo: string;
  state: string;
  branch: string;
}
const ROWS: Row[] = [
  { id: '1', repo: 'octo/app', state: 'queued', branch: 'main' },
  { id: '2', repo: 'octo/web', state: 'running', branch: 'LOOK41-jobs' },
  { id: '3', repo: 'octo/app', state: 'done', branch: 'fix-login' },
];

function Harness() {
  const [q, setQ] = useState('');
  return (
    <MemoryRouter>
      <ArrowNavigation>
        <SearchTable<Row>
          label="Jobs"
          rows={ROWS}
          text={(r) => `${r.repo} ${r.state} ${r.branch}`}
          fields={{ repo: (r) => r.repo, state: (r) => r.state, branch: (r) => r.branch }}
          query={q}
          onQuery={setQ}
          caption="Jobs"
          columns={[
            { id: 'repo', header: 'Repository', cell: (r) => r.repo },
            { id: 'state', header: 'State', cell: (r) => r.state },
          ]}
          rowKey={(r) => r.id}
          detail={{
            title: (r) => `${r.repo} #${r.id}`,
            render: (r) => <p>Branch {r.branch}</p>,
          }}
        />
      </ArrowNavigation>
    </MemoryRouter>
  );
}
const rows = () => screen.getAllByRole('row').slice(1);

describe('search words', () => {
  it('parses a field word and a free word', () => {
    expect(parseSearch('repo:octo login', ['repo'])).toEqual([
      { field: 'repo', word: 'octo' },
      { word: 'login' },
    ]);
    expect(parseSearch('nope:x', ['repo'])).toEqual([{ word: 'nope:x' }]);
  });
  it('matches every word, a named one only in its field', () => {
    const t = parseSearch('state:run octo', ['state']);
    expect(matchesSearch(t, 'octo/web running', { state: 'running' })).toBe(true);
    expect(matchesSearch(t, 'octo/web queued run', { state: 'queued' })).toBe(false);
  });
});

describe('SearchTable', () => {
  it('starts with focus in the search box and lists every row', () => {
    render(<Harness />);
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    expect(rows()).toHaveLength(3);
  });

  it('filters by free words and by a named field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard('state:done');
    expect(rows()).toHaveLength(1);
    await user.clear(screen.getByRole('textbox'));
    await user.keyboard('octo/app');
    expect(rows()).toHaveLength(2);
    await user.keyboard(' zzz');
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it('shows and hides the details of the chosen row with a named button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: 'Show details' });
    expect(toggle.getAttribute('title')).toBe('Show details');
    await user.click(toggle);
    const side = screen.getByRole('complementary', { name: /Details: octo\/app #1/ });
    expect(within(side).getByText('Branch main')).toBeTruthy();
    await user.click(rows()[1] as HTMLElement);
    expect(screen.getByRole('complementary', { name: /octo\/web #2/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Hide details' }));
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('Down and j move from the box through the button to the rows', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show details' }));
    await user.keyboard('j');
    expect(document.activeElement).toBe(rows()[0]);
    await user.keyboard('j');
    expect(document.activeElement).toBe(rows()[1]);
    await user.keyboard('k');
    expect(document.activeElement).toBe(rows()[0]);
  });

  it('moves on from an SVG target (the icon of the button)', () => {
    render(<Harness />);
    const svg = screen.getByRole('button', { name: 'Show details' }).querySelector('svg');
    expect(svg).not.toBeNull();
    const e = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    Object.defineProperty(e, 'target', { value: svg });
    expect(handleNavigationKey(e)).toBe(true);
    expect(document.activeElement).toBe(rows()[0]);
  });
});
