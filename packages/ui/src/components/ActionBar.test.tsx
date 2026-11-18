// The action bar (component 44, UX-71): one place, one order, one primary.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ActionBar, selectedStatus, unsavedStatus } from './ActionBar';
import { Button } from './Button';

afterEach(cleanup);

describe('ActionBar', () => {
  it('is a named region with the status, then the secondary actions, then the primary', () => {
    render(
      <ActionBar
        status={selectedStatus(2)}
        secondary={<Button>Cancel</Button>}
        primary={<Button kind="primary">Use pool</Button>}
      />,
    );
    const bar = screen.getByRole('region', { name: 'Actions' });
    expect(within(bar).getByText('2 selected')).toBeTruthy();
    const names = within(bar)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toEqual(['Cancel', 'Use pool']);
    expect(bar.querySelectorAll('[data-primary]')).toHaveLength(1);
  });

  it('draws no status line when there is nothing to say', () => {
    render(<ActionBar primary={<Button kind="primary">Add runners</Button>} />);
    expect(document.querySelector('.ds-action-bar__status')).toBeNull();
  });

  it('keeps a disabled primary with its reason', () => {
    render(
      <ActionBar
        primary={
          <Button kind="primary" disabled reason="Nothing has changed yet.">
            Save
          </Button>
        }
      />,
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(
      true,
    );
    expect(screen.getByText('Nothing has changed yet.')).toBeTruthy();
  });

  it('words the selection and the unsaved changes', () => {
    expect(selectedStatus(1)).toBe('1 selected');
    expect(unsavedStatus(0)).toBeUndefined();
    expect(unsavedStatus(3)).toBe('Unsaved changes (3)');
  });
});
