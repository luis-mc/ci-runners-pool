# CRSP76 report: why is this job waiting, hold jobs until load is measured

Owner decisions D51 and D53 (2026-11-15). Branch CRSP76-why-waiting.

## Done
- Gate: `load_not_measured` wait reason; unmeasured load holds (also light jobs); keeps ticket place (`internal/scheduler/gate.go`).
- Hook: waits on unmeasured load with and without an agent; one `::warning title=crsp::` with what to do; on timeout `run` becomes `fail` for an unmeasured wait (`internal/hooks/gate.go`).
- Doctor: new fail check `machine.load.measured` (27 checks).
- `scheduler.WaitWords` maps reasons to words; `getOverview` returns `waiting`; contract regenerated (Go, client, TS).
- Web: Overview section "Why jobs wait"; words in content.md, CHANGES C17.
- Specs: scheduling R5.20, R5.22, R5.23, R5.48, R5.61, R5.62 and test table (parity note: differs on purpose, D53); doctor; web-console; change notes.

## Not done / notes
- "machine paused / on battery": `PauseReason` is not in the tree (CRSP75 not merged), so skipped as told.
- Production overview source is still `overview.EmptySource` (wiring comment CRSP23), so the live list stays empty until the store adapter lands. The contract, words and screen are tested with fake sources.
- `docs_check.py` / `docs_fold.py` (luismc-docs) not available here; change notes written by hand.
- Web: 2 unrelated Settings download tests fail on Node 22 (repo wants Node 24): AuditLog Export, ConfigExport.
