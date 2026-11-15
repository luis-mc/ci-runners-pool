# LOOK2 report (branch only; not part of the pull request scope)

Task: console look = TUI panes frame + six themes. Owner decisions LOOK D1/D2 (2026-11-15).

## Done
- Step 1: theme data (`scripts/design/themes.data.ts`), CSS generator, tokens.css theme blocks, guard `scripts/design/themes.test.ts` (every theme defines every token, AA 4.5:1 text, 3:1 border, no drift).

## Notes
- All owner palette values passed AA as given; none changed.
- Derived: divider = 30% border into surface; tint = 14% (dark) / 12% (light) tone into surface (lowered until the tone reads 4.5:1 on it); on-<tone> = on-primary, else white, else black.
