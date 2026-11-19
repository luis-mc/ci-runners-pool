// LOOK19: a cell's long text is one clipped line with a button; the button opens the full text in a row under the row.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CappedList,
  Table,
  columnKind,
  splitMiddle,
  summarize,
  type Column,
} from './Table';

afterEach(cleanup);

interface Row {
  id: string;
  name: string;
  why: string;
  short?: string;
}
const LONG =
  'reset folder owner (set owner crsp-9433): icacls exited 1332: No mapping between account names and security IDs';
const columns: Column<Row>[] = [
  { id: 'name', header: 'Name', cell: (r) => r.name },
  {
    id: 'state',
    header: 'State',
    cell: () => 'failed',
    long: (r) => (r.why ? { full: r.why, short: r.short } : null),
  },
];
const rows: Row[] = [
  { id: 'a', name: 'alpha', why: LONG },
  { id: 'b', name: 'beta', why: 'stopped' },
  { id: 'c', name: 'gamma', why: '' },
];
function show() {
  render(
    <Table
      caption="Runners"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      expandLabel="Full error"
      rowLabel={(r) => r.name}
    />,
  );
}

describe('Table expanded row', () => {
  it('shows one clipped line and a button only for long text', () => {
    show();
    expect(screen.getAllByRole('button', { name: 'Full error' })).toHaveLength(1);
    expect(screen.getByText('reset folder owner').className).toBe('ds-table__clip');
    expect(screen.getByText('stopped').className).toBe('');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('opens the full text in a full-width row; aria-expanded and aria-controls follow', () => {
    show();
    const button = screen.getByRole('button', { name: 'Full error' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const region = screen.getByRole('region', { name: 'Full error: alpha' });
    expect(region.textContent).toBe(LONG);
    expect(button.getAttribute('aria-controls')).toBe(region.id);
    const cell = region.closest('td');
    expect(cell?.getAttribute('colspan')).toBe('2');
    expect(cell?.closest('tr')?.className).toBe('ds-table__expanded');
    expect(cell?.closest('tr')?.hasAttribute('data-list-row')).toBe(false);
    fireEvent.click(button);
    expect(screen.queryByRole('region')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('is a native button: reachable by Tab (not tabindex -1) and keeps focus after it toggles', () => {
    show();
    const button = screen.getByRole('button', { name: 'Full error' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('tabindex')).toBeNull();
    button.focus();
    fireEvent.click(button);
    expect(document.activeElement).toBe(button);
  });

  it('uses a server short form when there is one', () => {
    render(
      <Table
        caption="Runners"
        columns={columns}
        rows={[
          {
            id: 'a',
            name: 'alpha',
            why: LONG,
            short: 'Could not reset the folder owner',
          },
        ]}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText('Could not reset the folder owner')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Details' })).toBeTruthy();
  });
});

describe('summarize', () => {
  it('cuts at the first " (" or ": "', () => {
    expect(summarize(LONG)).toBe('reset folder owner');
    expect(summarize('a: b')).toBe('a');
  });
  it('cuts long text with an ellipsis and keeps short text whole', () => {
    expect(summarize('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`);
    expect(summarize('stopped')).toBe('stopped');
  });
});

describe('CappedList', () => {
  it('shows two items and a count, with the full list in hidden text', () => {
    render(<CappedList items={['a', 'b', 'c', 'd']} />);
    expect(screen.getByText('a, b +2').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('a, b, c, d').className).toBe('ds-visually-hidden');
  });
  it('shows a short list without a count', () => {
    render(<CappedList items={['a', 'b']} />);
    expect(screen.getAllByText('a, b')).toHaveLength(2);
    expect(screen.queryByText(/\+/)).toBeNull();
  });
});

describe('column kinds (UX-72)', () => {
  it('a column is fit unless it says grow or has long text', () => {
    expect(columnKind({})).toBe('fit');
    expect(columnKind({ kind: 'grow' })).toBe('grow');
    expect(columnKind({ kind: 'fit', long: () => null })).toBe('fit');
    expect(columnKind({ long: () => null })).toBe('grow');
  });
  it('a one-line table marks every head and cell with its kind', () => {
    const cols: Column<{ a: string; b: string }>[] = [
      { id: 'a', header: 'Short', cell: (r) => r.a },
      { id: 'b', header: 'Name', cell: (r) => r.b, kind: 'grow' },
    ];
    const { container } = render(
      <Table
        caption="t"
        columns={cols}
        rows={[{ a: '7 of 7', b: 'ci-runners' }]}
        rowKey={(r) => r.a}
        oneLine
      />,
    );
    const kinds = [...container.querySelectorAll('th, td')].map((c) =>
      c.getAttribute('data-kind'),
    );
    expect(kinds).toEqual(['fit', 'grow', 'fit', 'grow']);
  });
  it('a table that is not one line carries no kind', () => {
    const { container } = render(
      <Table
        caption="t"
        columns={[{ id: 'a', header: 'A', cell: () => 'x' }]}
        rows={[{}]}
        rowKey={() => 'k'}
      />,
    );
    expect(container.querySelector('[data-kind]')).toBeNull();
  });
  it('a middle cut keeps the start and the last characters', () => {
    expect(splitMiddle('RES18-column-widths')).toEqual(['RES18-column-', 'widths']);
    expect(splitMiddle('main')).toEqual(['main', '']);
  });
});
