# LOOK41: Jobs section redesign (report)

Branch `LOOK41-jobs-redesign`, from `origin/CRSP208-release-48`. Branch-only file (never in the PR for the default branch).

## What was built
- Jobs has six tabs in UX-74 order: Overview, Live, Done, Run elsewhere, Run insights, Charts. `/jobs` is the Overview.
- Overview (`apps/web/src/screens/jobs/Overview.tsx`, `overviewStats.ts`): four stat tiles (Waiting now, Wait slow end (p90), Jobs that passed, Pool busy), each a link with its change against the previous 7 days and a sparkline; the Needs you strip (top 3 findings of Run insights by minutes a week); cards Where the time goes, Busiest repositories (bar list), Failed jobs, Run elsewhere.
- One unified list for Live, Done and Run elsewhere (`JobsHome.tsx`): state filter All, Queue, Running, Done; search box (free words, `repo:`, `state:`, `runner:`, `branch:`, `job:`); details button with the panel-right SVG icon, named and titled *Show details* / *Hide details*; right panel with the facts of the chosen row; phone: sheet at the bottom. Runs | Jobs switch kept. Done adds Range and one *Group by* choice (None, Repository, Machine, Runner, Runner type, Job type) in place of the five By tabs. Run elsewhere = the same list over `runner_origin: other` jobs, naming runner, group and labels.
- Old addresses redirect and keep their query: `/jobs?<filter>` to Live (state Queue), `/jobs?elsewhere=1` to Run elsewhere, `/jobs/running` to Live (state Running), `/jobs/repository|machine|runner|runner-type|job-type` to Done with `group=`, `/jobs/trends` to Charts. `/jobs/:id`, `/jobs/run/:runId` and the insights routes are unchanged. Insights and Charts are as built in RELEASE-48.
- Keyboard: Up, Down, `j`, `k` already walk every stop in the shell; now they accept an SVG target (`instanceof Element`, in `Navigation.tsx` and `RowKeys.ts`). Focus starts in the search box (`SearchBar autoFocus`).
- Theme: Phosphor dark is already the default (`DEFAULT_THEME_ID`, `DEFAULT_THEME_MODE`, `public/theme-init.js`, pinned by `parts.test.tsx`); no change needed.
- Cells wrap (C1/UX-72); the full text is one press away: the row opens the details panel with every value whole, and a long reason keeps its Why/Details button.

## Shared parts used or added
- Added to packages/ui: `SearchTable` (component 64, new; also `parseSearch`, `matchesSearch`), `StatTile` + `StatGrid` (58), `FindingList` strip variant (59), `BarList` (60). `Table` gained `current` and `onSelect`; `SearchBar` gained `autoFocus`. CSS: `ds-search-table`, `ds-side`, `ds-panel-toggle`, `ds-stat*`, `ds-bars*`, `ds-findings*` in `components.css`.
- Reused: Table, RowKeys, ArrowNavigation, ListToolbar, SearchBar, Segmented, Tabs, Pane/Section/Card/CardGrid, Facts, Status, Sparkline, Load, ActionBar, ExportButton, LinkButton, Empty, Text.
- Docs: next-version `components.md` (58 to 60 marked built, new 64), `ux-rules.md` (UX-74), `content.md` (Jobs list words), `CHANGES.md` C6 and C7, `README.md`; feature spec `docs/features/web-console/spec.md` section 4.6 and change note `changes/LOOK41.md`.

## Where the unified list overrode concept A
- Concept A had Live (queued, then running) and Done as two lists with their own filter chips (Queued, Running, No runner). The owner's option 11 wins: all three tabs are one list with the state filter All, Queue, Running, Done. Live opens on All (so it also shows the latest finished rows after the running ones), Done opens on Done, and every filter works on every tab. UX-74 and content.md say so (C7).
- The "No runner" chip is gone (the wait reason is in the row and in the search: `state:waiting`).
- The columns of the All list drop Commit and Event (runs) and Runner and machine (jobs) so a row stays one line at 1300 px with the table inside its pane; they are in the details panel.

## Checks run
- vitest: `packages/ui` full (27 files, 216 tests), `apps/web` jobs, insights, pool, shell, settings; new tests `SearchTable.test.tsx`, `overview-parts.test.tsx`, `unified.test.tsx`, `overview.test.tsx`, updated `Jobs.test.tsx`, `elsewhere.test.tsx`, `redirects.test.tsx`.
- `tsc --noEmit` and eslint for packages/ui and apps/web; prettier on touched files.
- `scripts/design` suites (no-app-CSS, raw controls, action bar, layout, contrast, wizard behaviour, DS follow): 11 files, 128 tests green; no known-list entry added.
- `docs_check.py --strict`: the only error is W1 (this report under docs/work, branch-only by design).
- `scripts/delivery/fast_guards.py`: same result as the release head (G1, G4 and G5 breaks are old; secret-scan reports 5 leaks in ancestor commits of the release branch; `gitleaks` on `origin/CRSP208-release-48..HEAD` finds none).
- Playwright (targeted, before the gate): jobs-doctor, ux-jobs-rows, ux-table-cells.

## E2E results
(filled in after the gate)

## Failures proven on the release head
(none yet)

## Open questions
- Runner timeline card (component 61), the stacked trend chart (63) and Cell full-text (62) are not built: the Overview has no timeline card. Needs a slot-log API and a task of its own.
- Findings carry no confidence word in the contract (`InsightFinding`), so the Needs you strip shows minutes and fix only. Run insights still reads mock data (RELEASE-48), so the strip is only as real as that.
- Overview range is fixed at 7 days against the previous 7 (the study asked the owner for a range choice and a default). Pool busy = slots in use of the slots of online machines.
- The search words live in the page, not in the address: an address change at every key redrew the page and dropped focus in the real browser (found by the e2e run).
- The phone details panel is a fixed bottom sheet drawn by CSS (as in the option 11 prototype), not the shared Dialog: Dialog is modal with Cancel, the panel is a view that stays beside the list (UX-43 anchored form). Say if it should be the Dialog sheet.
- Done rows in the All state are not filtered by origin (as before); Queue and Running rows of other runners show only in Run elsewhere.
