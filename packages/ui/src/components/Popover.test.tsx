// @vitest-environment jsdom
// LOOK30: every popover closes on a press outside and on Escape, and Escape returns focus to its button.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { UserMenu } from './Shell';

afterEach(cleanup);

function setup() {
  render(
    <MemoryRouter>
      <p>Outside text</p>
      <UserMenu login="luis-mc" role="owner" onSignOut={() => undefined} busy={false} />
    </MemoryRouter>,
  );
  const button = screen.getByRole('button', { name: 'luis-mc' });
  fireEvent.click(button);
  return button;
}

describe('popover dismiss (LOOK30)', () => {
  it('closes on a mouse press outside', () => {
    setup();
    expect(screen.getByText(/Signed in as/)).toBeTruthy();
    fireEvent.mouseDown(screen.getByText('Outside text'));
    expect(screen.queryByText(/Signed in as/)).toBeNull();
  });

  it('closes on a touch outside', () => {
    setup();
    fireEvent.touchStart(document.body);
    expect(screen.queryByText(/Signed in as/)).toBeNull();
  });

  it('stays open on a press inside, and the button still toggles it', () => {
    const button = setup();
    fireEvent.mouseDown(screen.getByText(/Signed in as/));
    expect(screen.getByText(/Signed in as/)).toBeTruthy();
    fireEvent.mouseDown(button);
    fireEvent.click(button);
    expect(screen.queryByText(/Signed in as/)).toBeNull();
  });

  it('closes on Escape and puts focus back on the button', () => {
    const button = setup();
    screen.getByRole('button', { name: 'Sign out' }).focus();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByText(/Signed in as/)).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
