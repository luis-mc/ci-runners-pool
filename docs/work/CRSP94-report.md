# CRSP94 report: TestWipeWaitsForTheRunningJobThenEmptiesTheFolder flake

Cause (read from code; not reproduced on Linux, 180 runs at -cpu 1 under load passed):
`fastConfig` sets `HeartbeatEvery` 50 ms. `sendLoop` (internal/agent/run.go) ends the session when the
controller was silent for 3 heartbeats = 150 ms. A stall over 150 ms on a loaded Windows runner drops the link
("link lost; reconnecting", backoff 1 s+). A `WipeCache` sent on the dead session is lost, and the old session's
wiper goroutine returns on ctx.Done without a report, so the controller keeps the cache "wiping" for ever and
a `waitFor` (15 s) times out. The TLS "bad certificate" lines come from other tests' agents and are noise.

Fix: this test sets `HeartbeatEvery = 2s` (silence limit 6 s), so the link stays up. Test only.

Checks: `go test -race -count=20 -run TestWipeWaits` ok; whole package `-race -count=3` ok;
`GOOS=windows go vet ./internal/agent` ok; gofmt clean. golangci-lint cannot run here (built with go1.25, repo needs 1.27.4).

Not fixed (product, out of scope): a link loss mid-wipe leaves the controller in "wiping" with no retry.
