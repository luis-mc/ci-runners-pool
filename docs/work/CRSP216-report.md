# CRSP216: Go tests guardrails G4/G5, part A

Branch CRSP216-go-tests-a, base origin/CRSP196-integration.

## Checker (G4/G5, my packages)
Before: 17 G4 files (21 hits listed by the checker's first line) + 1 G5 (handlers_access_test.go, 26 rows).

## Per file
- internal/agent/caches_test.go: 150 ms sleep (proves a waiting wipe does not cut a running job's cache) -> waits for 3 more "waiting" reports of the wiper, counted from the controller's OnMessage hook. Each report is one poll.
- internal/agent/follow_test.go: two sleeps -> wait for the gate to leave "active" (first drain poll held the gate and found the job); no sleep.
- internal/agent/harness_test.go: `waitFor` and the listen retry polled with time.Sleep -> ticker plus explicit deadline timer (15 s / 1 s), same failure message. Still a poll (nothing to signal on for generic conditions), but bounded and sleep-free.
- internal/agent/host_command_test.go: helper child process slept to stay alive until killed -> blocks on a timer channel (it must live until the parent stops it; not a wait in the test).
- internal/agent/idle_cost_unix_test.go: LEFT. The 3 s sleep is the measurement window of real CPU time per wall second; a fake clock cannot measure CPU. Needs the real clock.

## Package times (go test -race, one run)
| package | before | after |
|---|---|---|
| internal/agent | | 14.5 s |
