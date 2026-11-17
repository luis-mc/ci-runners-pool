// @vitest-environment jsdom
// LOOK13: inactive rows are grey and tagged.
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Table } from './Table';
import { Tag } from './Status';

afterEach(cleanup);
const css = readFileSync(join(import.meta.dirname, '..', 'components.css'), 'utf8');
const tokens = readFileSync(join(import.meta.dirname, '..', 'tokens.css'), 'utf8');

describe('inactive rows (LOOK13, UX-70)', () => {
  it('Table marks inactive rows with data-inactive', () => {
    const { container } = render(
      <Table
        caption="c"
        columns={[{ id: 'n', header: 'Name', cell: (r: string) => r }]}
        rows={['a', 'b']}
        rowKey={(r) => r}
        inactive={(r) => r === 'b'}
      />,
    );
    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0]!.getAttribute('data-inactive')).toBeNull();
    expect(rows[1]!.getAttribute('data-inactive')).toBe('true');
  });
  it('Tag is a small outlined label', () => {
    const { container } = render(<Tag>inactive type</Tag>);
    expect(container.querySelector('.ds-tag')!.textContent).toBe('inactive type');
    expect(css).toContain('.ds-tag {');
  });
  it('grey text, underlined links, token in every theme', () => {
    expect(css).toMatch(/tr\[data-inactive\] a \{\s*text-decoration: underline/);
    expect(css).toContain('var(--ds-color-text-inactive)');
    expect(tokens.match(/--ds-color-text-inactive:/g)!.length).toBeGreaterThanOrEqual(12);
  });
});
