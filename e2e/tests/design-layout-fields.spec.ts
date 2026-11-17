import { expect, test } from '@playwright/test';
import { measureDomLayout } from '../../scripts/design/dom-layout';

// LOOK25: the layout guard must FAIL on fields side by side that differ in width class or top edge, and on a
// check box off the field column. Built from plain HTML, so no app code can hide a bad result.
const css = `body{margin:0;font:16px sans-serif}
.row{display:flex;gap:8px;align-items:start}
.f{display:grid}.f label{display:block}
input{box-sizing:border-box;height:44px}
.col{display:grid;gap:8px;width:300px}
.chk{display:flex;align-items:center;gap:8px}
.chk input{width:44px;margin:0}`;

const page = (body: string) =>
  `<style>${css}</style><main><div data-layout-group class="col">${body}</div></main>`;

const field = (w: string, label: string, width: number) =>
  `<div class="f ds-field" data-width="${w}" style="width:${width}px"><label>${label}</label><input style="width:${width}px"/></div>`;

test('guard fails when boxes in one row differ in width class and width', async ({ page: p }) => {
  await p.setContent(
    page(`<div data-layout-group class="row">${field('short', 'A', 110)}${field('medium', 'B', 190)}</div>`),
  );
  const found = await measureDomLayout(p, { spaceVar: '--ds-space-' });
  expect(found.some((f) => f.rule === 'field-row' && /width class/.test(f.text))).toBe(true);
  expect(found.some((f) => f.rule === 'field-row' && /differ in width/.test(f.text))).toBe(true);
});

test('guard fails when a wrapped label pushes one box lower', async ({ page: p }) => {
  await p.setContent(
    page(
      `<div data-layout-group class="row">${field('short', 'A very long label that wraps to lines', 110)}${field('short', 'B', 110)}</div>`,
    ),
  );
  const found = await measureDomLayout(p, { spaceVar: '--ds-space-' });
  expect(found.some((f) => f.rule === 'field-row' && /different heights/.test(f.text))).toBe(true);
});

test('guard fails when a check box is off the field column, passes when on it', async ({ page: p }) => {
  const box = (indent: number) =>
    page(
      `${field('full', 'Name', 300)}<label class="chk ds-choice__row"><input type="checkbox" style="margin-left:${indent}px"/>Forks</label>`,
    );
  await p.setContent(box(14));
  const bad = await measureDomLayout(p, { spaceVar: '--ds-space-' });
  expect(bad.some((f) => f.rule === 'check-edge')).toBe(true);
  await p.setContent(box(0));
  const good = await measureDomLayout(p, { spaceVar: '--ds-space-' });
  expect(good.filter((f) => f.rule === 'check-edge')).toEqual([]);
});

test('guard passes aligned fields', async ({ page: p }) => {
  await p.setContent(
    page(
      `<div data-layout-group class="row" style="align-items:end">${field('short', 'A', 110)}${field('short', 'B', 110)}</div>`,
    ),
  );
  const found = await measureDomLayout(p, { spaceVar: '--ds-space-' });
  expect(found.filter((f) => f.rule === 'field-row')).toEqual([]);
});
