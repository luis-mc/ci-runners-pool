# CRSP162 report: repositories screens in panes

Branch `CRSP162-repositories`, base `865788d`. Area: `apps/web/src/screens/repositories/*`.

## Plan
1. List: toolbar + table + pager in Pane "Repositories"; Active types chip; one primary; Select all N + Clear always shown.
2. Detail: one page form, one Save (policy + hosted fallback in one PATCH, packages by PUT only when changed); h1 kept in failed state; every section a Pane.
3. Turn on the pool wizard: bodies in panes; "no repository is free" names the real next action (CRSP139/148 logic kept).
4. Vitest per state, Playwright route spec, change note web-console.

## Status
- [ ] list  - [ ] detail  - [ ] wizard  - [ ] tests  - [ ] e2e  - [ ] docs

## Not mine
- Table fold to two lines at 360 px is CSS in `packages/ui` (CRSP157). The list passes `data-label` columns to the shared Table only.
