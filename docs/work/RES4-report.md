# RES4 and RES5 report (branch RES4-env-sets-registry)

Source: docs/architecture/landscape-2026-11.md names neither task; scope taken from the task brief. Backend and API only; no apps/web, no packages/ui.

## Done
- RES4 `internal/envsets`: sets, merge machine < sets in order < runner, sensitive values in the secret store, masked views, redactor learns values, reserved name prefixes refused. `crsp runner env <name>`, `GET /api/v1/runners/{id}/env`, env-set routes.
- RES5 `internal/regcreds`: logins per backend kind (password in secret store, `CredentialRef` in metadata, `--password-stdin` only), CA bundle (PEM certs only), plans: container (mounted CA folder + update-ca-certificates), VM (boot files, 0600 login file removed by script), persistent (runner env + runner-folder files only, host trust store untouched). Registry routes. `Secret` type masks itself under %v.
- Spec runners R5.68 to R5.71, open questions 56 to 60, change notes RES4.md and RES5.md.

## Tests (all pass, -race)
envsets, regcreds, api, cli. `GOOS=windows go vet ./...` clean.

## Not done / open
- Store tables and runner-start wiring (LayerSource, calling the Plan* functions from the backends): spec open questions 56, 59.
- `golangci-lint` here is built with Go 1.25 and refuses the repo's Go version: not run. gofmt and go vet clean.
- TS contract types not regenerated (no node_modules).
- `docs_fold.py` / `docs_check.py` (luismc-docs plugin) not found on this machine: change notes written by hand in the note format of existing files; docs check not run.
