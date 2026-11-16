# CRSP124 report: first-run UX

Branch `CRSP124-first-run-ux`, base main 10c39e9 (RELEASE-22). Branch only; never in the PR to main.

## Verified on main (not redone)
- CRSP121 setup state and banner: `GET /setup` steps, banner in Shell reads it.
- CRSP120 controller joins its own PC: `FirstMachineDone` in Setup.
- CRSP125 repo sync/admin flags: `user_is_github_admin` in Repositories.
- CRSP128 runner records and machine names: Runners Machine column reads `machine_name`; failed runner shows `failed_reason` + Remove.
- CRSP127 Linux on Windows in AddRunners: `machineSupports`, `runnerKind`.

## Findings: state on main and plan
| # | State on main | Plan |
|---|---|---|
| 1 | Header read `/machines` once per `machines` event; "no machines" shown | header reads the same list as Overview and Machines, refreshes on a timer too |
| 2 | Overview reads live snapshot; controller wires `overview.EmptySource{}` so machines is always empty (cmd/crsp/areas_wiring.go) | Overview reads the machine list (one source, UX-19); Go source left as is, noted |
| 3 | Banner reads setup once per route/event | refresh on focus and while a step is open; banner names the open step and its action |
| 4 | done on main (CRSP128) | none |
| 5 | reason + Remove exist on managed failed rows | add a Needs-you note above the table with the next action |
| 6 | light runners unexplained | Note on Runners and on Turn on Done step |
| 7 | CheckRow draws help and reason | one line only |
| 8 | server default `persistent` only (machines R5.22) | Note with action on the machine page for usable but unticked backends |
| 9 | Remove alone under Save; budget fields in a cluster | Remove in its own card with what goes; budget fields in a grid |
| 10 | Add runners offers An organization for any account | offer only installed organizations (`/github/installations`) |
| 11 | single repository not preselected | preselect when one |
| 12 | labels default `self-hosted` | default from the repo's RUNS_ON_* value |
| 13 | steps wrap in narrow frame | wide frame, one-row step bar |
| 14 | dead-end note | Install the App button, new tab, refresh on return, `setup_action` handled on /repositories |
| 15 | notes without action | every Note/Problem gets an action |

## Log
