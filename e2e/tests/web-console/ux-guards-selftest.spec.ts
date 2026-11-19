// LOOK35: the guards guard themselves. Each new measure of ux-guards.ts runs on a small page that breaks its rule (it
// must report) and on one that keeps it (it must report nothing), so a measure that goes blind turns this red.
import { expect, test, type Page } from '@playwright/test';
import { measure, stickyWalk, stickyWalkAfterChange, type Measure } from './ux-guards';

const BASE = `<style>
  body { margin: 0; font: 16px/20px sans-serif; }
  .ds-pane { border: 1px solid #000; margin: 24px 8px; padding: 12px; position: relative; }
  .ds-pane__title { position: absolute; top: -10px; left: 8px; background: #fff; }
</style>`;

async function page_(page: Page, html: string, width = 1300): Promise<void> {
  await page.setViewportSize({ width, height: 600 });
  await page.setContent(
    `<!doctype html><html><body>${BASE}<main>${html}</main></body></html>`,
  );
}

const CASES: {
  measure: Measure;
  bad: string;
  good: string;
  width?: number;
  needle: string;
}[] = [
  {
    measure: 'wrapped',
    needle: 'wraps onto 2 lines',
    bad: '<button style="width:60px">Delete registration</button>',
    good: '<button style="white-space:nowrap">Delete registration</button>',
  },
  {
    measure: 'wrapped',
    needle: 'wraps onto',
    bad: '<span class="ds-chip" style="display:inline-block;width:80px">Active types: Private</span>',
    good: '<span class="ds-chip" style="display:inline-block;width:200px">Active types: Private</span>',
  },
  {
    measure: 'wordBroken',
    needle: 'is broken over lines',
    bad: '<button style="width:40px;overflow-wrap:anywhere">Remove</button>',
    good: '<button style="width:200px">Remove</button>',
  },
  {
    measure: 'wordBroken',
    needle: '"FINGERPRINT" in',
    bad: '<p style="width:60px;overflow-wrap:anywhere">The FINGERPRINT is shown</p>',
    good: '<p style="width:60px">The FINGERPRINT is shown</p>',
  },
  {
    measure: 'textOverText',
    needle: 'overlaps',
    bad: '<div style="position:relative"><p style="margin:0">First line of text</p><p style="margin:0;position:absolute;top:4px;left:0">Second line on top</p></div>',
    good: '<div><p style="margin:0">First line of text</p><p style="margin:0">Second line below</p></div>',
  },
  {
    measure: 'textOverText',
    needle: 'overlaps',
    // the middle-cut ShortText keeps its full text under the cut one: it is not judged
    bad: '<div style="position:relative"><p style="margin:0">Name</p><p style="margin:0;position:absolute;top:2px;left:0">Overlay</p></div>',
    good: '<span class="ds-short"><span aria-hidden="true">OPS34-jobs-s…ection</span><span class="ds-visually-hidden" style="position:absolute;top:0;left:0">OPS34-jobs-some-long-section</span></span>',
  },
  {
    measure: 'textOverBorder',
    needle: 'crosses the border of pane',
    bad: '<section class="ds-pane" aria-label="Machines" style="height:60px"><span class="ds-pane__title">Machines</span><p style="margin:0;position:absolute;top:-8px;left:150px">Stray text</p></section>',
    good: '<section class="ds-pane" aria-label="Machines" style="height:60px"><span class="ds-pane__title">Machines</span><p style="margin:0">Inside text</p></section>',
  },
  {
    measure: 'wordsGlued',
    needle: 'touches',
    bad: '<p>See <a href="#x">Shared</a><b>Pool</b> now</p>',
    good: '<p>See <a href="#x">Shared</a> <b>Pool</b> now</p>',
  },
  {
    measure: 'cutText',
    needle: 'short value "Wednesday" is cut',
    bad: '<span style="display:inline-block;width:30px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Wednesday</span>',
    good: '<span style="display:inline-block;width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Wednesday</span>',
  },
  {
    measure: 'cutText',
    needle: 'cannot be read whole',
    bad: '<table><tbody><tr><td style="max-width:60px"><span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">.github/workflows/ci.yml:12 needs</span></td></tr></tbody></table>',
    good: '<table><tbody><tr><td style="max-width:60px"><span title=".github/workflows/ci.yml:12 needs" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">.github/workflows/ci.yml:12 needs</span></td></tr></tbody></table>',
  },
  {
    measure: 'rowHeights',
    needle: 'rows are',
    bad: '<table><tbody><tr><td>One</td></tr><tr><td style="height:80px">Two</td></tr></tbody></table>',
    good: '<table><tbody><tr><td>One</td></tr><tr><td>Two</td></tr></tbody></table>',
  },
  {
    measure: 'rowActionWords',
    needle: 'is not a Row action word',
    bad: '<table><tbody><tr><td>a</td><td><button>Edit</button></td></tr></tbody></table>',
    good: '<table><tbody><tr><td>a</td><td><button>Open run</button> <button>Remove</button></td></tr></tbody></table>',
  },
];

CASES.forEach((c, i) => {
  test(`${c.measure} #${i + 1} reports a breach`, async ({ page }) => {
    await page_(page, c.bad, c.width);
    const lines = await measure(page, c.measure);
    expect(lines.join('\n')).toContain(c.needle);
  });
  test(`${c.measure} #${i + 1} accepts a page that keeps the rule`, async ({ page }) => {
    await page_(page, c.good, c.width);
    expect(await measure(page, c.measure)).toEqual([]);
  });
});

test('rowHeights does not judge a phone-width page', async ({ page }) => {
  await page_(
    page,
    '<table><tbody><tr><td>One</td></tr><tr><td style="height:80px">Two</td></tr></tbody></table>',
    393,
  );
  expect(await measure(page, 'rowHeights')).toEqual([]);
});

const BAR = `<style>
  .tall { height: 2000px; }
  .ds-action-bar { position: sticky; inset-block-end: 0; height: 44px; background: #ccc; }
  .ds-action-bar.loose { position: static; }
  .wrap { height: 2100px; }
</style>`;

test('stickyWalk reports a bar that scrolls away', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await page.setContent(
    `<!doctype html><body>${BAR}<main><div class="tall">Long page</div><div class="ds-action-bar loose" aria-label="Save bar">Save</div></main></body>`,
  );
  const lines = await stickyWalk(page);
  expect(lines.join('\n')).toContain('Save bar');
  expect(lines.join('\n')).toContain('is at');
});

test('stickyWalk accepts a bar that sticks and ends the page above it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await page.setContent(
    `<!doctype html><body>${BAR}<main><div class="tall">Long page</div></main><div class="ds-action-bar" aria-label="Save bar">Save</div><div style="height:1px"></div></body>`,
  );
  expect(await stickyWalk(page)).toEqual([]);
});

test('stickyWalk reports a bar with no fallback for the key-hint offset (N5)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await page.setContent(
    `<!doctype html><body>${BAR}<style>.ds-action-bar { inset-block-end: var(--ds-keyhints-height); }</style><main><div class="wrap">Page</div></main><div class="ds-action-bar" aria-label="Save bar" style="position:static">Save</div></body>`,
  );
  expect((await stickyWalk(page)).length).toBeGreaterThan(0);
});

test('stickyWalk reports the last text hidden under the bar', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await page.setContent(
    `<!doctype html><body>${BAR}<style>.ds-action-bar { position: fixed; left: 0; right: 0; bottom: 0; }</style><main><div class="tall">Page</div><p style="margin:0">Last line</p></main><div class="ds-action-bar" aria-label="Save bar">Save</div></body>`,
  );
  expect((await stickyWalk(page)).join('\n')).toContain('covers "Last line"');
});

test('stickyWalk has nothing to say about a page that does not scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await page.setContent(
    `<!doctype html><body>${BAR}<main>Short</main><div class="ds-action-bar loose">Save</div></body>`,
  );
  expect(await stickyWalk(page)).toEqual([]);
});

test('stickyWalk reports a bar that overlaps the key-hint bar (B19)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await page.setContent(
    `<!doctype html><body>${BAR}<style>.ds-keyhints { position: fixed; left: 0; right: 0; bottom: 0; height: 44px; background: #eee; } .ds-action-bar { inset-block-end: 20px; }</style><main><div class="tall">Page</div></main><div class="ds-action-bar" aria-label="Save bar">Save</div><div class="ds-keyhints">j / k Move</div></body>`,
  );
  expect((await stickyWalk(page)).join('\n')).toContain('overlaps the key-hint bar');
});

test('stickyWalk accepts a bar that sits above the key-hint bar', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await page.setContent(
    `<!doctype html><body>${BAR}<style>.ds-keyhints { position: fixed; left: 0; right: 0; bottom: 0; height: 44px; background: #eee; } .ds-action-bar { inset-block-end: 44px; }</style><main><div class="tall">Page</div></main><div class="ds-action-bar" aria-label="Save bar">Save</div><div class="ds-keyhints">j / k Move</div></body>`,
  );
  expect(await stickyWalk(page)).toEqual([]);
});

test('stickyWalkAfterChange changes a field and walks the bar that appears', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 400 });
  await page.setContent(
    `<!doctype html><body>${BAR}<main><input aria-label="Name" value="a" oninput="document.getElementById('b').hidden=false"><div class="tall">Page</div><div id="b" hidden class="ds-action-bar loose" aria-label="Save bar">Save</div></main></body>`,
  );
  expect((await stickyWalkAfterChange(page)).join('\n')).toContain('Save bar');
});
