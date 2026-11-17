// @vitest-environment jsdom
// LOOK14: a choice with a name, a value and a description on their own lines.
import { cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChoiceField } from './Fields';

afterEach(cleanup);
const css = readFileSync(join(import.meta.dirname, '..', 'components.css'), 'utf8');

const choices = [
  { value: 'a', label: 'Name A', detail: '10.0.0.1:8460', description: 'About A.' },
  {
    value: 'b',
    label: 'Name B',
    description: 'About B.',
    extra: <input aria-label="Own" />,
  },
];

describe('structured choice rows (LOOK14)', () => {
  it('puts name, value and description on separate lines inside one label', () => {
    const { container } = render(
      <ChoiceField label="Pick" value="a" onChange={() => {}} choices={choices} />,
    );
    const row = container.querySelector('label[data-structured]')!;
    expect(row.querySelector('.ds-choice__name')?.textContent).toBe('Name A');
    expect(row.querySelector('.ds-choice__detail')?.textContent).toBe('10.0.0.1:8460');
    expect(row.querySelector('.ds-choice__description')?.textContent).toBe('About A.');
    expect(row.getAttribute('data-selected')).toBe('true');
    expect(container.querySelectorAll('.ds-choice__option')).toHaveLength(2);
  });

  it('shows the extra content only while its option is chosen', () => {
    const onChange = vi.fn();
    const { container, rerender, queryByLabelText } = render(
      <ChoiceField label="Pick" value="a" onChange={onChange} choices={choices} />,
    );
    expect(queryByLabelText('Own')).toBeNull();
    fireEvent.click(container.querySelectorAll('input[type=radio]')[1]!);
    expect(onChange).toHaveBeenCalledWith('b');
    rerender(
      <ChoiceField label="Pick" value="b" onChange={onChange} choices={choices} />,
    );
    expect(queryByLabelText('Own')).toBeTruthy();
  });

  it('aligns the radio to the first line, divides options and marks the chosen one', () => {
    expect(css).toMatch(
      /\.ds-choice__row\[data-structured\] \{[^}]*align-items: flex-start/,
    );
    expect(css).toMatch(/\.ds-choice__option \{[^}]*border-block-start/);
    expect(css).toContain('.ds-choice__row[data-structured]:hover');
    expect(css).toContain('.ds-choice__row[data-structured][data-selected]');
  });
});
