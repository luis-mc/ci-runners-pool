# CRSP160 report: setup, overview, jobs

Branch CRSP160-setup-overview-jobs, base 865788d. Area: screens/setup, overview, jobs.

## Findings before coding
- Shell banner (CRSP159 area) already asks the repository list (`pool=on`) and clears; Setup page itself read only `steps.first_repository`, so its checklist kept step 3 open with the pool on. Fix: same check in the Setup loader.
- `Section` already renders a Pane; Overview loading/failed and Jobs filters/empty were outside one.
- Axis rows have no reverse-video rule (packages/ui, CRSP157 area): not touched, Jobs queue Table has it.
- A console-minted setup link needs a controller endpoint (Go, out of area); the tray's Open is the in-console way offered.

## Plan
1. Setup: done state primary "Open the overview"; no `crsp open` text; repo check.
2. Overview: Pane for every state, no command buttons.
3. Jobs: filters Pane, history Pane, empty "Add runners" once, h1 in detail failed state.
4. Vitest, Playwright, change notes.

## Status
(in progress)
