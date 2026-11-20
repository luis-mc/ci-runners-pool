# CRSP216: Go tests guardrails G4/G5, part A

Branch CRSP216-go-tests-a, base origin/CRSP196-integration.

## Checker (G4/G5, my packages)
Before: 19 G4 files + 1 G5 (handlers_access_test.go, 26 rows). The checker also listed internal/backend/container/words_test.go (not in the brief; same package, fixed).
After: 1 G4 file (internal/agent/idle_cost_unix_test.go, left on purpose, see below), 0 G5.

## Per file
- internal/agent/caches_test.go: 150 ms sleep (proves a waiting wipe does not cut a running job's cache) -> waits for 3 more "waiting" reports of the wiper, counted from the controller's OnMessage hook. Each report is one poll.
- internal/agent/follow_test.go: two sleeps -> wait for the gate to leave "active" (first drain poll held the gate and found the job); no sleep.
- internal/agent/harness_test.go: `waitFor` and the listen retry polled with time.Sleep -> ticker plus explicit deadline timer (15 s / 1 s), same failure message. Still a poll (nothing to signal on for generic conditions), but bounded and sleep-free.
- internal/agent/host_command_test.go: helper child process slept to stay alive until killed -> blocks on a timer channel (it must live until the parent stops it; not a wait in the test).
- internal/agent/idle_cost_unix_test.go: LEFT. The 3 s sleep is the measurement window of real CPU time per wall second; a fake clock cannot measure CPU. Needs the real clock.

- internal/agent/harness_test.go also: the listen retry is a ticker loop under a 1 s `context.WithTimeout`.
- internal/api/handlers_github_test.go: unbounded paging `for {` -> `for pages < 20 {` (the old in-loop "cursor does not end" guard is now the loop bound; the final `pages != 11` check still fails a cursor that never ends).
- internal/api/handlers_live_test.go: 100 ms sleep before publishing -> publish when `hub.Streams() > 0` (stream subscribed), bounded 3 s; doctor run poll -> ticker with 10 s deadline and a failing message that prints the run.
- internal/api/handlers_access_test.go (G5): the 26-row table is split into three tests (3 reads/allowed, 7 reads outside scope, 16 writes) over one helper `checkParityScope`. Every row kept, same assertions.
- internal/audit/query_test.go: cursor paging loop bounded to 10 pages.
- internal/backend/container/buildstream_test.go: 150 ms sleep -> waits (bounded 10 s) until the second asker's local `image inspect` is recorded by the fake docker; the image is still missing at that point, so the "built while this one waited" path is exercised without timing.
- internal/backend/container/words_test.go: walk up to go.mod bounded to 64 levels.
- internal/backend/macvm/macvm_test.go: 1 ms poll for the "why it waits" message -> `Say` signals a channel; test waits on it with a 5 s limit.
- internal/backup/backup_test.go: 100 ms poll -> 20 ms ticker under a 6 s context deadline. The 1.5 s real-time wait for the scheduler timer stays: `Service.Run` computes `time.Until(next)` from the real clock, so a seam would be product code; not added.
- internal/cli/cmd_maintain_test.go: sleep after Ctrl-C removed; the handler cancels then answers at once, and the CLI must still report "may still run" and lift the hold (same assertions).
- internal/cli/resources_test.go + testutil_test.go (new helper `runUntilPrinted`): the two watch tests slept 100 ms so the CLI could print before Ctrl-C. Now stdout is a writer that cancels the context the moment the marker is printed, and the handler holds the stream until the client leaves.
- internal/events/hub_test.go: the SSE test cancelled after 60 ms -> a recorder wrapper cancels the request after the first keep-alive is written (overrides `Write` and `WriteString`).
- internal/github/apphealth_test.go: `waitFor` ticker with 5 s deadline. scaleset_test.go: the ack poll now uses `waitFor`.
- internal/hooks/lessons_test.go: the socket accept loop is `for c, err := ln.Accept(); err == nil; ...` (ends when cleanup closes the listener).

No product code touched. No docs changed (test-only).

## Left on purpose
- internal/agent/idle_cost_unix_test.go:42, `time.Sleep(3 * time.Second)`: the test measures real CPU time per wall second of an idle agent; the wall-clock window is the measurement. A fake clock cannot measure CPU. It also costs 3 s of the 10 s per-test budget. Suggest the owner moves it to an integration/soak tag or accepts a known-list entry; I did not.
- Polling helpers (`waitFor`, retries) are ticker + deadline loops, not signals: they wait on arbitrary conditions with no hook. They fail with a clear message at the deadline.

## Package times, go test -race, one run (whole package)
| package | before | after |
|---|---|---|
| internal/agent | 15.0 s | 13.7 s (41.2 s for -count=3) |
| internal/api | 32.7 s | 30.0 s |
| internal/audit | 7.9 s | 7.7 s |
| internal/backup | 18.8 s | 17.2 s |
| internal/cli | 3.8 s | 2.7 s |
| internal/events | 1.1 s | 0.4 s |
| internal/github | 2.4 s | 1.7 s |
| internal/hooks | 19.6 s | 19.0 s |
| internal/backend/container | 1.5 s | 0.6 s |
| internal/backend/macvm | 1.1 s | 0.4 s |
"after" = -count=3 total / 3, except agent noted. Slowest single tests were not measured per test; packages over 10 s (agent, api, backup, hooks) hold many tests, so a per-package -timeout of 60 s covers api (the highest, 30 s).

## Environment note
The sandbox's golangci-lint was built with go1.25 and the pre-push hook failed on it; I installed v2.15.0 (the CI version) built with go1.27.4 into /dev/shm/bin and put it first on PATH. No hook was bypassed.

## Gate
Ran `go test -race -count=3` and `go vet` on every touched package: all green. CI on the branch head is the gate.
