# CIX22 report: web console screens for insights

Branch `CIX22-insights-screens` (base `CIX-integration` + `CRSP210-table-cells-fit`). Retry run; lint fix applied
(golangci-lint v2.15.0 built with go1.27.4, `which golangci-lint` = `$HOME/go/bin/golangci-lint`).

## Status

In progress. Updated after each push.

## Screens built

(none yet)

## Design-system checklist

(filled at the end)

## Tests and times

(none yet)

## Contract gaps / notes

- Jobs API has no `runner_origin` filter: the Run elsewhere filter filters in the browser.
- Answers are mocked in `screens/insights/mock.ts` until CIX21 joins; the join deletes that one file and points
  `screens/insights/api.ts` at the client.

## Left

(see below at the end)
