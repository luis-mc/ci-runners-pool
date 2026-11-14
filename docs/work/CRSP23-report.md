# CRSP23 report: doctor, live events, overview

Status: started 2026-11-14. Updated after each push.

## Plan
1. internal/events: hub (ids, replay ring 2000/10 min, 500-behind close, stream cap, load throttle), SSE writer.
2. internal/overview: Overview builder over a Source interface, minutes saved (round up per job), snapshotter.
3. internal/doctor: Check interface + registry, engine (timeouts, crash isolation, one run per scope, redaction), memory store, diff.
4. internal/doctor/runson, svclist, checks (M1 core).
5. API handlers (live, doctor), `crsp doctor` CLI, wiring, docs notes.

## Decisions
- Exit codes follow the brief: fail exits 1, warn exits 0, could not run exits 3 (spec R5.22 said warn 1 / fail 2; spec note added).
- Data access goes through interfaces my packages declare (no import of internal/store); the SQLite adapters land with CRSP18.

## Done
- (nothing yet)
