# CRSP77 report

Branch `CRSP77-watchdog-install-check`. Owner decisions D51, D54 (2026-11-15).

## Done

1. Quiet-demand watchdog: `internal/demand/watchdog.go`, `Poller.LastDemand`, supervisor in `cmd/crsp/demand_wiring.go` (restart once per episode, loop state kept), config `demand_quiet_minutes` (default 10). Doctor checks `demand.quiet` and `github.webhook` (was spec only; now real, from `GET /app/hook/deliveries`). Fake server gained the delivery route. Doctor registry is 28 core checks, 30 with the KVM two.
2. Install scripts did not exist (R5.1 was planned). Wrote `scripts/install/install.sh` and `install.ps1` with the SHA-256 check, then `gh attestation verify` (stop on failure) or a plain "only the checksum was checked" line. Tests: `scripts/install/install_test.sh` with a fake release and a fake `gh`. Operations R5.1 updated.
3. macOS VMs: runners R5.29, RN-8, machines R5.14, decision 0003 (amendment), product overview. Spec text only.

## Not done, and why

- `release.yml` does not publish `install.sh` / `install.ps1` as release assets, and R5.1 says so. Its asset counts (14) and `SHA256SUMS` glob would need a change; left for the owner.
- `install.ps1` was written but not run: no PowerShell in the sandbox. No PowerShell test written.
- `shellcheck` not installed in the sandbox; `sh -n` and the shell test pass.
- `golangci-lint` cannot run here (built with Go 1.25, repo targets 1.27). `go vet`, `GOOS=windows go vet`, `gofmt` and `go test -race` pass for touched packages.
- `docs_fold.py` and `docs_check.py` (luismc-docs) are not in the sandbox; change notes written by hand in `docs/features/*/changes/CRSP77.md`. Run `docs_check.py` before merge.
- Code still detects a `tart` backend (`internal/agent/backends.go`, `internal/backend`, API enum). The task said spec only; renaming is a later task. Doctor `backend.available` and machines R5.11 still name `tart list` / Tart.
- `github.webhook` "jobs ran" is approximated by jobs open now.
