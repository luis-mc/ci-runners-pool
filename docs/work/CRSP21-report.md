# CRSP21 report: scheduler: slot queue, load gate, job hooks

Status: started. Updated after every step.

## Plan
1. internal/scheduler/slots: settings, order of service, light/heavy match, holder, log trim (pure).
2. internal/scheduler/load: probes and parsers.
3. internal/scheduler: SQLite-backed SlotQueue (gate, beat, release, sweep, reconcile, status, free stale). Store ops live in a new file internal/store/schedstore.go (database/sql is confined to internal/store by depguard).
4. internal/hooks: `crsp hook job-started|job-completed`, load-only fallback, wrappers.
5. internal/api/handlers_jobs.go: listJobs, getJob, listSlots, freeStaleSlots.
6. Docs: change note on features/scheduling.

## Done
(nothing yet)
