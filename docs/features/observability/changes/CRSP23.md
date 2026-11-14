---
change: minor
task: CRSP23
---
Built the event hub (replay by Last-Event-ID, 2,000 events or 10 minutes, close at 500 behind, 50 streams, one load event per machine per 5 s), the SSE writer, GET /api/v1/overview and GET /api/v1/events, and minutes saved today. Event payloads follow LiveEvent; saved.today carries the minutes list under minutes_saved_today, which LiveEvent does not name yet.
