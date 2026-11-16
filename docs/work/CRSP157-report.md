# CRSP157 report: shared UI parts (packages/ui)

Branch `CRSP157-shared-ui`, base `865788d`. Area: packages/ui (+ theme-init default, theme data default).

Plan (status updated per step):
1. done
2. Tabs wrap, no sideways scroll; rule UX-68.
3. 44 px hit area: link, checkbox, radio, sort, breadcrumb.
4. Table: two-line phone fold, `title` wraps it in a Pane, sort heads, reverse-video row kept.
5. Switch shows its name.
6. Key-hint registry, fixed bar, hidden on coarse pointers.
7. Empty/Failed: one action, page h1 kept.
8. TimePicker 24 h default.
9. ThemePreview part.
10. Docs: next-version CHANGES + components, web-console change note.

Result: all nine items done; vitest packages/ui 80 pass, scripts/design 115 pass (new: sample-keeps-mode rule, Phosphor default), apps/web Settings.test updated to Phosphor default. Two apps/web export tests (AuditLog, ConfigExport) fail on main already, not touched.
Not run: `docs_check.py` (luismc-docs plugin not installed in this sandbox). The change note was written by hand in the notes format.
Join notes: Settings agent uses `ThemePreview`; app Shell should drop its static `KeyHints items` and call `useKeyHints` per page (items still work); pages should pass `pageTitle` and the action to `Empty`/`Failed` and drop the header action; Table `title` opt-in wraps in a pane.
