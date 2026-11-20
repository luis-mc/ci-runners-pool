# CIX20 report: insight action plans (branch CIX20-action-plans)

## Built
- `internal/insights/actions/service.go`: `Service` implements `Planner` (R5.10, R6.6).
  - `Plan`: draft from an open finding with an action; changes nothing; names running jobs for a change that lowers slots (UX-62); refuses no-action/resolved findings (`ErrNoAction`), a field of another kind, an unknown finding.
  - `Start`: draft only (`ErrNotDraft` the second time, per-plan lock); each change through the `Setter` of its action kind (setter writes the audit row in its own tx); a failed change is recorded, audited as refused through `Auditor`, and the done ones stay; cancelled ctx gives `Stopped` and skips the rest; states Done / Failed / Stopped.
- `internal/store/insights_plans.go`: `InsightPlans` (`actions.PlanStore`) over the existing plan queries (no query added).

## Tests (go test -race -count=2)
- `internal/insights/actions`: 5 tests, ~1.0 s total (TestNothingChangesBeforeStart, TestPlanRefusals, TestStartWritesAuditPerChange, TestFailedChangeKeepsDoneOnes, TestStopSkipsTheRest). Fakes only, no sleeps.
- `internal/store` TestInsightPlanRoundTrip: ~3.6 s package.
- go vet clean. Test guardrails: no new break (existing >20-row tables are in other files).

## Contract gaps (questions for the orchestrator)
1. Evidence format of actionable findings is not in the contract. Local workaround: `Plan` reads `evidence.changes` = `[{target,target_name,field,from,to,words}]`; CIX12/CIX14 (capacity, waits) must write it for `machine_slots`, `repo_parallel_limit`, `light_lane` (fields `job_slots`, `max_parallel_jobs`, `light_slots`). Confirm or give the real shape.
2. Real setters (machines pool size, scheduling repo limit, light slots) and `RunningJobs`/`Auditor` implementations are not in my files; CIX18 wiring must provide them (`actions.Setters{kind: setter}`).
3. Spec section 9 R5.10 row left "planned:" because its web half (ActionWizard.test.tsx) is CIX19's; spec file is not mine.
4. Plan-level API errors: `ErrNotFound`, `ErrNotDraft` (409), `ErrNoAction` (409) for CIX18 to map.

## Tool gaps in sandbox
golangci-lint is built with go1.25 (config targets 1.27.4) so lint did not run; gitleaks missing in fast_guards.

## Left
Nothing in my row.

CODE DONE 43260f1
