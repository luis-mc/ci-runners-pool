# CRSP143: UX audit of the web console (read-only, report only)

Branch `CRSP143-ux-audit`, base `058456b` (RELEASE-25). No app code changed. Design system v1 (UX-1..UX-62), look "B TUI panes", six palettes, dark and light.

## Method and what was run

- Built `apps/web` (`pnpm --filter web build`), served `dist/` statically, mocked every `/api/v1/**` call with `e2e/tests/web-console/fixtures.ts` (+ `jobs-doctor-fixtures.ts`). Temporary config used Playwright's Chromium at `/opt/pw-browsers/chromium-1243`; the temporary specs are not committed.
- The event stream is replaced by a fake `EventSource` that stays open, so "Live updates paused" shows on 0 of 546 renders (the earlier run's noise is gone).
- Matrix: 31 routes (from `routes.ts` + not-found) x states (data, empty, failed, first-run for `/` and `/setup`, needs-recovery for machines) x 360, 393, 1300 px x dark, light = **546 renders**, each measured in the DOM (overflow, touch size, h1, main, scroll boxes, nav rows, buttons, text) plus a full-page screenshot. Only the failing screenshots are kept in `docs/work/CRSP143-shots/` (10 files, 248 KB).
- Light theme: `GET /api/v1/me/preferences {theme:'light'}` is applied (`data-theme="light"`, body `rgb(225,226,231)` vs dark `rgb(22,22,30)`) on every signed-in screen. `/sign-in` and `/setup` have no stored theme: they follow `prefers-color-scheme` (light bg when the OS is light), `data-theme` stays unset. Fine.
- Existing checks run: `vitest run scripts/design` = **10 files, 103 tests passed** (no-app-css, raw-controls, raw-inputs, contrast, themes, wizard-behaviour harness with the ten states, design-system follow/freeze/layout; all six `*.known.json` lists are empty). Playwright `a11y.spec.ts` + `keyboard.spec.ts` + `dom-layout-example.spec.ts` against the same build: **77 passed**.
- Not done: the six palettes were not each rendered (only the themes unit test, which is green); loading states were not captured (mock answers at once); `exports-stop`, `notifications`, `jobs-doctor`, `flows` specs were not re-run; overlays, running wizard steps and pager (needs >1 row) were not driven.
- Mock gaps are not findings: several Settings pages show "Try again / No mock for GET ..." because the fixtures lack those endpoints (`/api/v1/backups`, retention, budgets...). Their layout was judged, their failed text was not.

## Summary

| Verdict | Count |
|---|---|
| pass | 18 |
| partly | 10 |
| fail | 5 (UX-4, 6, 12, 16, 18) |
| not testable | 29 |

(Total 62. Earlier run: 15 pass / 6 fail / 17 partly / 24 not testable. This run is stricter: a rule counts as testable only when a DOM fact or a green guard backs it, so some earlier "pass" and "partly" rows became "not testable".)

Measured facts (all 546 renders): horizontal overflow 0; `main` landmark 1 everywhere; scroll boxes 0; native date/time/number inputs 0; `alert/confirm/prompt` in app code 0; h1 count != 1 on three states (below); nav rows: 360 px = **4**, 393 px = 3, 1300 px = 1.

## Per-rule table

Severity: blocker / major / minor. Screens are routes; width and theme in brackets ("all" = 360, 393, 1300, dark and light).

| Rule | Verdict | Screens and states that fail | Width / theme | Evidence | Severity | Smallest fix |
|---|---|---|---|---|---|---|
| UX-1 | partly | Empty states say the next action twice on `/machines`, `/runners`; header button and empty-state button differ in pattern from `/jobs` (none) | all | `CRSP143-shots/machines.empty.360.dark.png`, `jobs.empty.360.dark.png` | minor | One shared empty-state part decides whether the header action shows |
| UX-2 | pass | none | all | no-app-css, raw-controls guards green, known lists empty | - | - |
| UX-3 | pass | none | all | every screen has one plain headline, except the h1 gaps in UX-17 | - | - |
| UX-4 | fail | `/machines/:id` shows 3 primaries (Drain, Save, Review) and a danger Remove; `/repositories/:id` shows 4 (Turn on the pool, Save, Save fallback, Save packages) | all | DOM: `primaries` = `Drain,Save,Review`; `Turn on the pool,Save,Save fallback,Save packages`; `machines_1.data.360.light.png`, `repositories_octo_app.data.360.dark.png` | major | One primary per screen; section saves become secondary buttons or one page Save; name the next one |
| UX-5 | pass | none | all | wizard harness green; step bar seen on add machine, add runners, turn on, pool size | - | - |
| UX-6 | fail | `/setup` when all done: only "Add another machine", no way on; `/setup` first run says "run `crsp open` there" (terminal); `/jobs` empty has no action; failed screens repeat "Try again" in header and body on some | all | text of `setup.data.360.dark`, `setup.firstrun.360.dark`: "choose Open in the tray menu ... or run `crsp open` there"; `jobs.empty.360.dark.png` | blocker | Done state: one primary "Open the overview"; first run: a button that works in the console or a copy of the link, no terminal words; Jobs empty: "Add runners" |
| UX-7 | not testable | - | - | fixtures hold 1 row; needs a count-vs-visible check | - | Guard: DOM test that an action's count equals visible ticked rows with a filter on |
| UX-8 | partly | `/repositories` "Active types: Private (default)" is a link that acts as a filter | all | DOM link text in `main` | minor | Make it a chip button |
| UX-9 | pass | none | - | no `window.alert/confirm/prompt` in `apps/web/src` or `packages/ui/src` | - | Add a source scan as guard |
| UX-10 | partly | Cards seen aligned at 360 and 1300 on repositories; gaps and equal widths not measured on all screens | - | the layout guard lists only `/` (example spec) | minor | List every route in the DOM layout spec |
| UX-11 | not testable | - | - | one row per list | - | Guard: fixture with 60 rows, assert pager and "See all N" |
| UX-12 | fail | `/runners` has no Select all / Clear; `/repositories`, `/repositories/turn-on` have it | all | DOM `selectAll=false` on `/runners` (data, 1300 dark); the Runners list has a checkbox column | major | Put Select all N and Clear in the Runners toolbar |
| UX-13 | partly | wizard buttons proven by the harness; other request buttons (Drain, Back up now, Remove) not driven | - | harness green | minor | Guard: click each request button against a slow mock, assert disabled + "running" text |
| UX-14 | not testable | - | - | the paused banner can push content when the stream drops (not driven) | - | Guard: drop the stream in a test, assert the first heading does not move |
| UX-15 | partly | not measured on all screens; settings pages keep a narrow column at 1300 | 1300 | screenshots only for repositories | minor | DOM guard: content width >= 80% of viewport |
| UX-16 | fail | Touch targets under 44 px: `/machines` 5, `/repositories` 6, `/runners` 5 (sort buttons 34 to 42 px wide, row links 16 px high, row checkboxes), `/repositories/turn-on` 2, `/settings/users` 2, every detail page has the breadcrumb link 16 px high; nav takes 4 rows at 360 px; no sideways scroll anywhere (pass) | 360 and 393 (also 1300 for links) | DOM `small` list per render; `repositories.data.360.dark.png`, `runners.data.360.dark.png` | major | Make the shared link, checkbox and sort button hit area 44 px; make the nav one scrolling row or a menu button on narrow screens |
| UX-17 | partly | axe: 0 serious or critical (77 passed). No `h1` on `/machines/:id` failed, `/repositories/:owner/:name` failed and empty | all | DOM `h1: []`; `machines_1.failed.360.dark.png` | major | The failed and empty state of a detail page keeps the PageHeader title |
| UX-18 | fail | `/settings/backups` Backup time shows 03:00 AM with AM and PM buttons (12 h) | all | DOM `ampm=true` x6; `settings_backups.data.360.dark.png` | major | TimePicker 24 h in this use (default 24 h, no AM/PM) |
| UX-19 | not testable | - | - | needs a screen that sets its own running flag | - | Guard: scan for `useState` named running/busy in screens |
| UX-20 | pass | none | all | labels sit above boxes on machine detail, backups | - | - |
| UX-21 | not testable | - | - | no form submitted with bad values | - | Guard: submit empty required fields, assert top list + per-field text |
| UX-22 | pass | none | all | switch, radios (<= 6 rows) seen on machine detail | - | - |
| UX-23 | not testable | - | - | widths not measured | - | Guard: input widths in {short, medium, full} classes |
| UX-24 | partly | Machine detail: Cancel / Save sit mid-page, with the pool size wizard and Remove below | all | `machines_1.data.360.light.png` | minor | One page foot: Cancel left, Save right |
| UX-25 | partly | Table column heads sort (pass). Repositories table has 10 columns, folds poorly at 360 px | 360 | `repositories.data.360.dark.png` | minor | Fold to two lines (shared table part) |
| UX-26 | pass | none | all | Done, Needs you (`◷ Needs you`), Problem tones carry a glyph and a word | - | - |
| UX-27 | not testable | - | - | no button result driven | - | Guard: press a button, assert one line under it |
| UX-28 | pass | none | all | "Could not load machines. The controller could not answer. Try again." says what, why, next | - | Fault-boundary text (`This page hit a fault.`) was not driven |
| UX-29 | not testable | - | - | running states not driven | - | Guard: running job mock, assert bar + reason |
| UX-30 | pass | none | - | wizard harness, ten states, empty known list | - | - |
| UX-31 | not testable | - | - | search bar seen on repositories only | - | Guard: search bar index and distances per page |
| UX-32 | not testable | - | - | no map screen | - | - |
| UX-33 | not testable | - | - | Jobs time axis not driven with many rows | - | Guard: 200-row jobs fixture |
| UX-34 | not testable | - | - | strip not driven | - | Guard: running job, assert strip and progress value shared with page |
| UX-35 | partly | focus visible (a11y spec green); refresh-keeps-focus not driven | - | a11y spec | minor | Guard: stream event while an input has focus |
| UX-36 | not testable | - | - | - | - | Guard: reduced-motion computed durations = 0 |
| UX-37 | partly | Machine detail: Review and Back stack full width (pass); Remove is not full width | all | `machines_1.data.360.light.png` | minor | Card buttons share the card width |
| UX-38 | not testable | - | - | blocked actions not driven | - | Guard: mock a block, assert reason beside the disabled action |
| UX-39 | not testable | - | - | `exports-stop.spec.ts` not re-run | - | Re-run it; add row-count assertion |
| UX-40 | not testable | - | - | no slider in fixtures | - | - |
| UX-41 | not testable | - | - | judgement | - | - |
| UX-42 | not testable | - | - | sticky foot not measured | - | Guard: last row bottom < foot top at 360 |
| UX-43 | not testable | - | - | overlays not opened | - | Guard: open each overlay at 360 and 1300 |
| UX-44 | not testable | - | - | same | - | Guard: close button >= 44 px |
| UX-45 | not testable | - | - | same | - | Guard: Tab trap + scroll lock |
| UX-46 | not testable | - | - | same | - | Guard: Escape closes |
| UX-47 | not testable | - | - | same | - | Guard: role dialog, aria-labelledby, aria-modal |
| UX-48 | not testable | - | - | same | - | Guard: count open dialogs <= 1 |
| UX-49 | pass | none | all | 0 inner scroll boxes in 546 renders; 0 sideways page scroll | - | - |
| UX-50 | not testable | - | - | no hover-only check | - | Guard: emulate touch, assert all controls drawn |
| UX-51 | not testable | - | - | cards not measured | - | Guard: card height per kind |
| UX-52 | pass | none | all | `/` has no command button | - | - |
| UX-53 | not testable | - | - | clock not advanced | - | Guard: fake timer, assert "x ago" changes |
| UX-54 | pass | none | - | wizard-behaviour harness green | - | - |
| UX-55 | pass | none | - | themes.test, contrast.test green, six palettes in `themes.data.ts` (not rendered one by one) | - | Render each palette once |
| UX-56 | pass | none | all | 0 native date/time/number inputs; raw-inputs guard green. (The time picker itself breaks UX-18.) | - | - |
| UX-57 | pass | none | 1300 | `keyboard.spec.ts` green; key-hint bar on every screen | - | - |
| UX-58 | pass | none | all | `✓ online`, `○ off`, `◷ Needs you` seen | - | - |
| UX-59 | not testable | - | - | glow/scanline only on focus not measured | - | Guard: computed box-shadow on unfocused controls |
| UX-60 | pass | none | all | dark default; `theme:'light'` applied on all signed-in screens | - | - |
| UX-61 | pass | none | all | `/runners` has Isolation column with microVM, VM, container, persistent | - | Detail page text not checked |
| UX-62 | not testable | - | - | no destructive question driven | - | Guard: open Remove, assert list of items |

The table is the source of the counts.

## Usability heuristics

1. First run: `/setup` before a link tells the owner to run `crsp open` in a terminal. Not doable in the console. Blocker.
2. `/setup` with every step done is a dead end: one button, "Add another machine", and no link to the overview. Blocker.
3. Machine detail: Drain, Save, Review, Remove and Back/Cancel are all on one page; none says which is next. Repository detail: four primaries. Major.
4. Empty and failed states repeat the next action (header button and empty-state button), or hide it (Jobs empty). Minor.
5. `/runners` lacks Select all although rows have checkboxes. Major.
6. Backups time picker is 12 h. Major.
7. Everything else the owner needs sits in the console (GitHub grant guide, joins, pool on) in the screens seen; "hunting in GitHub settings" appears only as the grant step link, which is guided.

## Top-20 fixes, grouped (one agent task each)

**G1 Setup screen (blocker):** 1. Done state gets one primary "Open the overview". 2. First run without a link: a console action, no `crsp open` text (or a copy button for the link), drop "run ... there".
**G2 Machine detail (major):** 3. One primary (Drain), others secondary. 4. Section Save/Cancel become one page foot. 5. Remove full width inside its card. 6. Failed and empty states keep the h1 (UX-17).
**G3 Repository detail (major):** 7. One primary; three Save buttons become one Save. 8. Failed and empty states keep the h1.
**G4 Shared UI hit areas (major):** 9. Link, checkbox and sort button hit area 44 px in the shared parts. 10. Breadcrumb link 44 px.
**G5 Shell nav (major):** 11. At 360 px the nav takes one row (scroll or menu) instead of four.
**G6 Runners list (major):** 12. Select all N and Clear in the toolbar.
**G7 Backups (major):** 13. 24 h time picker for Backup time.
**G8 Shared empty and failed state part (minor):** 14. Show the next action once. 15. Jobs empty: "Add runners" action. 16. Repositories "Active types" link becomes a chip.
**G9 Repositories table (minor):** 17. Fold to two lines at 360 px.
**G10 Guards (minor):** 18. List every route in the DOM layout spec (now only `/`) and add touch-size, one-primary, h1 and Select all checks. 19. Source scan for `alert/confirm/prompt`. 20. Render the six palettes once and the overlays, running and blocked states in the audit matrix.

## Rules that cannot be tested yet, and the guard each needs

UX-7, 11, 14, 19, 21, 23, 27, 29, 31 to 34, 36, 38 to 48, 50, 51, 53, 59, 62: see the "smallest fix" column of the table; each needs a Playwright spec that drives the state (many rows, a dropped stream, a running job, an opened overlay, a touch pointer, reduced motion, a slow request) and asserts the DOM fact named there. `scripts/design/dom-layout.ts` exists but the example spec lists only `/`, so none of the layout rules runs on real screens today.
