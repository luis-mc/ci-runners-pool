---
change: minor
task: CRSP23
---
One drain timeout per machine (default 60 minutes, 5 minutes to 24 hours). When it passes with jobs running, the change keeps waiting, the controller audits it and raises one warning, and the console and CLI show "still draining, N jobs running, waited X". The "stop those jobs now" choice and the stop_jobs decision are removed (R5.33); the controller answers stop_jobs with 400. Code: internal/machines (drain.go, state.go, types.go, service.go), tests drain_timeout_test.go.
