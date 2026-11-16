# CRSP134 report: parity access from a pool container

Branch `CRSP134-parity-access`. Status: code done; draft PR open.

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
1. Backend: migration 00015, `internal/auth/access.go`, `internal/store/accessstore.go`, scope table `scopeOps` in `internal/api/authz.go`, API `handlers_access.go`, OpenAPI + generated code, GitHub `SetSecret` (sealed box) + fake routes, `internal/repos/parity.go`.
2. CLI: env sign-in in `internal/cli/session.go` (CA-pinned transport via `tlsca.VerifyPin`).
3. Workflow: `parity.yml` access step first, step env, summary message; `internal/parity/workflow_test.go` lints it.
4. Web: Settings tab `access` (`AccessForCi.tsx`, test).
5. Docs: runbook, parity plan, specs cli R5.60, github-integration R5.82 to R5.84, operations R5.85, web-console R5.90, R5.91 (+R6.4), change notes.

## Decisions
- The manifest and the R5.23 table are unchanged. `secrets: write` is checked at action time, fresh from GitHub. A new App therefore needs the one grant the page shows. Say if the manifest should ask for it from the start (it changes R5.23 and its test).
- The credential has no expiry; revoke ends it. A doctor run is allowed in the scope (it writes one history row, changes nothing in the pool).
- `CRSP_URL` is the address of the console the admin used (or `controller_url` in the request). A runner that reaches the controller at another address needs that address given.
- The action lives in Settings > Access for CI with a repository picker, so the Repositories screen is not touched. CRSP131 touches Settings: only the `TABS` array and one `Route` line overlap.

## Checks run
gofmt, golangci-lint (0 issues), `go test -race` of touched packages and cmd, `GOOS=windows` and `GOOS=darwin go vet`, codegen drift none, web typecheck, eslint, prettier, Vitest of apps/web.
Not run: `docs_check.py` and `docs_fold.py` (the luismc-docs plugin is not on this machine; the notes follow the format of the existing ones). Two Vitest cases fail with and without this branch (AuditLog export, ConfigExport download: Node 22 here, repo wants 24).
