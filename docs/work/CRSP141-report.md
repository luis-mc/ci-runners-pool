# CRSP141 report: parity writes a reachable address, final step tells the real cause

Branch `CRSP141-parity-address`. Status: code done.

## What changed
1. `repos.ParityAddress(publicHost, listenAddr)` (`internal/repos/parity_address.go`): `https://<CRSP_PUBLIC_HOST>:<console port>`, the join file's console URL. Loopback listen, empty/loopback/wildcard/malformed public host: `*AddressError` naming `CRSP_LISTEN_ADDR` or `CRSP_PUBLIC_HOST`.
2. API: `getParityAddress` (`GET /api/v1/parity-address`, admin) shows the address and calls it server side (https, controller CA only, `/api/v1/ca.pem`, 5 s). `setupRepositoryParity` ignores the browser address and any `controller_url`; with no address answers `needs_address` and makes/writes nothing. Go and TS clients regenerated.
3. Web (Access for CI): shows the address and the check before the button; Needs you note with the setting; button disabled with the reason.
4. `.github/workflows/parity.yml` final step: access `failure` says not set up; access skipped/cancelled/no outcome says the job did not reach the checks (and timed out/cancelled when `job.status` is cancelled). Values come from env, no checkout needed.
5. Specs: github-integration R5.84 + rows, operations R5.85 + rows, web-console R5.91 + rows. Change notes `CRSP141.md` in the three features.

## Checks run
- `go test -race ./internal/api ./internal/repos ./internal/parity`, `go test ./internal/... ./cmd/...`: green.
- golangci-lint v2.15.0 on touched packages: 0 issues. `GOOS=windows go vet` on touched packages: clean. `GOOS=darwin go vet ./internal/api ./internal/repos`: clean (`./cmd/...` fails on the systray cgo dependency, as on main).
- Web: tsc, eslint, prettier, Vitest `src/screens/settings`: green.

## Not done / notes
- `docs_check.py` and `docs_fold.py` (luismc-docs plugin) are not installed in this sandbox. Change notes were written by hand in the existing format; no version table or generated doc was touched. Run `docs_check.py` before merge.
- The setting is an environment variable of the controller (`CRSP_PUBLIC_HOST`), not an editable console setting; the console note names it.
- `parity.yml` cannot reach a live runner here; the final step is tested by running its `run` text under bash for each outcome.
