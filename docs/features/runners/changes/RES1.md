---
change: minor
task: RES1
---
The demand loop never starts a runner for a job that already finished or was cancelled. Before a start it re-reads the job from GitHub when its last event is older than 5 seconds, and starts nothing unless the job is still queued; a failed read starts nothing and retries on the next tick (R5.73).
