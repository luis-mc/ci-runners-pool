# RES1 and RES2 report

Branch RES1-finished-job-base-image from origin/main.

## RES1
- Found: the loop trusted the last poll/webhook state; a job finished after that event could still get a runner.
- Fix: `Loop.ReadJob` + `RecheckAfter` (5 s) in internal/demand/demand.go; wired to `gh.GetJob` in cmd/crsp/demand_wiring.go.
- Tests: TestFinishedOrCancelledJobStartsNoRunner, TestRecheckOnlyForOldEventsAndFailsClosed.

## RES2
- Agent gate: `SetBaseImageGaps`, pause reason `base_image_missing` (openapi enum, generated Go and TS updated).
- Doctor: `backend.baseimage` check (`RegisterBaseImage`).
- Probes: `ContainerBaseImage`, `VMBaseDisk`.
- NOT DONE: production wiring of the base image lists (agent Config.BaseImages, doctor BaseImageSource); the required refs per backend are not known in one place. Spec says so (R5.69).
- Tests: agent baseimage_test.go, doctor checks baseimage_test.go.

## Checks
go test -race on demand, agent, doctor, machines, api, cmd/crsp: green. GOOS=windows go vet: clean. golangci-lint could not run here (built with Go 1.25, repo targets 1.27); docs_check.py not available here; run both in CI.
