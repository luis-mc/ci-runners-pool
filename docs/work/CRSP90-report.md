# CRSP90 report: SBOM, attestations, signing off-switch (branch only)

Status: workflow edited, docs pending.

- Base: origin/main 40f779d (local origin/main ref was stale at dca6a45; fetched).
- Owner decision D58: no cert; ship unsigned installers plus an SBOM.
- Only `release.yml` publishes a release. `installer.yml`, `installer-unix.yml`, `package.yml`, `package-windows.yml` build test artifacts or are templates; they publish nothing, so they get no SBOM step.

## Plan
1. Pin syft 1.33.0 in `scripts/delivery/tools.json` (done), fetched with `ci_tool.py tool syft`.
2. `scripts/ci/release-sbom.sh`: two SPDX JSON files: `crsp-sbom-go.spdx.json` (linux-amd64 binary) and `crsp-sbom-web.spdx.json` (pnpm lockfile).
3. `release.yml`: SBOM before `SHA256SUMS`; attest every asset and `SHA256SUMS`; signing steps gated by `vars.SIGNING_ENABLED`.
4. Docs: operations spec R5.43 and R5.45, change note, install guide.
