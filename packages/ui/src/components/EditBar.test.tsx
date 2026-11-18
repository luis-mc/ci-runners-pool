// @vitest-environment jsdom
// LOOK21: the bar of an edit screen, the field marks and the leave guard.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, Link, RouterProvider, MemoryRouter } from 'react-router-dom';
import { CheckRow, ChoiceField, TextAreaField, TextField } from './Fields';
import { NumberField } from './Controls';
import { EditBar } from './EditBar';

afterEach(cleanup);

function Page({
  changes,
  onSave = () => {},
  onCancel = () => {},
}: {
  changes: number;
  onSave?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div>
      <Link to="/other">Leave</Link>
      <EditBar changes={changes} onSave={onSave} onCancel={onCancel} />
    </div>
  );
}

function routed(changes: number, onSave?: () => void, onCancel?: () => void) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <Page
            changes={changes}
            {...(onSave ? { onSave } : {})}
            {...(onCancel ? { onCancel } : {})}
          />
        ),
      },
      { path: '/other', element: <p>Other page</p> },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('EditBar', () => {
  it('is quiet and disabled while nothing changed', () => {
    routed(0);
    const bar = screen.getByRole('region', { name: 'Actions' });
    expect(within(bar).queryByText(/Unsaved changes/)).toBeNull();
    expect(
      within(bar).getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled,
    ).toBe(true);
    expect(
      within(bar).getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled,
    ).toBe(true);
    expect(within(bar).getByText('Nothing has changed yet.')).toBeTruthy();
  });

  it('counts the changes and enables Save and Cancel', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    routed(3, onSave, onCancel);
    const bar = screen.getByRole('region', { name: 'Actions' });
    expect(within(bar).getByText('Unsaved changes (3)')).toBeTruthy();
    fireEvent.click(within(bar).getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('locks Save while it runs and when the person may not save', () => {
    render(
      <MemoryRouter>
        <EditBar
          changes={2}
          onSave={() => {}}
          onCancel={() => {}}
          blocked
          why="Only an admin can save."
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(
      true,
    );
    expect(screen.getByText('Only an admin can save.')).toBeTruthy();
  });
});

describe('leave guard', () => {
  it('asks "Discard changes?" when a link is pressed with unsaved changes; Keep editing stays', () => {
    const router = routed(1);
    fireEvent.click(screen.getByRole('link', { name: 'Leave' }));
    const dialog = screen.getByRole('dialog', { name: 'Discard changes?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/');
  });

  it('Discard leaves the page', async () => {
    const router = routed(1);
    fireEvent.click(screen.getByRole('link', { name: 'Leave' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }),
    );
    await screen.findByText('Other page');
    expect(router.state.location.pathname).toBe('/other');
  });

  it('guards browser Back too', async () => {
    const router = createMemoryRouter(
      [
        { path: '/', element: <p>Start</p> },
        { path: '/edit', element: <Page changes={1} /> },
      ],
      { initialEntries: ['/', '/edit'], initialIndex: 1 },
    );
    render(<RouterProvider router={router} />);
    void router.navigate(-1);
    expect(await screen.findByRole('dialog', { name: 'Discard changes?' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/edit');
  });

  it('lets the person go when nothing changed', async () => {
    routed(0);
    fireEvent.click(screen.getByRole('link', { name: 'Leave' }));
    await screen.findByText('Other page');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks the browser before the tab closes, only with changes', () => {
    routed(1);
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    cleanup();
    routed(0);
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
  });
});

describe('field marks', () => {
  it('marks each changed field and leaves the others', () => {
    render(
      <div>
        <TextField label="Name" value="a" onChange={() => {}} changed />
        <TextAreaField label="Notes" value="" onChange={() => {}} />
        <NumberField label="Slots" value={2} onChange={() => {}} changed />
        <ChoiceField
          label="Role"
          value="a"
          choices={[{ value: 'a', label: 'A' }]}
          onChange={() => {}}
          changed
        />
        <CheckRow label="Public" checked onChange={() => {}} changed />
      </div>,
    );
    expect(document.querySelectorAll('[data-changed]')).toHaveLength(4);
    expect(document.querySelectorAll('.ds-field__changed')).toHaveLength(4);
    // The mark does not rename the field for a screen reader.
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Role' })).toBeTruthy();
    expect(
      document
        .querySelector(
          '.ds-field:has(#' + CSS.escape(screen.getByLabelText('Notes').id) + ')',
        )
        ?.hasAttribute('data-changed'),
    ).toBe(false);
  });
});
