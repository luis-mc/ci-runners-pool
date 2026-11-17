# LOOK17: no horizontal scroll, options (review)

Status: review only, no decision. App code is unchanged; the options were applied while shooting.

## Finding
Repositories shows a scroll bar at 1300 and 1800 px (Variables cut off, names wrap onto 3 lines, Labels header lower because Labels has no sort button). At 393 px the table already folds into stacked rows (no bar). The cause is shared: `.ds-table-frame { overflow-x: auto }` in `packages/ui/src/components.css`, which design rule UX-49 allows ("a wide table may scroll sideways inside its frame"). "No horizontal bars anywhere" needs UX-49 changed too.

## Options (docs/review/LOOK17/index.html)
Measured scroll bar at 1300 / 1800 / 393 px, with a check that nothing pokes out of its pane:

| | 1300 | 1800 | 393 |
|---|---|---|---|
| today | bar | bar | none |
| A fewer columns | none | none | none |
| B two-line rows | none | none | none |
| C cards under 1400, table above | none | none | none |

- A: name cell has a muted summary line ("2 parallel · priority 10 · variables ok"); Visibility only as a tag when not Private. I read "move to the repository detail" as: the detail page already holds these fields; the list keeps only the summary. Cheapest to build with the shared Table. Loses sort by labels, parallel, priority.
- B: needs a new shared list part (two-line row); the shared Table cannot draw it. Fewest decisions at phone width. No column sort.
- C: keeps every column and sort. Needed tight cell padding and wrapping headers to fit 1800 px (the content frame is 76rem = 1216 px); it does not fit the 9 columns at 1400 to about 1700 px, so cards cover that range in practice. Two renderings of one list: more code, more tests.

Common fix in A and C: Labels and Variables headers sort like their siblings, so the header row aligns.

## Other screens
19 screens measured at 1300 and 393 px with the e2e fixtures: none shows a horizontal bar. Fixture data is small, so a long list elsewhere may still scroll through the same shared frame. No screenshots, since none show one.

## Reproduce
`VARIANT=today|A|B|C pnpm exec playwright test -c docs/review/LOOK17/tools/playwright.config.ts --trace off` (Vite dev server, mocked API from `e2e/tests/web-console/fixtures.ts`). Apply `tools/option-X.patch` first for A, B or C; `tools/<X>.css` is injected by the script. Phosphor dark.

## Checks
- `docs_check.py` not run: the luismc-docs scripts are not in this sandbox.
- Design-system checklist not filled: no UI change is committed.
- Next step for the owner: pick A, B or C (or a mix); then a task changes the app, UX-49 and the e2e DOM layout check.
