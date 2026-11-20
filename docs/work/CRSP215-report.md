# CRSP215: Go test guardrails G4/G5, part B

Branch CRSP215-go-test-guardrails-b, base origin/CRSP208-release-48. Pattern from part A (CRSP216, origin/CRSP216-go-tests-a): wait on signals or bounded ticker/timer, never `time.Sleep`; split tables over 20 rows. There is no guardrail "known list" for Go tests (test_guardrails.py has none), so nothing to remove.

## Checker (my packages) before -> after
G4: 9 files with sleeps or open-ended `for {` loops; G5: compact_test (27 rows), notify_test (22 rows). After: none left in my packages (internal/agent/idle_cost_unix_test.go is part A's, left).

## Per file
- machines/compact_test.go: 27 rows -> 3 tests of 9 (gates, threshold and quiet hours, busy and idle), one shared runner.
- notify/notify_test.go: 22 rows -> TestValidationWebhook (13) and TestValidationEmail (9), shared runner.
- machines/drain_timeout_test.go, harness_test.go: poll loops use ticker + deadline timer; stream reader loop ends on error.
- machines/settings_survive_test.go: 100 ms sleep -> scheduler yields (nothing signals that the rename queued behind the lock).
- machines/sshjoin_test.go, sshwin_test.go, notify/fakesmtp_test.go: accept/read loops end on error in the loop header.
- images/persistent_test.go: sleep after clean -> bounded poll for the process to die; shell `sleep 0.2` removed; supervisor poll uses a ticker.
- guards, registry/core, repos: unbounded `for {` -> bounded loops.
- runnercache/lane_test.go: release without a 30 ms delay (waiter polls). scheduler/guard_test.go: expired deadline set in the past. stackscan: wait until the first read is in flight. store/imagebuilds_test.go: fake clock for ordering. update: bounded wait for the drain cancel. registry/builds gate: Gosched in the critical section.
- vmcheck/cache_test.go and registry/core/notelemetry_test.go: fixed waits removed. Weaker: the lock test no longer forces the second taker to queue; the telemetry test no longer waits for a batch flush (the SDK-provider type check still proves no exporter is installed).

## Tests (go test -race, tiers from go-tiers.json)
guards 9.3 s, images 4.8 s, machines 3.8 s, notify 34 s, registry/builds 1.0 s, registry/core 3.9 s, repos 4.1 s, runnercache 1.2 s, scheduler 86 s, stackscan 1.0 s, store 98 s, update 1.5 s, vmcheck 1.5 s: all pass.

Docs: none, test-only change.
