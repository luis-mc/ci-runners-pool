# LOOK19 report: long state text on Runners (review, no decision)

Task: a failed runner's State cell shows the full error and wraps into a very tall narrow column. Three options built as real-app screenshots (vite dev server, e2e mock fixtures, Phosphor dark). Committed app code is unchanged; each option is a patch under `docs/review/LOOK19/`.

## Files (docs/review/LOOK19/)
- `index.html` side-by-side, labelled. PNGs: `baseline|A|B|C-{1300,1800,393}.png`, plus `-open` shots for A (dialog) and B (expanded row).
- `base.patch` shared by all options: System and Backend merged into the Isolation cell (second line: os arch), Labels capped at two plus a count with the full list in visually-hidden text. Needed because name/labels/isolation also wrapped word by word.
- `option-A.patch`, `option-B.patch`, `option-C.patch` (each includes base). `capture.mjs` reproduces the shots.
- Apply: `git apply docs/review/LOOK19/option-X.patch`, run `pnpm --dir apps/web exec vite`, `node docs/review/LOOK19/capture.mjs X out`.

## Measured (failed row / healthy rows, px; no horizontal scroll in any)
| | 1300 and 1800 | 393 |
|---|---|---|
| baseline | 1167 / 109, 109 | 775 / 384, 384 |
| A | 169 / 117, 96 | 491 / 363, 363 |
| B collapsed | 131 / 96, 88 | 449 / 342, 363 |
| C | 117 / 96, 88 | 418 / 342, 363 |
Row height is about 2-3 text lines at 1300 (name wraps to 4 short lines at the table's width, the 1800 view is the same width). Not yet one or two lines for the name; a column-width change would be a separate choice.

## Options
- A: summary + Details button, Dialog (focus trap, Esc, focus returns) with full text, Copy message, next step. Cost: one extra click; modal on a status page. Keyboard and screen reader: button then dialog.
- B: one-line ellipsis + Full error button (`aria-expanded`, `aria-controls`), full-width row. Needs a new `expandedRow` prop on Table, `expanded`/`controls` on Button, a `ds-table__clip` class. Cost: shared UI change. Text stays in the page flow, no modal.
- C: state short; one Problem banner per failed runner with full error, fix text and Remove / Add runners. Cost: many failures stack banners (UX-27 one banner slot: this uses inline Message, not the slot); error is away from its row. Needs no new component.

## Other tables with long free text
- Doctor (`Doctor.tsx` "What is wrong" cell: `f.detail` muted free text): same risk, one column holding title, subject and detail. B fits best (expand under the finding); A fits (Details). C does not (many findings).
- Jobs (`Jobs.tsx` queue "Why it waits": `wait_text` from the server): same risk, usually a sentence. A or B apply; C does not.
- Machines list (`Machines.tsx`): no free-text column; state words only. Not affected.
Pattern needs a shared helper for the summary (`reasonSummary` here splits at the first " (" or ": ", a heuristic; a server-provided short reason would be better).

## Notes
- Option shots reuse the real components; the keyboard hint bar is the real fixed footer.
- `pnpm install` ran the repo's own `prepare` script, which sets `core.hooksPath=.githooks`; not set by hand and hooks are not bypassed.
- Not run: unit tests, DOM-layout enforcement kit, docs_check (no committed app code or spec change). Docs: none, review artefacts only.
