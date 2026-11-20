# CIX21 report: insights API handlers, Job and Settings fields, controller wiring

Branch `CIX21-insights-api` from `CIX-integration` 6b2697f. Plan row 11 (plan id CIX18).

## Built per requirement
(kept current below)

## Contract gaps (questions for the orchestrator)
1. `jobsdata.Job` (internal/jobsdata/types.go) has no runner origin, group, labels, steps source or checked at; only the sqlc row has them. Local workaround: optional interface `JobRunnerReader` on `Options.JobRunners`; nil leaves the fields absent.
2. `listJobs` in openapi.yaml has no parameter for the D7 "run elsewhere" filter. Not changed (contract). Workaround: with `state` queued or running, jobs whose origin is other or hosted are dropped from the page when origin is known.
3. `settings.Settings` / `settings.Patch` have no insights keys yet (CIX10 owns settings.go), so the mapping in handlers_ops.go cannot compile yet. Left for the join.

## Tests and times
(see below)

## Left
(see below)
