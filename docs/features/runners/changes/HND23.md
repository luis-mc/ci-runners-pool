---
change: minor
task: HND23
---
A listener that reports "a session for this runner already exists" right after a restart is expected for a bounded window (pool setting `session_wait_minutes`, default 3, handover lesson 29): the supervisor backs off with one log line and starts no second listener, and past the window it is a fault (R5.67).
