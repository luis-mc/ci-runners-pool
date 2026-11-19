# RES21: design-system audit of the console

A study. No product code was changed. Base: `CRSP187-integration` (RELEASE-42). Run on 2026-11-19.
Screenshots: [index.html](index.html), `shots/`. Raw findings (one JSON line per breach and page): `audit-findings.jsonl`. The audit spec: `ds-audit.spec.ts` (report only, kept out of `e2e/tests/`, so no gate runs it; copy it to `e2e/tests/web-console/` and run it with the normal config, `AUDIT_OUT` and `AUDIT_SHOTS` set).

## 1. What was audited

- Rules read: `docs/design-system/next-version` (the draft that holds UX-63 to UX-72, components 38 to 57 and CORE-1..7) and `v1` (the folder the guards enforce, see G1). Checkable promises are listed in section 6.
- Routes: all 44 route patterns of `routes.ts` (with not-found), each in data, empty, failed (500) and loading state, at 360, 393 and 1300 px, Phosphor dark and light. Data was richer than the guard fixtures: 6 machines (long host name, offline, stopped, needs recovery, controller), 7 runners (failed with a long reason, offline, unclean, unmanaged, long name).
- Interactive states: edit screens (machine, runner x2, repository, image, six Settings tabs, pool size) after a change; the Add runners wizard at review, running, stopped, failed, done and done after reload; the other wizards (add machine, turn on, first run, update review, pool size) at step 1 and step 2.
- Themes: Tokyo Night, Catppuccin, Gruvbox, Solarized and Nord, dark and light, at 1300 px on six screens (contrast and overlap only).
- Not reached with the fixtures: wizard states loading, first-run, planning and paused for every wizard (the wizard-behaviour guard drives those in jsdom); the first-run wizard past step 2; a real touch pointer (the key-hint bar shows at 360 and 393 here because the browser is a narrow desktop).

## 2. Guard results (existing guards, this branch)

| Guard | Result |
|---|---|
| `scripts/design/*.test.ts` (vitest: action-bar, contrast, design-system-follow/freeze/layout, dom-layout-judge, no-app-css, raw-controls, raw-inputs, themes, wizard-behaviour) | pass, 11 files, 127 tests |
| `ux-static`, `ux-keyboard`, `ux-look` | pass, 62 tests |
| `ux-routes`, `ux-jobs-rows`, `ux-run-page`, `ux-caret`, `design-layout`, `design-layout-fields`, run with `UX_NOFIXME=1` | pass, 855 passed, 2 skipped, 0 failed |

Every existing guard is green on the build that shows the breaches below.

### Known lists (`scripts/design/*.known.json`)

All seven lists are empty: `action-bar`, `contrast`, `layout`, `no-app-css`, `raw-controls`, `raw-inputs`, `wizard-behaviour`. No known breach is open, so nothing is "still real" or "to remove". `ux-fixme.ts` is empty too. The three owner breaches are in no list.

## 3. Breaches

Severity: high = unusable or hides content; medium = clearly wrong; low = cosmetic. Widths and themes: dark and light gave the same result for every row unless said.

| ID | Screen and route | Width, theme | Rule or component | What is wrong | Shot | Sev | Likely cause | Proposed fix |
|---|---|---|---|---|---|---|---|---|
| B01 | Machine page `/pool/machines/:id` | 360, 393, 1300; dark, light | UX-42, UX-71, component 48 (EditBar "never scrolls away") | The Save bar is not in the window: at the top of the page it is at y 2759 of a 3002 px page; half way down it is at 1648 to 1831 in a 780 px window. It only shows at the very end. **Fix running (OPS46).** | B01 | high | `apps/web/src/screens/machines/Machines.tsx:534-540`: `EditBar` is the last child of a short `<Stack gap="tight">`, which is its sticky containing block; `packages/ui/src/components.css:201` | See T1: one fix in the shared bar |
| B02 | Repository page `/repositories/:owner/:name` | 360, 393; dark, light | UX-42, UX-71, component 48 | Same class as B01: at the top of the page the Save bar is at y 886 of a 780 px window; it only appears after the user has scrolled. | B02 | high | `Repositories.tsx:963` (`EditBar` inside a Stack), `components.css:201` | T1 |
| B03 | Jobs `/jobs`, `/jobs/running`, `/jobs/done`, `/jobs/charts` | 360; dark, light | UX-42, component 5 and 48 | The action bar (Add runners, Export CSV) starts at y 741 and ends at 810 in a 780 px window: its lower 30 px, with the button edge, is outside the window at the top of the page. | B03 | medium | `--ds-keyhints-height` is a fixed 44 px (`components.css:194`) but the key hints wrap onto two lines at 360, so the bar's bottom offset is too small; plus the Stack/containing-block cause of B01 | T1 |
| B04 | Runners `/pool/runners` | 1300, 360; dark, light | UX-72, component 57, component 7 | The Remove button breaks inside its word: `Rem / ove`. Delete registration breaks too (1300) and wraps onto two lines at 360. **Fix running (OPS47).** | B04 | high | `Runners.tsx:275` raw `Button` in a table column without a width; `Button` is `white-space: nowrap` only at some selectors (`components.css:476-523`), the cell is narrower than the word | T2 |
| B05 | Runners `/pool/runners` | 1300; dark, light | UX-72, UX-69 (heads on one line, same edge), CORE-1 | Rows are 151 px high (one is 88 px); the Isolation cell is five lines ("persistent, state kept between jobs / linux x64, persistent / Persistent. Keeps dependencies: yes"). Heads sit on different baselines (Name, Isolation, State are higher than Labels, Current job). The state cell stacks the word and the reason; the reason is cut at "no usable backend" and its "Full error" button is drawn half outside the row. **The `failedno usable...` text is part of OPS47; here it is stacked, not glued, with these fixtures.** | B05 | high | `Runners.tsx:225-262` (columns have no `fit` or `grow`), `Table.tsx` | T3 |
| B06 | Overview `/` | 360, 393, 1300; dark, light | UX-51, CORE-7 | A long machine name (`mac-studio-ci-runner-with-a-very-long-hostname-01.local`) is cut at the card edge and its second line overlaps the next text (status word and glyph, Memory row). The card title-over-Section-title case of the owner (**fix running, OPS48**) was not reproduced with six cards; this is the same area. | B06 | medium | `apps/web/src/screens/overview/Overview.tsx` machine card; link has no wrap rule (`overflow-wrap`) | T4 |
| B07 | Overview `/` | 360, 393, 1300; dark, light | UX-51 ("long names stop at two lines") | The same name crosses the card border instead of stopping at two lines. | B07 | medium | same | T4 |
| B08 | Pool size `/pool/size` | 360 (393 for the long name); dark, light | Component 57, UX-72, content.md "Row action words" | The row buttons read `Open <machine name>`; the name is already in the row, the word list says only `Open`. At 360 the long name breaks inside words (`mac-studio- / ci-runner-with-a- / very-long- / hostname-01.local`). | B08 | medium | `apps/web/src/screens/pool/PoolSizePage.tsx:41` | T4, T5 |
| B09 | Settings, Access (also the same table in Users and App) | 360, 393, 1300; dark, light | UX-72, component 57, content.md "Row action words" | The row buttons are `Edit` and `Remove`; Runners add `Replace` and `Delete registration`. Content.md lists only Open run, Open, Open job, so the rule "same words for the same action in every list" has no word for these. | B09 | low | `content.md` Row action words; `Runners.tsx`, Settings tables | T5 |
| B10 | Settings, Access | 1300; dark, light | UX-72 (rows of one list have the same height) | Rows are 46 px and 69 px high. | B10 | low | Settings table cells without `fit`/`grow` | T3 |
| B11 | Settings Access, Users, App | 360, 393; dark, light | Component 7, UX-16 | `Set up parity for this repository` wraps onto two lines inside its button. | B11 | low | long label in a full-width button; no short label | T6 |
| B12 | Repositories `/repositories` | 360; dark, light | Component 12 | The chip `Active types: Private (default)` wraps onto two lines. | B12 | low | `ds-chip` has no nowrap/ellipsis rule | T6 |
| B13 | Turn on, empty `/repositories/turn-on` | 360, 393 | Component 7 | `Install the App on a repository` wraps onto two lines. | B13 | low | as B11 | T6 |
| B14 | Settings Access, Users, App; Repository | 360, 393; dark, light | UX-3 | Words in capitals (`FINGERPRINT`, `LIGHT`) in a message are broken inside the word. | B14 | low | `overflow-wrap: anywhere` on `.ds-message__body` (`components.css`, several rules) | T6 |
| B15 | Charts `/jobs/charts` | 360, 393; dark, light | UX-72 spirit (short values are never cut), UX-17 | Heatmap day names are cut: `Mon…`, `Tue…`, `Wed…`. | B15 | low | heatmap label column too narrow (`Viz`) | T7 |
| B16 | Doctor `/doctor` | 360, 393; dark, light | UX-6 | A finding's file path is cut with an ellipsis (`.github/workflows/ci…`) with no way to read it whole on the card. | B16 | low | `Doctor` finding card | T7 |
| B17 | Overview, empty | 360, 393, 1300 | UX-3, CORE-3 | The link `Shared Pool` touches the next word (gap 0 px) in the empty state text. | B17 | low | missing space around a `Link` inside a sentence, `Overview.tsx` empty text | T7 |
| B18 | Repository `/repositories/:owner/:name` while loading | 393, 1300 | UX-17 (one h1) | No h1 while the page loads. | B18 | low | `RepositoryDetail` renders the title only after the data | T7 |
| B19 | Phone key-hint bar, all screens | 360 | UX-16, component 41 | The hint bar wraps onto two lines (`j / k Move` drops down) and is taller than the reserved 44 px, so it overlaps the bar above it by the extra line. Not drawn on a real touch pointer. | (B03 shows it) | low | `--ds-keyhints-height: var(--ds-target-min)` (`components.css:194`) | T1 |
| B20 | Code hygiene: top menu | all | UX-2, no-app-css | The class `active` on `a.ds-topmenu__link` has no rule in the shared stylesheet (state is drawn by `aria-current`). 4 more `ds-*` hook classes have no own rule (`ds-header__live`, `ds-header__status`, `ds-status__glyph`, `ds-status__word`, `ds-page-header__text`): harmless, but the no-app-css guard cannot tell. | none | low | `packages/ui/src/components/Navigation.tsx` | T8 |

Checked and **not** reported as a breach (looked at the shot, the measure was wrong): "sticky bar covers last row" on Jobs, Charts, image page at the bottom of the page (the shots show the last row above the bar; the measure counted the hidden tables' text); the Policy pane of a repository at 360 (the border seen through the bar was the bar's own top border: pane 1013 px, not clipped); the literal text `${{ vars.RUNS_ON_LIGHT }}` on the repository page (it is meant). `Commands Ctrl+K` is one row (label and key), not a wrap.

Counts: **20 breaches: 4 high (B01, B02, B04, B05), 4 medium (B03, B06, B07, B08), 12 low (B09 to B20).** The three owner breaches: UX-42 Save bar = B01 (fix running, OPS46); Remove wrap and state cell = B04 and B05 (fix running, OPS47); titled Card over the Machines title = B06 area (fix running, OPS48; the exact overlap did not reproduce with these fixtures).

Areas with **no breach found** (measured on every route, every state, 360, 393, 1300, dark and light):

- Text contrast: 766 pages judged, every text box over its real background: no pair under 4.5:1 (3:1 large) in Phosphor, and none in the five other themes on six screens (`themes.test.ts` and `contrast.test.ts` agree).
- No sideways scroll of the page; no `overflow-x` box; one h1 in data, empty and failed states; one primary per page; the primary is in the action bar (UX-71) on every screen the audit reached; Select all N and Clear; touch targets at 393 px; status always word and glyph (UX-58); no raw control outside a `ds-` part; no browser alert, confirm or prompt; no `NaN`, `undefined` or `[object` text.
- Focus: a Tab walk of up to 60 controls on 20 screens found no control without an outline or shadow. The walk is a sample (data state, dark, 393 and 1300 px only).
- Inline styles: only the data-driven grid placement of the job graph and the caret font of `CaretInput`; nothing for layout or colour by hand.

## 4. Why the existing guards missed each class

| Class | Why no guard caught it | Guard to add or extend |
|---|---|---|
| Sticky bar not sticky (B01, B02, B03) | `action-bar.test.ts` reads the JSX (a primary outside `<ActionBar>`); it never renders the bar. `ux-routes` measures at scroll 0 and never scrolls. The fixtures give short pages, and the bar is inside the window on a short page. | Add the audit's `stickyWalk` to `ux-routes.spec.ts`: on every page with `.ds-action-bar` that scrolls, the bar is inside the window at scroll 0, 50% and 100%, and the last text ends above it. Use a stress fixture that makes the page long. Component 48 names `action-bar.test.ts` as its guard: extend its Guard line. |
| Words broken, buttons wrapped (B04, B11 to B14) | No check reads text lines. `touch` measures a box, `tableHead` checks heads only. | Add `wrapped` and `wordBroken` measures (per text node, line tops, and per word with a `Range`) to `ux-guards.ts`; run them on every route and state. |
| Overlap of text, titles and borders (B06, B07) | `dom-layout.ts` has overflow, gap and edge rules; none intersects two text boxes or a text box with a pane border. `paneButtons` checks only buttons on a pane border. | Add `textOverText` and `textOverBorder` (ignoring fixed and sticky bars and visually-hidden text) to `ux-guards.ts`. |
| Rows of different height (B05, B10) | `ux-jobs-rows.spec.ts` judges Jobs lists only; no other table is measured. | Extend the rows measure to every table at 1300 px; for non-Jobs tables report heights, and make `fit`/`grow` mandatory columns. |
| Row action words (B08, B09) | UX-72 cites `e2e/tests/review/review-layout.spec.ts`; **that file does not exist in this tree** (`e2e/tests/review/` is absent). `parts.test.tsx` checks the part, not each use. | Create the cited spec or change the rule's Guard column to the real file; add a measure for the last-column button words of every table against content.md. |
| Glued words (B17) | Nothing measures the gap between two inline elements. | Add `wordsGlued` (adjacent text nodes on one line with gap under 1.2 px and letters on both sides). It also covers the owner's `failedno usable...` when the word and the reason sit on one line. |
| All of the above, on the owner's real console | The fixtures (`fixtures.ts`) hold one healthy machine and one idle runner with short names. A failed runner with a long reason, a long host name or six machines never renders in any guard. | Make `openRoute` take a stress data set: six machines (long name, offline, stopped, recovery), seven runners (failed with a long reason, offline, unclean, long name), a repository with many policies. Run the new measures on it. |

### Governance findings (owner decision)

- **G1. The guards enforce v1, the rules live in next-version.** `design-system.ts` reads the highest numbered folder (`v1`, approved 2026-11-13, still the project-neutral starter: UX-1 to UX-62, components 1 to 37, no CORE rules, no `none yet` replaced by a guard path). All of UX-63 to UX-72, components 38 to 57, the CORE principles and the Row action words exist only in `next-version`, which says "the apps follow v1 until the owner approves this draft". The owner's rules (UX-42 text, component 48, UX-72) are therefore not what `design-system-follow.test.ts` and the freeze guard check. This is why "the guards are green" says nothing about them. Decide: promote `next-version` as v2 (then the guards read it), or state that v1 is to be regenerated. Needs the owner; no agent can approve a version.
- **G2.** `ux-rules.md` of `next-version` lists `none yet` for UX-13, UX-38, UX-42 and component 5, 7, 20 (they are about the same bar and buttons that broke). Each should name the guard added by T8.

## 5. Proposed fix tasks

Fix once in a shared part, then check each screen with the new guard.

| Task | Scope | Size | Closes |
|---|---|---|---|
| T1 | `ActionBar` / `EditBar` (packages/ui): make the bar stick to the window, not to a wrapper: render it as a direct child of the main column (or `Frame` slot), reserve its height, read the real key-hint bar height (`ResizeObserver`) instead of the fixed 44 px; move `EditBar` out of the `<Stack>` in Machines, Repositories, RunnerPage, ImageDetail, TabForm. OPS46 does the machine page; make it the shared fix. | M | B01, B02, B03, B19 |
| T2 | `Button` (packages/ui): `white-space: nowrap`, `flex: none`, and `min-inline-size: max-content` everywhere; table action columns get `--ds-row-action-width`. OPS47 does Runners; do it in the part. | S | B04, B11, B12, B13 |
| T3 | `Table` (packages/ui) and the Runners, Settings tables: `fit` and `grow` columns for every table, a one-line Isolation cell (the long text goes in the detail), heads on one baseline, rows of one height at 1300. | M | B05, B10 |
| T4 | Machine card and Pool size row: names get `overflow-wrap: anywhere` plus a two-line clamp (`ShortText`); the Pool size action says `Open`. OPS48 does the Overview title case. | S | B06, B07, B08 |
| T5 | Docs: add the Settings and Runners row words (Edit, Remove, Replace, Delete registration) to content.md Row action words and to the guard; fix UX-72's Guard path. | S | B09, G2 |
| T6 | `Message`, `Chip`: no `overflow-wrap: anywhere` on words in capitals or on chips; short labels for the long buttons ("Set up parity"). | S | B11 to B14 |
| T7 | Screens: heatmap day labels, Doctor path (full text under a `Details` button), glued link, h1 while loading on repository. | S | B15 to B18 |
| T8 | Guards: add `stickyWalk`, `wrapped`, `wordBroken`, `textOverText`, `textOverBorder`, `wordsGlued`, rows height for all tables, and the stress fixture to `ux-guards.ts`/`ux-routes.spec.ts` (start from `ds-audit.spec.ts`); fix the missing UX-72 guard file; replace the `active` class by `aria-current`; list the guard paths in `ux-rules.md`. Land it **first**, red, with `ux-fixme.ts` entries per task so each fix removes one. | L | all, B20 |
| T9 | Owner: decide G1 (promote next-version as v2, or regenerate v1). | decision | G1 |

Order: T8 (red guards with fixme lines), then T1, T2 in parallel (shared parts), then T3, T4, T6, then T5 and T7.

## 6. Promises that can be checked on a rendered page

CORE-1 (same thing looks the same: sticky bar, buttons), CORE-3 (one headline), CORE-5 (one primary), CORE-7 (cards share one shape, never touch). UX-4 (one primary), UX-6 (empty and failed say the next step), UX-8, UX-10 (grid, no touching), UX-12 (Select all N), UX-13 (busy), UX-15, UX-16 (360 px, no sideways scroll, 44 px), UX-17 (contrast, focus, one h1), UX-25, UX-26, UX-29, UX-37, UX-38, UX-42 and UX-71 (the bar is in the window, reserved height), UX-49 and UX-68 (no scrolling box or nav), UX-50, UX-51 (one card shape, names stop at two lines), UX-58 (word, glyph and colour), UX-60 (themes), UX-61 (isolation word), UX-69 (one frame edge, heads on one line), UX-72 (one row height, fit cells never cut, row action words, label never wraps). Components 5, 7, 8 (pane look), 15 (tables), 41, 43, 46, 48 and 57 state looks that a measure can read. Tokens: `--ds-target-min` 44 px, `--ds-control-height`, `--ds-row-action-width`, contrast pairs.

The audit measured all of these except UX-13, UX-29 (needs a live job) and the wizard rules of UX-5, UX-30 and UX-54 beyond what the wizard-behaviour guard already drives.
