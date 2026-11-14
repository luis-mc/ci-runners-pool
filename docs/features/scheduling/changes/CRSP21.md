---
change: minor
task: CRSP21
---
M1 built: the slot queue, load gate and job hooks (internal/scheduler, internal/hooks), the SQLite slot store, listJobs, getJob, listSlots and freeStaleSlots. The hook talks to the agent on a local Unix socket (JSON lines); the gate loop (timeout, log lines, load-only fallback) lives in the hook, the controller answers go or wait per poll. The code map moved from internal/slots to internal/scheduler/slots. A lost race shows as free_slot in the API. No contract change.
