# CRSP108 report (branch only)

Task: R5.26 fork guard in the job-started hook + hook test; R5.33 offline runner cleanup yes path (API, CLI, console).

## Plan
1. `internal/hooks/forkpr.go`: guard read from the event payload, run first in `crsp hook job-started`. Policy env `CRSP_ALLOW_FORK_PRS=1`; absent = off. Visibility unreadable = public.
2. Tests: `internal/hooks/forkpr_test.go`, `packaging/hooks/hooks_test.go` (sh run for real, ps1 by text and by pwsh when present).
3. `DELETE /api/v1/runners/{runnerId}/registration` (confirm), service `DeleteOfflineRegistration`, CLI `crsp runner delete-offline`, console action on runners screen.
4. Spec text, change notes, design-system next-version content + CHANGES.

## Status
- [x] 1  - [x] 2  - [x] 3  - [x] 4 (docs_check.py not found in this sandbox: not run; change notes written by hand)
