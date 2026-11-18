// CRSP164 (design system UX-57, UX-17): the keyboard walk. From the first control, ArrowDown reaches every
// focusable control in reading order to the last, and ArrowUp walks back to the first. A control that uses the arrow
// keys itself (a text box, a select, a radio group, a slider, a tab row) hands over with Tab and Shift+Tab. In the
// Ctrl+K palette, focus starts in the search box. These cases state the intended behaviour; a case that today's main
// fails is a test.fixme with its owner in ux-fixme.ts.
import { expect, test, type Page } from '@playwright/test';
import { consoleRoutes } from './routes';
import { fixmeFor } from './ux-fixme';
import { openRoute } from './ux-guards';

const NATIVE_ARROWS =
  'input:not([type=checkbox]):not([type=button]):not([type=submit]), select, textarea, [role=slider], [role=spinbutton], [role=tab], [role=radio], [role=combobox], [role=listbox], [role=textbox]';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex^="-"])';

/** The controls a person can reach, in reading order, visible only. */
async function controls(page: Page): Promise<string[]> {
  return page.evaluate((sel) => {
    const out: string[] = [];
    const radioStop = new Map<string, Element>();
    document
      .querySelectorAll<HTMLInputElement>('input[type=radio][name]')
      .forEach((r) => {
        const cur = radioStop.get(r.name) as HTMLInputElement | undefined;
        if (!cur || (r.checked && !cur.checked)) radioStop.set(r.name, r);
      });
    document.querySelectorAll(sel).forEach((e, i) => {
      // A radio group is one stop (D10): its chosen radio, else its first.
      if (
        e instanceof HTMLInputElement &&
        e.type === 'radio' &&
        e.name &&
        radioStop.get(e.name) !== e
      )
        return;
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden') return;
      if (e.getAttribute('tabindex')?.startsWith('-')) return; // a roving member: its group's own keys
      if (e.closest('[inert], [hidden], [aria-hidden=true]')) return;
      (e as HTMLElement).dataset.kwalk = String(i);
      out.push(String(i));
    });
    return out;
  }, FOCUSABLE);
}

async function current(page: Page): Promise<string | null> {
  return page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset.kwalk ?? null,
  );
}

async function step(page: Page, dir: 'down' | 'up'): Promise<void> {
  const native = await page.evaluate(
    (sel) => !!document.activeElement?.matches(sel),
    NATIVE_ARROWS,
  );
  if (native) await page.keyboard.press(dir === 'down' ? 'Tab' : 'Shift+Tab');
  else await page.keyboard.press(dir === 'down' ? 'ArrowDown' : 'ArrowUp');
}

const routes = consoleRoutes().filter((r) => !r.signedOut);

for (const route of routes) {
  test(`keyboard walk: ${route.pattern}`, async ({ page }) => {
    const why = fixmeFor('keyboard', route.pattern, 'data');
    test.fixme(why !== undefined, why ?? '');
    await openRoute(page, route);
    const all = await controls(page);
    test.skip(all.length === 0, 'nothing to focus on this screen');
    await page.locator(`[data-kwalk="${all[0]}"]`).focus();
    const down: string[] = [all[0] as string];
    for (let i = 1; i < all.length; i++) {
      await step(page, 'down');
      down.push((await current(page)) ?? 'none');
    }
    expect(down, 'ArrowDown reaches every control in order').toEqual(all);
    const up: string[] = [down[down.length - 1] as string];
    for (let i = all.length - 2; i >= 0; i--) {
      await step(page, 'up');
      up.push((await current(page)) ?? 'none');
    }
    expect(up, 'ArrowUp returns to the first').toEqual([...all].reverse());
  });
}

test('Ctrl+K opens the palette with focus in the search box', async ({ page }) => {
  const why = fixmeFor('palette-focus', '*', 'data');
  test.fixme(why !== undefined, why ?? '');
  await openRoute(page, { url: '/', signedOut: false });
  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Commands' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox')).toBeFocused();
});

// LOOK18 (UX-57): Left and Right move along a horizontal menu; the ends wrap; Home and End jump.
test('Left and Right move along the top menu', async ({ page }) => {
  await openRoute(page, { url: '/', signedOut: false });
  const links = page.getByRole('navigation', { name: 'Areas' }).getByRole('link');
  const n = await links.count();
  expect(n).toBeGreaterThan(2);
  await links.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(links.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(links.first()).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(links.nth(n - 1)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(links.first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(links.nth(n - 1)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(links.nth(n - 1)).not.toBeFocused();
});

test('Left and Right move and choose along the Settings tabs', async ({ page }) => {
  await openRoute(page, { url: '/settings/access', signedOut: false });
  const tabs = page.getByRole('tablist', { name: 'Settings' }).getByRole('tab');
  const n = await tabs.count();
  expect(n).toBeGreaterThan(2);
  // A tab changes the address, which draws the page again; the choice settles first, then focus is checked.
  const lands = async (i: number) => {
    await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(i)).toBeFocused();
  };
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await lands(1);
  await page.keyboard.press('ArrowLeft');
  await lands(0);
  await page.keyboard.press('ArrowLeft');
  await lands(n - 1);
  await page.keyboard.press('ArrowRight');
  await lands(0);
  await page.keyboard.press('End');
  await lands(n - 1);
  await page.keyboard.press('Home');
  await lands(0);
});
