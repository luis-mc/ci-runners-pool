// CRSP157: the shared parts changed for the UX audit: hit areas, table fold, switch name, key hints, states, preview.
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { Switch } from './Fields';
import { KeyHints, KeyHintsProvider, useKeyHints } from './KeyHints';
import { Empty, Failed } from './State';
import { Table } from './Table';
import { ThemePreview } from './ThemePreview';
import { DEFAULT_THEME_ID, THEMES } from '../themes';

afterEach(cleanup);
const css = readFileSync(join(import.meta.dirname, '..', 'components.css'), 'utf8');
const block = (start: string): string => {
  const rest = css.slice(css.indexOf(start));
  return rest.slice(0, rest.indexOf('}'));
};

describe('44 px hit areas (UX-16)', () => {
  for (const sel of ['.ds-link {', '.ds-breadcrumbs__list a {', '.ds-table__sort {'])
    it(`${sel} is at least the target size`, () => {
      expect(block(sel)).toContain('min-block-size: var(--ds-target-min)');
    });
  it('checkbox and radio are 44 px boxes', () => {
    const b = block('.ds-checkbox,\n.ds-radio {');
    expect(b).toContain('inline-size: var(--ds-target-min)');
    expect(b).toContain('block-size: var(--ds-target-min)');
  });
});

describe('Table', () => {
  type Row = { id: string; name: string; os: string; n: number };
  const rows: Row[] = [
    { id: 'a', name: 'zed', os: 'linux', n: 2 },
    { id: 'b', name: 'amy', os: 'mac', n: 1 },
  ];
  const columns = [
    { id: 'name', header: 'Name', cell: (r: Row) => r.name, sort: (r: Row) => r.name },
    { id: 'os', header: 'System', cell: (r: Row) => r.os, secondary: true },
    { id: 'n', header: 'Runners', cell: (r: Row) => r.n, sort: (r: Row) => r.n },
  ];
  it('marks the lead cell and the secondary cells for the name-and-value stack', () => {
    render(
      <Table caption="Machines" columns={columns} rows={rows} rowKey={(r) => r.id} />,
    );
    const cells = screen.getAllByRole('cell');
    expect(cells[0]?.hasAttribute('data-lead')).toBe(true);
    expect(cells[1]?.hasAttribute('data-secondary')).toBe(true);
    expect(cells[2]?.hasAttribute('data-secondary')).toBe(false);
    const fold = css.slice(css.indexOf('@media (max-width: 599px) {\n  .ds-table thead'));
    expect(fold).toContain('content: attr(data-label)');
    expect(fold).toContain('grid-template-columns');
    expect(fold).toContain('td[data-secondary]');
  });
  it('sorts by a head', () => {
    render(
      <Table caption="Machines" columns={columns} rows={rows} rowKey={(r) => r.id} />,
    );
    act(() => screen.getByRole('button', { name: 'Name' }).click());
    expect(screen.getAllByRole('cell')[0]?.textContent).toBe('amy');
    expect(
      screen.getByRole('columnheader', { name: /Name/ }).getAttribute('aria-sort'),
    ).toBe('ascending');
  });
  it('keeps the reverse-video cursor row', () => {
    const b = block('.ds-table tr[data-list-row]:focus,');
    expect(b).toContain('background: var(--ds-color-primary)');
  });
  it('draws inside a pane when given a title', () => {
    render(
      <MemoryRouter>
        <Table
          caption="Machines"
          title="Machines"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
        />
      </MemoryRouter>,
    );
    const pane = screen.getByRole('region', { name: 'Machines' });
    expect(within(pane).getByRole('table')).toBeTruthy();
    expect(pane.querySelector('.ds-pane__count')?.textContent).toBe('2');
  });
});

describe('Switch', () => {
  it('shows its name next to it and the name works the switch', () => {
    let on = false;
    render(<Switch label="Pool on" on={on} onChange={(v) => (on = v)} />);
    const sw = screen.getByRole('switch', { name: 'Pool on' });
    const name = screen.getByText('Pool on');
    expect(name.tagName).toBe('LABEL');
    act(() => name.click());
    expect(on).toBe(true);
    expect(sw.textContent).toBe('Off');
  });
});

describe('KeyHints (UX-57)', () => {
  function Page({ list }: { list: boolean }) {
    useKeyHints([{ keys: '/', does: 'search' }]);
    return list ? (
      <Table
        caption="L"
        columns={[{ id: 'a', header: 'A', cell: (r: { id: string }) => r.id }]}
        rows={[{ id: 'x' }]}
        rowKey={(r) => r.id}
        onOpen={() => {}}
      />
    ) : null;
  }
  it('shows only the keys that work: j and k only where a list exists', () => {
    const { rerender } = render(
      <KeyHintsProvider>
        <Page list={false} />
        <KeyHints />
      </KeyHintsProvider>,
    );
    expect(screen.getByText('/')).toBeTruthy();
    expect(screen.queryByText('j / k')).toBeNull();
    rerender(
      <KeyHintsProvider>
        <Page list />
        <KeyHints />
      </KeyHintsProvider>,
    );
    expect(screen.getByText('j / k')).toBeTruthy();
    expect(screen.getByText('Enter')).toBeTruthy();
    rerender(
      <KeyHintsProvider>
        <Page list={false} />
        <KeyHints />
      </KeyHintsProvider>,
    );
    expect(screen.queryByText('j / k')).toBeNull();
  });
  it('draws nothing when no key works, and is fixed and hidden on coarse pointers', () => {
    const { container } = render(
      <KeyHintsProvider>
        <KeyHints />
      </KeyHintsProvider>,
    );
    expect(container.querySelector('.ds-keyhints')).toBeNull();
    expect(block('.ds-keyhints {')).toContain('position: fixed');
    const coarse = css.slice(css.indexOf('@media (pointer: coarse)'));
    expect(coarse.slice(0, coarse.indexOf('}'))).toContain('.ds-keyhints');
    expect(coarse).toContain('display: none');
  });
});

describe('Empty and Failed (UX-6, UX-28)', () => {
  it('keep the page h1 and show the action once', () => {
    render(
      <MemoryRouter>
        <Empty
          pageTitle="Machines"
          title="No machines yet."
          action={<button type="button">Add a machine</button>}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Machines' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add a machine' })).toHaveLength(1);
    cleanup();
    render(
      <Failed
        pageTitle="Machine"
        what="Could not load the machine."
        why="The controller could not answer. Try again."
        action={<button type="button">Try again</button>}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Machine' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(1);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
  it('without pageTitle draws no heading (the page has its own)', () => {
    render(<Empty title="Nothing." />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});

describe('ThemePreview and the default theme (LOOK D11)', () => {
  it('carries the theme and mode, a title in the border, a selected row and a primary button', () => {
    for (const t of THEMES)
      for (const mode of ['dark', 'light'] as const) {
        const { container, unmount } = render(<ThemePreview theme={t.id} mode={mode} />);
        const el = container.firstElementChild as HTMLElement;
        expect(el.getAttribute('data-theme-name')).toBe(t.id);
        expect(el.getAttribute('data-theme')).toBe(mode);
        expect(el.getAttribute('aria-label')).toBe(`${t.name}, ${mode}`);
        expect(el.querySelector('.ds-theme-preview__title')?.textContent).toContain('┤');
        expect(el.querySelector('[data-selected]')).toBeTruthy();
        expect(el.querySelector('.ds-theme-preview__button')).toBeTruthy();
        expect(el.querySelector('button, a, input')).toBeNull();
        unmount();
      }
  });
  it('draws only from tokens', () => {
    const b = css.slice(css.indexOf('.ds-theme-preview {'));
    expect(b).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
  it('new installs are Phosphor', () => {
    expect(DEFAULT_THEME_ID).toBe('phosphor');
  });
});

describe('ShortText', () => {
  it('cuts a long name in the middle and keeps the full name for hover and readers', async () => {
    const { shortenMiddle, ShortText } = await import('./ShortText');
    expect(shortenMiddle('main')).toBe('main');
    const cut = shortenMiddle('dependabot/npm_and_yarn/vite-8.3.8', 22);
    expect(cut.length).toBeLessThanOrEqual(22);
    expect(cut).toContain('…');
    const { container } = render(<ShortText text="dependabot/npm_and_yarn/vite-8.3.8" />);
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe(
      'dependabot/npm_and_yarn/vite-8.3.8',
    );
  });
});

describe('RowAction and the one-line table (UX-72)', () => {
  const rows = [
    { id: 'a', name: 'alpha', long: 'a-very-long-branch-name-that-is-cut' },
    { id: 'b', name: 'beta', long: 'short' },
  ];
  const columns = [
    { id: 'name', header: 'Name', cell: (r: (typeof rows)[number]) => r.name },
    { id: 'long', header: 'Branch', cell: (r: (typeof rows)[number]) => r.long },
  ];
  const view = () =>
    render(
      <MemoryRouter>
        <Table
          caption="Things"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          oneLine
          action={{ label: 'Open', to: (r) => `/things/${r.id}`, name: (r) => r.name }}
        />
      </MemoryRouter>,
    );
  it('ends every row with the same word, named by its row', () => {
    view();
    const buttons = screen.getAllByRole('button', { name: /^Open: / });
    expect(buttons.map((b) => b.textContent)).toEqual(['Open', 'Open']);
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Open: alpha');
    expect(buttons[1]?.getAttribute('href')).toBe('/things/b');
  });
  it('marks the table one line and gives a cut cell its full text on hover', () => {
    const { container } = view();
    expect(container.querySelector('table')?.hasAttribute('data-one-line')).toBe(true);
    expect(container.querySelector('[title="a-very-long-branch-name-that-is-cut"]')).not.toBeNull();
  });
  it('keeps the action column a fixed width from a token and never wraps its label', () => {
    expect(block('.ds-table th.ds-table__action,\n.ds-table td.ds-table__action {')).toContain(
      'inline-size: var(--ds-row-action-width)',
    );
    expect(block('.ds-table td.ds-table__action .ds-button {')).toContain('white-space: nowrap');
  });
  it('short date: 18 Nov 13:28', async () => {
    const { formatShortDateTime } = await import('./format');
    expect(formatShortDateTime(new Date(2026, 10, 18, 13, 28))).toBe('18 Nov 13:28');
  });
});
