# CRSP115 report: App private key rotation (github-integration R5.7, M8)

Branch `CRSP115-key-rotation`, base `68d30b3`.

## Plan
1. `internal/github`: `REST.CheckAppKey` signs an App JWT with a candidate key and reads `GET /app`; the App id must match.
2. `internal/auth`: `Service.RotateAppKey` (owner only): check, then `secrets.Store.Put` (existing API only), then reload the key in the GitHub client; audit without the key.
3. `packages/contract`: `PUT /api/v1/app/private-key` (owner, body `pem`, answer 204, key never returned); codegen.
4. `internal/api`, `internal/cli`: handler and `crsp app rotate-key --file PATH|-`.
5. `apps/web`: Settings piece with a file input and one action, shared parts only; words in `docs/design-system/next-version/content.md` with a CHANGES entry.
6. Tests, docs (R5.7 marked built, change notes).

## Status
- [ ] 1  [ ] 2  [ ] 3  [ ] 4  [ ] 5  [ ] 6

## Notes
- The luismc-docs scripts (`docs_check.py`, `docs_fold.py`) are not installed in this sandbox. Change notes are written by hand in the format of `docs/features/*/changes/*.md`; `docs_check.py` was NOT run.
- `.githooks/*` mode change not committed (`core.fileMode=false`).
