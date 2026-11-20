# CIX18 report: workflow file checks, their store, Doctor area Workflows

Branch CIX18-workflow-checks (plan row 8, plan name CIX16). Requirements R5.29, R5.30, R5.43. Aligned with DL-99.

## Built (per requirement)
- (in progress)

## Tests and times
- (none yet)

## Contract gaps (questions for the orchestrator)
- `workflows.Result` has no workflow file path, but `workflow_checks.workflow` does. Workaround: `Store.Latest` and `ForCommit` return `Result.Job` as `<path>#<job>` (job empty: `<path>`); `workflows.SplitJob` splits it. Question: add `Path string` to `Result`?
- `doctor.Env` has no workflow-check source. Workaround: `checks.WorkflowSource` interface plus `checks.SetWorkflowSource`, called at wiring (CIX18/api task); with no source the doctor checks skip.

## Left
- (in progress)
