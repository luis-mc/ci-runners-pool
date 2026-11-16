# CRSP158 report: keyboard

Branch CRSP158-keyboard. Status: code done.

- `packages/ui/src/components/Navigation.tsx`: `ArrowNavigation`, `handleNavigationKey`, `focusStops`, `nextStop`. Mounted once in `apps/web/src/shell/Shell.tsx`.
- `packages/ui/src/components/SearchList.tsx`: search box, filtered list, arrow movement, Enter. Palette uses it; opens with focus in the box.
- `shortcuts.ts`: j/k removed from `handleKey` (owned by `ArrowNavigation`); shortcut list words updated.
- UX-57, component 38 and CHANGES C53 in next-version; web-console spec and change note CRSP158.
- Tests: Vitest with user-event (devDependency added to ui and web, lockfile updated); e2e keyboard spec updated, not run here.
- D9/D10 are not in decisions.json (it holds D1 to D3); the rule text came from the task brief.
