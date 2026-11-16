# CRSP164 report: UX guards

Branch CRSP164-ux-guards from origin/main (865788d is an ancestor). Local run: temporary Playwright config (static server over `apps/web/dist`, Chromium 1243), not committed.

## Done
- `ux-routes.spec.ts`: 31 routes x (layout, touch, primary, h1 x3 states, selectAll, navScroll, pane), each at 360/393/1300 and dark/light.
- `ux-look.spec.ts`: six themes x dark/light, colours parsed from 02-options.html; all 12 pass on main.
- `ux-keyboard.spec.ts`: Down/Up walk on 26 signed-in routes; Ctrl+K focus.
- `ux-static.spec.ts`: alert/confirm/prompt scan (clean on main).
- `ux-fixme.ts`: 83 cases that main fails, each with its owner.
- Docs: Guard column of next-version ux-rules.md, CHANGES C53, change note CRSP164, scripts/design/README.md.

## Findings
- The kit's layout checker needs `spaceVar: '--ds-space-'` here (default `--space-` reads an empty scale). Layout then passes on every route: layout.known.json stays empty.
- Result with fixmes: 231 passed, 83 skipped, 0 failed. With `UX_NOFIXME=1` the 83 fail.

## Not done
- `docs_fold.py` and `docs_check.py` (luismc-docs plugin) are not installed here; the change note was written by hand in the same format. Run docs_check at the join.
- Overlays, running wizard steps and slow-request states are not driven (UX-13, 38 to 48 need their own specs).
