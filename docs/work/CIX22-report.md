# CIX22 report: web console screens for insights

Branch `CIX22-insights-screens` (base `CIX-integration` + `CRSP210-table-cells-fit`). Retry run. Lint fix applied:
golangci-lint v2.15.0 built with go1.27.4 (`which golangci-lint` = `$HOME/go/bin/golangci-lint`); the pre-push hook
ran golangci-lint "0 issues" and was never bypassed.

## Screens built

- **Run insights tab** (D8): `/jobs/insights`, placed right before Charts. Segment row (component 12): Do next,
  Waits, Timeline, Tests, Guardrails; repository chips kept across segments (UX-31). Charts stays as it was (the
  spec's segment row under Charts is replaced by this tab, per D8; the "Do next pane on Trends" is not built, Overview
  links to the tab).
- **Do next**: ranked table (what to do, project or "the pool", area, saves, since, Open), folded weekly digest,
  empty and not-enough-data words, GitHub limit note.
- **Finding page** `/jobs/insights/finding/:id`: fix, copyable snippet, evidence table, estimate, first/last seen;
  *Review the change* as the one primary only for setup fixes, *Open the workflow on GitHub* as a normal button
  otherwise; no dismiss.
- **Waits**: trend chart per day (wait, hold, run), tables per repository and per job, range 7/14/30 named.
- **Timeline**: one lane (pane) per runner, crsp and other runners; each lane's segments as a table with idle,
  "idle while a job waited" and "after-merge work" notes; range 1/6/24 hours. No shared bar component exists, so the
  text equivalent is the screen (no hand-made bars).
- **Tests**: Slowest, Flaky, Duplicated, No assertions; "over the {kind} limit of {n} s"; empty words.
- **Guardrails**: project x G1..G7 table with word + glyph, source, sparkline, Open to the Repository page.
- **Action wizard** `/jobs/insights/finding/:id/change`: shared Wizard (Review, Changing, Done); step, lock, busy and
  Done come from the shared part.
- **Run elsewhere** filter (D7) on Queue and Running: Queue/Running hide jobs with `runner_origin = other`; the chip
  lists them with runner, group and labels. The jobs API has no `runner_origin` filter, so it filters in the browser.
- **Overview line**: "{n} things to do next, about {m} min a week", link, no button (UX-52).
- **Job page**: Runs on fact, steps source and "Last checked with GitHub {ago}" under the waterfall, CPU and memory pane.
- **Run page**: Savings pane (3 lines + Notes for superseded, twice, past first failure).
- **Pool > Size and backends**: Demand section (table, estimates in words, p95 trend).
- **Repository page**: CI checks, Guardrails and Job slots panes (Review the change is a normal button; Save stays the primary).
- Words: `docs/design-system/next-version/content.md` (Run insights words) + `CHANGES.md` C150. Change note
  `docs/features/ci-run-insights/changes/CIX22.md`.
- Mocks: all in `apps/web/src/screens/insights/mock.ts`, read through `screens/insights/api.ts`. The join deletes
  mock.ts and points api.ts at the generated client (types in the contract already exist).

## Design-system checklist (v2)

- [x] Core UX Principles checked: CORE-1 to CORE-7.
- [x] Design system v2; sections used: ux-rules (UX-3, UX-4, UX-5, UX-6, UX-8, UX-13, UX-17, UX-25, UX-26, UX-28, UX-29,
  UX-30, UX-31, UX-33, UX-38, UX-41, UX-52, UX-54, UX-58, UX-62, UX-71, UX-72), components (4 wizard, 8 pane, 12 segmented/chips,
  15 table, 39 code block, 47 disclosure, 52 trend chart, 53 sparkline), tokens (none directly), content (Run insights words).
- [x] Wizard: states come from the shared Wizard (first-run/ready-to-review, running, done, failed). The page passes data only.
  Not rendered in every one of the ten states by a test: tested ready-to-review and done; running/failed/stopped/
  paused/done-after-reload are not reachable with the mocked plan (no stored plan, no Stop in the mock). See Left.
- [x] Shared parts used: Page, PageHeader, Section, Pane, Table, Segmented, Chips, Tabs, Wizard, Disclosure, CodeBlock,
  TrendChart, Sparkline, Facts, Message, Empty, ActionBar, LinkButton, ExternalButton, Breadcrumbs, TextLink, Text.
- [x] No hand-made button, bar, table, tab row, empty box or scroll box; no stylesheet, no `style=`, no new class.
- [x] Enforcement kit: `vitest --project design` green (11 files, 128 tests; no-app-CSS, raw controls, action bar,
  layout, wizard behaviour). No known-list entry added. DOM layout at 360/393/1300 (Playwright, needs the built binary):
  not run locally; the new routes enter `ux-routes.spec.ts` through `screens/jobs/routes.tsx` (routes written inline there).
- [x] New words are in content.md (next-version) with CHANGES C150.
- [x] No rule, token or component changed.

Human check left: the page looks like one frame with its siblings; the words read as a person would say them.

## Tests and times (local, vitest)

New files: `insights/{DoNext,Finding,Views,ActionWizard,OverviewLine,RepositoryPanes}.test.tsx`,
`jobs/elsewhere.test.tsx`, `jobs/insightPanes.test.tsx`; `jobs/redirects.test.tsx` tab list updated.
Last run: insights+jobs+overview+pool+repositories, 22 files, 201 tests passed, 13.6 s total (slowest file well under 10 s).
`pnpm typecheck` and `pnpm lint` (apps/web) clean; root `tsc -p e2e/tsconfig.json` clean. Test guardrails
(`test_guardrails.py`): my files add no break (existing Go breaks only). `fast_guards.py`: guards, lint, typecheck,
change-notes PASS; secret-scan fails only because `gitleaks` is not installed in this sandbox. docs_check: only the
expected W1 (docs/work on the branch).

## Contract gaps / notes

- Jobs API has no `runner_origin` filter: Run elsewhere filters in the browser (Running's runs view cannot be
  classified by origin, so the chip switches to the jobs view).
- Queued jobs have no origin until placed, so a job for the old pool shows in Queue until GitHub reports the runner.
- Tests empty state: spec asks for a link to the guide; no insights guide exists yet, so no link.
- Evidence of a finding is `additionalProperties`, shown as a generic name/value table.

## Left

- Doctor area Workflows (spec 4.8) and Settings > Data > CI data pane (4.9): not built in this pass.
- Charts "Trends" Do next pane (spec 4.1): not built, replaced by the Run insights tab (D8).
- Wizard states running / paused / stopped / failed / done-after-reload not covered by tests (needs the real plan API: CIX21).
- Playwright DOM layout run at 360/393/1300 px: the branch CI run is the gate.
