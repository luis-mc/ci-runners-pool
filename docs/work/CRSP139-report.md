# CRSP139 report: guided GitHub grant (owner decision D84)

Branch: CRSP139-guided-grant. Draft PR to main.

## What was built
- Go `internal/github/grant.go`: `DiffGrant` (needs vs what the App asks for vs what the installation accepted), `GrantPages`.
- `internal/repos/grant.go`: `Service.Grant` reads `GET /app` (App JWT) and the installation fresh; steps install, ask, accept with
  live state and the exact missing permissions; `PermissionsAccepted` (webhook `new_permissions_accepted`) drops the cached
  installation token (`REST.ForgetInstallationToken`) and reconciles; a changed permission set found by a read does the same.
- API: `GET /api/v1/github/grant` (`getGithubGrant`, admin). `setupRepositoryParity` answers `grant` in place of the two page URLs.
- Manifest/App set: `secrets: write` added to `RequiredPermissions` (manifest, doctor, installation list); the organization
  runner permission is no longer asked of a personal account in the installation list.
- Web: shared part `GithubGrant` (`packages/ui/src/components/Grant.tsx`, component 44): one step list with live state, step
  text next to its label, ONE primary external action to the next missing page, re-check on focus / visibility / 15 s, Ready state.
  `ExternalButton` gained `onOpen`. Page wrapper `apps/web/src/screens/GrantGuide.tsx` (`GrantGuide`, `MissingPermissionsGuide`).
- Places that use it: Settings > Access for CI (parity; runs the setup by itself when granted), Repositories (also covers the
  pool per organization permission), Turn on the pool (choose step).
- Docs: github-integration R5.85 to R5.87, web-console R5.92, component 44, content words, CHANGES C36, change notes
  (written by hand in the existing format: the `luismc-docs` scripts are not installed in this sandbox, so `docs_fold.py note`
  and `docs_check.py` could not run).
- Tests: Go (DiffGrant states, token refresh, event parse, manifest permissions, API grant, setup answer), Vitest (part: none
  done, asked not accepted, all done, one action, focus re-check, ready once; Access for CI; Repositories), a11y case in
  `e2e/tests/web-console/a11y.spec.ts` (dark and light, passed locally), layout spec passed locally.

## Notes
- First-run Setup creates the App from the manifest, which now asks for every permission, so it needs no grant step; the
  install step of first run stays on Repositories (`InstallAppButton`), and the grant's `install` step covers an account
  with no installation.
- Existing Apps made before this change lack `secrets`: the Repositories screen and the doctor now name it, the guide walks
  the owner through ask and accept once.
- Pre-existing, unrelated: ConfigExport and AuditLog Vitest tests fail on a clean tree in this sandbox (Blob.text in jsdom).
- Not run: mutation pass, Docker, gitleaks (not installed locally).
