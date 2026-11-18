// LOOK33: the block caret of the text boxes. jsdom has no layout, so a character is 8 px wide and the box 200 px.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchBar } from './Controls';
import { TextField } from './Fields';

const W = 8;
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const w = (this.textContent ?? '').length * W;
    return {
      width: w,
      height: 18,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: w,
      bottom: 18,
    } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(40);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Box({ initial = '' }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return <SearchBar value={v} onChange={setV} label="Find" />;
}
const block = () => document.querySelector<HTMLElement>('[data-caret-block]');
const left = () => parseFloat(block()?.style.insetInlineStart ?? 'NaN');

describe('block caret', () => {
  it('is hidden without focus and shown on focus, gone on blur', () => {
    render(<Box initial="abc" />);
    const input = screen.getByLabelText<HTMLInputElement>('Find');
    expect(block()).toBeNull();
    act(() => input.focus());
    expect(block()).not.toBeNull();
    expect(input.dataset.caret).toBe('block');
    act(() => input.blur());
    expect(block()).toBeNull();
    expect(input.dataset.caret).toBeUndefined();
  });

  it('follows typing', async () => {
    const user = userEvent.setup();
    render(<Box />);
    await user.click(screen.getByLabelText('Find'));
    const x0 = left();
    await user.keyboard('asd');
    expect(left()).toBe(x0 + 3 * W);
  });

  it('follows arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    render(<Box initial="hello" />);
    const input = screen.getByLabelText<HTMLInputElement>('Find');
    await user.click(input);
    await user.keyboard('{End}');
    const end = left();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(left()).toBe(end - 2 * W);
    await user.keyboard('{Home}');
    expect(left()).toBe(end - 5 * W);
    await user.keyboard('{ArrowRight}');
    expect(left()).toBe(end - 4 * W);
  });

  it('shows the character under the block, aria-hidden', async () => {
    const user = userEvent.setup();
    render(<Box initial="hello" />);
    await user.click(screen.getByLabelText('Find'));
    await user.keyboard('{Home}');
    expect(block()?.textContent).toBe('h');
    expect(block()?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows no block while text is selected', async () => {
    const user = userEvent.setup();
    render(<Box initial="hello" />);
    const input = screen.getByLabelText<HTMLInputElement>('Find');
    await user.click(input);
    expect(block()).not.toBeNull();
    // A selection made with the mouse or Shift+arrows ends in a key-up or mouse-up on the box.
    input.setSelectionRange(3, 5);
    fireEvent.keyUp(input, { key: 'ArrowLeft', shiftKey: true });
    expect(block()).toBeNull();
    expect(input.dataset.caret).toBeUndefined();
  });

  it('falls back to the native caret for right-to-left text, a password and IME composition', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Box initial="שלום" />);
    const input = screen.getByLabelText<HTMLInputElement>('Find');
    await user.click(input);
    expect(block()).toBeNull();
    rerender(<TextField label="Key" value="abc" onChange={() => {}} secret />);
    await user.click(screen.getByLabelText('Key'));
    expect(block()).toBeNull();
  });

  it('hides the block during composition', async () => {
    const user = userEvent.setup();
    render(<Box initial="ab" />);
    const input = screen.getByLabelText('Find');
    await user.click(input);
    expect(block()).not.toBeNull();
    act(() => {
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    });
    expect(block()).toBeNull();
    act(() => {
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    });
    expect(block()).not.toBeNull();
  });

  it('keeps the placeholder', () => {
    render(<Box />);
    expect(screen.getByLabelText<HTMLInputElement>('Find').placeholder).toBe('Find');
  });

  it('blinks with the token and is steady under reduced motion', () => {
    const css = readFileSync(resolve('src/components.css'), 'utf8');
    expect(css).toMatch(
      /\.ds-caret\s*\{[^}]*animation:\s*ds-caret-blink var\(--ds-cursor-blink\) steps\(1\) infinite/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.ds-caret\s*\{\s*animation:\s*none;/,
    );
    const tokens = readFileSync(resolve('src/tokens.css'), 'utf8');
    expect(tokens).toMatch(/--ds-cursor-blink:\s*0ms/);
  });
});
