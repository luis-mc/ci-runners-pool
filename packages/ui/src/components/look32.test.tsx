// @vitest-environment jsdom
// LOOK32: the page header keeps its action, and the hint under it, at the end of the row in every state.
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './Button';
import { PageHeader } from './layout';

afterEach(cleanup);
const css = readFileSync(join(import.meta.dirname, '..', 'components.css'), 'utf8');
const rule = (selector: string, source = css) =>
  new RegExp(`${selector.replaceAll('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(source)?.[1] ??
  '';

describe('page header action and hint (LOOK32)', () => {
  it('puts the action and its hint in one slot, hint after the action', () => {
    const { container } = render(
      <PageHeader title="m" action={<Button>Stop new jobs</Button>} hint="Hint line." />,
    );
    const slot = container.querySelector('.ds-page-header__action')!;
    expect(slot.firstElementChild?.textContent).toContain('Stop new jobs');
    expect(slot.querySelector('.ds-page-header__hint')?.textContent).toBe('Hint line.');
  });

  it('has the same structure in both states, so the header keeps its height', () => {
    const shape = (label: string) => {
      const { container, unmount } = render(
        <PageHeader
          title="m"
          lead="linux x64"
          action={<Button>{label}</Button>}
          hint="One line."
        />,
      );
      const out = [
        ...container.querySelectorAll('.ds-page-header, .ds-page-header *'),
      ].map((e) => e.tagName + '.' + e.className);
      unmount();
      return out;
    };
    expect(shape('Stop new jobs')).toEqual(shape('Resume'));
  });

  it('draws no hint without an action or without a hint', () => {
    const a = render(<PageHeader title="m" hint="Orphan" />);
    expect(a.container.querySelector('.ds-page-header__hint')).toBeNull();
    a.unmount();
    const b = render(<PageHeader title="m" action={<Button>Go</Button>} />);
    expect(b.container.querySelector('.ds-page-header__hint')).toBeNull();
  });

  it('right-aligns the slot and its hint, and never lets the hint widen it', () => {
    const slot = rule('.ds-page-header__action');
    expect(slot).toMatch(/align-items:\s*flex-end/);
    expect(slot).toMatch(/margin-inline-start:\s*auto/);
    expect(slot).toMatch(/max-inline-size:\s*22rem/);
    expect(rule('.ds-page-header__hint')).toMatch(/text-align:\s*end/);
  });
});
