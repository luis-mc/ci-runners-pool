# LOOK40 report: design system v3 draft for the Jobs redesign

Branch `LOOK40-ds-v3-draft`. Docs and gallery only. No app code, no `packages/ui` code. Nothing promoted or approved.

## What changed, per file (all in `docs/design-system/next-version/`)

- `ux-rules.md`: UX-72 rewritten (D14, D15: no overflow, wrap and break, rows may differ, ellipsis only with full text by tooltip on hover and focus and tap to expand on touch; serves CORE-3, CORE-4; row action words kept). New UX-74 (six tabs, order), UX-75 (Overview: four stat tiles, Needs you strip, cards, timeline, 7-day default), UX-76 (confidence word + How we know), UX-77 (one runner timeline, all machines and per machine).
- `components.md`: new 58 stat tile, 59 ranked findings list, 60 bar list, 61 runner timeline, 62 cell full-text, 63 stacked mode of the trend chart. Each has anatomy, states, tokens, keyboard and screen reader, phone at 360/393, rules. 52 and 56 point to them.
- `content.md`: new section "Jobs redesign words" (tabs, KPI names, change words, confidence words, empty states, part words); short-date note adjusted.
- `tokens.md`: no new token. `--ds-cell-grow-min` text now says a grow column wraps.
- `CHANGES.md`: C148 to C152. `README.md`: "What the apps do not follow yet" C148 to C150.
- `review-visuals/index.html`: rebuilt with `design_system.py visuals next-version`.

## Gallery

`docs/design-system/next-version/review-visuals/index.html`

## Checks

- `design_system.py check`: 0 findings. `docs_check.py`: 0 errors, 0 warnings.
- Contrast failures: none. Token gaps: `--ds-color-selection` (not a plain colour; pre-existing, by design).
- Not drawn: components 38 to 63 (the gallery tool draws 37 components; 38 to 57 were already not drawn). The new parts 58 to 63 are therefore text only in the gallery. Fixing needs a change to the tool in dev-standards, outside this task.
- `docs_fold.py note --doc design-system` is not supported ("use features/<feature> or <area>/<doc>"), so no change note was added; CHANGES.md carries the entries.

## Open points for the owner

1. Dismiss on the Overview: UX-52 keeps commands off the Overview, so the Needs you strip only links; Dismiss and Restore are in Run insights. Confirm.
2. Chart colours: the study found the light Note token (`#006779`) reads greyish next to Needs you and proposed `#b06a00` / `#1f5fa8`. I added no token; wait is hatched, run is solid. Decide whether to add chart tokens.
3. Runner timeline on phones: lane names stay (two rows per lane) instead of being hidden as in concept D.
4. Dismiss expiry, weekly digest day, flaky window (study questions 7, 8, 10) are not decided in v3.
5. The `rowHeights` guard no longer holds under the new UX-72; the build task must retire it.
6. Pre-push hook: golangci-lint is installed at `$HOME/go/bin`.
