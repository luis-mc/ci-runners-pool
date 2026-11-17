# LOOK26: one action bar at the bottom, always visible; Use pool

Branch `LOOK26-action-bar`, from `origin/main`. Owner decisions of 2026-11-17.

## Done

- **Shared part** `ActionBar` (`packages/ui/src/components/ActionBar.tsx`, component 48, rule UX-71): sticky at the foot of the main content, above the key-hint bar, never scrolls away. Left to right: status ("2 selected", "Unsaved changes (N)"), secondary actions, the one primary. Phone: full width, buttons stacked at equal width, primary on top. A short page still has the bar at the window foot (frame, main and page grow; the bar takes the free space). The key-hint bar now has a fixed height so the bar sits flush above it.
- **Wizard** draws Back, Stop and the primary through the same part (it had its own `ds-action-bar` CSS; merged). A wizard embedded in a screen that has its own bar is not sticky.
- **Repositories**: header button "Turn on the pool" is gone. The bar shows "Nothing selected" or "N selected" and one primary: "Use pool" (ticked repositories; the Turn on wizard), "Stop using pool" when every ticked repository already uses it (question card, as before). Disabled with its reason until something is ticked, no admin, or public repositories are off. The per-selection "Turn on N" and "Turn off N" buttons in the toolbar are gone. The repository page: "Use pool" and "Stop using pool" are default buttons in the header; the bar holds Cancel and Save, with "Unsaved changes (N)" and Save disabled with "Nothing has changed yet." while clean.
- **Other screens on the bar**: Runners and Images (Add runners), Machines (Add a machine), Doctor (Run the doctor), machine page and image page (Cancel and Save, unsaved count), Settings Budgets (Cancel and Save, unsaved count). Machine page: Resume is now a default button.
- **Guard** `scripts/design/action-bar.test.ts` (scanner `action-bar-scan.ts`, list `action-bar.known.json`): fails on a primary button outside `<ActionBar primary={...}>` and on more than one primary in the bar. Shared UI and tests are not judged. The list was written at install and only shrinks.
- **Design system, `next-version`**: UX-71 (place, order, always visible), component 48, CHANGES C87 and C88, content words (Use pool, Stop using pool, Nothing selected, {n} selected, Unsaved changes ({n}), the two disabled reasons).
- **Docs**: web-console spec 4.3 updated; change note `docs/features/web-console/changes/LOOK26.md`.
- **Tests**: `ActionBar.test.tsx` (part), Repositories selection flow (bar, count, disabled reason, Use pool to Stop using pool), repository page (Save disabled while clean, unsaved count), guard tests. Existing tests moved to the new words. Results: `packages/ui` 128 passed; `scripts/design` 124 passed; `apps/web` 431 passed, 2 failed.
- **Screenshots**: `docs/review/LOOK26/index.html`, before (main) and after, 1300 and 393 px, Phosphor dark, 9 screens. Taken with a mocked API, so some secondary panes show "No mock" messages (Repositories org pools, for example); the bar is what to look at.

## Not done, and why

- **Known list of the guard (9 entries, 15 primaries):** Settings tabs (Settings, Updates, ListenAddress, Notifications, AccessForCi: several sections each with its own primary inside a tab), Jobs (Add runners and Export in the header, a Try again), Setup (first-run page), SignIn (narrow auth page, no bar wanted). They need a decision per tab: one bar per tab, or a form per tab. I did not guess.
- **Doctor fix actions** are findings' own buttons, not the screen's main action; left as they are.
- **Add runners wizard, Add a machine, Pool size, Turn on the pool** use the shared Wizard, so they are on the bar through the part; their pages were not re-shot.
- **`docs_fold.py` and `docs_check.py`** (luismc-docs) are not on this machine. The change note was written by hand in the existing format; no version table was edited. Run `docs_check.py` before merge.
- **LOOK21**: Save and the unsaved count follow the pending options only as far as the owner text said; revisit when LOOK21 lands.
- **No Playwright e2e run** (needs the Go binary). `ux-routes.spec.ts` (one primary, layout at 360, 393, 1300) is not run here; CI will. The new sticky and flex rules are the likeliest thing to trip a layout check.
- **Two failing web tests are not mine:** the Export download tests in `AuditLog.test.tsx` and `ConfigExport.test.tsx` fail on `origin/main` too.
- `core.hooksPath` is not set in this clone (the `prepare` script was skipped with `--ignore-scripts`), so the git hooks did not run on commit. I did not bypass them.
