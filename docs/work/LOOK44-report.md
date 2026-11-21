# LOOK44 report: the Help page

Branch: LOOK44-help-page, from origin/CRSP208-release-48. Branch-only file; never in a pull request for the default branch.

## Step log
- [x] Setup: pnpm install frozen; golangci-lint v2.15.0 installed; gitleaks installed from github.com/gitleaks/gitleaks (the path in the brief did not resolve); `core.hooksPath=.githooks` was set by the repo's `prepare` script, not by hand; hooks were already executable.
- [x] Shared parts in packages/ui (`Help.tsx`): job path (component 64), stepper (65), term help (66); optional `id` on Pane and Card; optional `help` on a Facts row and a LevelBar.
- [x] Help page at /help (`apps/web/src/screens/help/`): stepper over the job path, Questions section with the cards of the step, real slots and load budget from the machine list.
- [x] Menu has 7 items (Help last). First-run Overview shows the picture and Open Help (replaces the How crsp works note).
- [x] ? on Slots (Overview, machine page), Load budget (machine page), Queue (Overview), Runner type (job page), Run elsewhere (Jobs filter).
- [x] Unit tests (Help.test.tsx and updated Shell, Overview, pool tests); e2e spec help.spec.ts; UX-4 guard leaves the term-help buttons out.
- [x] Docs: next-version components 64 to 66, CHANGES C6 to C8, content Help words, web-console spec and change note.
- [ ] E2E gate (DL-88) in the background: result below.
- [ ] Push, draft PR.

## Decisions to check
- Later steps of the stepper are grey until the tour has been there (as in proposal I). A link ending in a card (`/help#q-slot`) opens its step. A read-only tour has no Review or Done step (UX-30 is for work that changes something).
- Boxes of the job path are HTML buttons (not SVG): their names are their visible words, so the a11y label-content-name check holds. The `Element` fix in Navigation.tsx and RowKeys.ts is in anyway (SVG targets).
- Phosphor dark is already the default theme and mode (`DEFAULT_THEME_ID`, tokens root is dark); nothing changed.
- The tray app and Doctor are explained on the step "Looking after the pool".
