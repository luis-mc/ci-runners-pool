# LOOK44 report: the Help page

Branch: LOOK44-help-page, from origin/CRSP208-release-48. Branch-only file; never in a pull request for the default branch.

## Step log
- [x] Setup: pnpm install frozen; golangci-lint v2.15.0 installed; gitleaks v8.24.2 installed (module path github.com/zricethezav/gitleaks/v8); `core.hooksPath=.githooks` was set by the repo's `prepare` script, not by hand; hooks were already executable.
- [x] Shared parts in packages/ui (`Help.tsx`): job path (component 64), stepper (65), term help (66); optional `id` on Pane and Card; optional `help` on a Facts row and a LevelBar.
- [x] Help page at /help (`apps/web/src/screens/help/`): stepper over the job path, Questions section with the cards of the step, real slots and load budget from the machine list.
- [x] Menu has 7 items (Help last). First-run Overview shows the picture and Open Help (replaces the How crsp works note).
- [x] ? on Slots (Overview, machine page), Load budget (machine page), Queue (Overview), Runner type (job page), Run elsewhere (Jobs filter).
- [x] Unit tests (Help.test.tsx and updated Shell, Overview, pool tests); e2e spec help.spec.ts; UX-4 guard leaves the term-help buttons out.
- [x] Docs: next-version components 64 to 66, CHANGES C6 to C8, content Help words, web-console spec and change note.
- [x] E2E gate (DL-88), full run, in the background (21 min, 3195 passed). First run failed 10 cases:
  - mine, fixed: jobs toolbar gap next to the ? (`design-layout` jobs, jobs empty, `ux layout` /jobs, /jobs/running: the ? had its own margin, now only in a fact row or level name); the menu-count case in `design-layout.spec.ts` (6 to 7); my help.spec slots number (fixture has 1 slot in use).
  - not mine: `ux wordBroken: /jobs/insights` (data, stress, empty): "Guardrails is broken over lines". Proved on an unchanged origin/CRSP208-release-48 worktree (built the same way): the same 3 cases fail there, 18 others pass. The cause: the Do next table did not set `oneLine` although its columns declare fit and grow kinds, so the Area cell lost its width to the wide first column and broke "Guardrails". Fixed with `oneLine` on that table (one line, `DoNext.tsx`); all 294 insights cases pass. A fix of the release head, needed because the pre-push hook only accepts a fully passing e2e run.
  - Rerun of the fixed cases (help.spec, design-layout jobs and menu, ux-routes /jobs and /help): 75 passed.
- [ ] Push, draft PR.

## Decisions to check
- Later steps of the stepper are grey until the tour has been there (as in proposal I). A link ending in a card (`/help#q-slot`) opens its step. A read-only tour has no Review or Done step (UX-30 is for work that changes something).
- Boxes of the job path are HTML buttons (not SVG): their names are their visible words, so the a11y label-content-name check holds. The `Element` fix in Navigation.tsx and RowKeys.ts is in anyway (SVG targets).
- Phosphor dark is already the default theme and mode (`DEFAULT_THEME_ID`, tokens root is dark); nothing changed.
- The tray app and Doctor are explained on the step "Looking after the pool".
