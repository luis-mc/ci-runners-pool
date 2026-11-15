# LOOK2 report (branch only; not part of the pull request scope)

Task: console look = TUI panes frame + six user-selectable themes. Owner decisions LOOK D1/D2 (2026-11-15).

## Done
1. Theme data and tokens: `scripts/design/themes.data.ts` (the owner values, unchanged), `themes.ts` (derivations), `gen-themes.ts` (writes the theme part of `packages/ui/src/tokens.css`). Default `:root` = Tokyo Night dark; light under the system setting and `[data-theme=light]`; `[data-theme-name=<id>]` blocks for each theme, dark and light, also under an ancestor mode (used by the swatches).
2. Guard `scripts/design/themes.test.ts`: every theme defines every colour, radius and effect token in all three places; CSS equals the data; text pairs 4.5:1, borders 3:1, in every theme and mode. All owner values passed as given.
3. Shared UI: pane card (title cut into the top border, optional count), reverse-video selected row, `KeyHints` footer in `Frame`, swatches in `ChoiceField`, `packages/ui/src/themes.ts`.
4. Settings, Appearance: Theme choice (six, swatch each) and Mode choice. Tests in `Settings.test.tsx`.
5. Design system `next-version`: tokens (Colour themes), components 8, 41, 42, UX-60, content (Theme words), CHANGES C16, README line. Feature spec web-console: text and change note `changes/LOOK2.md`.

## Decisions to review
- **Theme name is kept in the browser (localStorage), not by the server.** The API stores only the mode (system/dark/light); a server field needs an OpenAPI, migration, sqlc and Go change that I could not test here (no Go suites). The mode is saved by the server as before, and also cached in the browser so the first paint is right. Follow-up task: add `theme_name` to preferences.
- **`--ds-color-selection` use:** the row under the j/k cursor. A selected row is reverse video (primary + on-primary), as the brief says. Say if selection should be the selected-row fill instead.
- Derived tokens (divider, tints, on-tone) follow a fixed rule, written in tokens.md.
- Apps follow `v1`; this work is built from `next-version` on the owner's explicit instruction, before promotion.

## Not run / not available
- `design_system.py visuals next-version --apply`, `docs_fold.py note`, `docs_check.py --strict`: the luismc-docs tooling is not in this sandbox. The change note was written by hand in the repo's format; the gallery is not rebuilt (run it before promotion).
- `scripts/delivery/fast_guards.py`: typecheck passes; secret-scan (gitleaks missing) and Go lint (toolchain version) fail for sandbox reasons.
- e2e DOM layout at 360/393/1300 px not run (no e2e by instruction); CI will.
- Node 22 here (repo wants 24): two export tests (`AuditLog`, `ConfigExport`) fail on main too.
- Git hooks in `.githooks` are not executable in this checkout, so git ignored them.
