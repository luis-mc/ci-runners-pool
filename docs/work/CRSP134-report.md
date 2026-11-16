# CRSP134 report: parity access from a pool container

Branch `CRSP134-parity-access`. Status: in progress (updated after each step).

## Problem
`parity.yml` ran `crsp parity check` and failed with "Not signed in. Run crsp login URL." The runner user had to run `crsp login` by hand. A pool container never has that.

## Plan
1. CLI: with no login context, read `CRSP_URL`, `CRSP_ACCESS`, `CRSP_CA_FINGERPRINT` (names do not end in _KEY/_TOKEN/_SECRET/_PASS). CA fingerprint is pinned; no way to skip it.
2. Controller: scoped, read-only access credential `crsp_acc_...`, scope `parity`. Table `access_credentials` (hash only). Allowed operations: listRunners, runDoctor, getDoctorRun. Every other operation is refused with 403 for a scoped principal. Made, listed, revoked in Settings > Access for CI; value shown once; audit rows never hold the value.
3. Console action "Set up parity for this repository": checks the App's `secrets` and `actions_variables` write; if missing, answers `needs_permission` with the GitHub pages to grant it, and makes nothing. Otherwise makes a credential, writes secret `CRSP_ACCESS` (sealed box) and variables `CRSP_URL`, `CRSP_CA_FINGERPRINT`. If writing fails the credential is revoked.
4. `parity.yml`: passes the three as env; first step fails with a message naming the console action when one is missing.
5. Docs: runbook, parity-plan, specs (operations, cli, web-console, github-integration) with R-IDs, test rows, change notes.

## Notes
- `<luismc-docs>` scripts (`docs_fold.py`, `docs_check.py`) are not on this machine; change notes are written by hand in the same format as the existing ones. `docs_check.py` was not run.

## Steps
(see git log)
