---
change: minor
task: CRSP90
---
Owner decision D58: no signing certificate, so installers ship unsigned with an SBOM. R5.43 now describes what is built: two SPDX SBOMs (Go binary, web console) per release, `SHA256SUMS` over every asset including them, and a build provenance attestation for each asset and for `SHA256SUMS`. New R5.45: the Authenticode and Developer ID signing steps exist in `release.yml` but run only when the repository variable `SIGNING_ENABLED` is `true`; certificates are named as secrets only. New guide `docs/guides/install.md` shows how to check a download.
