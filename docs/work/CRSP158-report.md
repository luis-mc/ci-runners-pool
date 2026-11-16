# CRSP158 report: keyboard

Branch CRSP158-keyboard. Status: started.

Plan:
1. `packages/ui/src/components/Navigation.tsx`: page-level arrow navigation (`ArrowNavigation`, `handleNavigationKey`, `focusStops`), used once in the shell.
2. `packages/ui/src/components/SearchList.tsx`: search box + filtered list + arrow movement + Enter; exported.
3. Palette uses SearchList; focus starts in the search box.
4. Shell: `handleKey` drops its own j/k; ArrowNavigation owns it.
5. UX-57 in next-version, CHANGES entry, web-console change notes.
6. Tests: user-event (devDependency added to ui and web, lockfile updated).
