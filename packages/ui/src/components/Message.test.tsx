// LOOK28: a note can be dismissed; the other tones cannot.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Message } from './Message';

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Message dismiss', () => {
  it('a note has a Dismiss button that hides it and is remembered', () => {
    const { unmount } = render(<Message tone="note">Four repos hidden.</Message>);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Four repos hidden.')).toBeNull();
    unmount();
    render(<Message tone="note">Four repos hidden.</Message>);
    expect(screen.queryByText('Four repos hidden.')).toBeNull();
  });

  it('shows again when its text changes', () => {
    const { unmount } = render(<Message tone="note">Four repos hidden.</Message>);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    unmount();
    render(<Message tone="note">Five repos hidden.</Message>);
    expect(screen.getByText('Five repos hidden.')).toBeTruthy();
  });

  it('still renders and hides for the view when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<Message tone="note">Hello.</Message>);
    expect(screen.getByText('Hello.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Hello.')).toBeNull();
  });

  it('has no Dismiss on other tones, with an action, or when dismissible is false', () => {
    render(
      <>
        <Message tone="done">a</Message>
        <Message tone="needs-you">b</Message>
        <Message tone="problem">c</Message>
        <Message tone="note" action={<a href="/x">Go</a>}>
          d
        </Message>
        <Message tone="note" dismissible={false}>
          e
        </Message>
      </>,
    );
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });
});
