# CRSP122 report: download-an-installer join option (owner decision D70)

Branch: CRSP122-join-installer (from origin/main 10c39e9). Status: code done, draft PR open.

## Design
- New API `POST /api/v1/join-files` (admin, audited as `join_file.create` without the code): mints one join code (R5.4, single use, 15 min default), renders the file for `os` (windows .cmd, linux .sh, macos .command), returns it as an attachment. The join code id is in the `X-Join-Code-Id` header so the wizard can poll `getJoinCode`.
- The file holds: controller address and agent port, certificate fingerprint, the one-time code, the release version, and the public SHA256SUMS lines of the packages. No other secret.
- File name: `crsp-join-<os>-until-<UTC yyyymmddThhmmZ>.<ext>`.
- Packages: `GET /api/v1/packages/{name}` and `/api/v1/packages/SHA256SUMS` (public, rate-limited, only names in the release's SHA256SUMS). The controller proxies its own version's GitHub release, checks sha256 against SHA256SUMS, caches on disk.
- Trust: the script checks every downloaded package against the sha256 embedded in the script (taken from SHA256SUMS at mint time, from the authenticated console session), so the download needs no TLS trust of the self-signed cert. The join itself still pins the fingerprint.
- Windows: .cmd (CRLF) that starts PowerShell on itself, self-elevates, uses an installed `crsp.exe`, else fetches the MSI and checks sha256, then `crsp.exe agent install ...`. Linux .sh (LF) picks deb/rpm/tar.gz, sudo. macOS .command (LF) uses the .pkg.
- CLI: `crsp machine join-file --os ... [--out FILE] [--expires 15m]`.
- Console: option "Download installer" in the Add a machine method list.

## Not verified here
- Windows and macOS scripts are not run on those systems (Linux sandbox); tests check content, line endings and shellcheck for the sh.

## Log
- Requirement ids: machines R5.65 (the task text said R5.50, which is taken), web-console R5.66. Design-system words: next-version C31 (another branch, e.g. CRSP124, may also take C31: renumber on join).
- Windows launcher: `.cmd` + PowerShell body after a `#--PS-BODY--` marker, self-elevating, MSI fallback with sha256 check. Not run on Windows.
- macOS `.command`: a browser download has no execute bit; the file's words say to run it with `sh` if it does not open. Not run on a Mac.
- Linux `.sh` passes shellcheck (v0.11, test skips when shellcheck is missing) and `sh -n`.
- Checks run: gofmt, golangci-lint (0 issues), go test -race (joinfile, packages, machines, api, cli, update, cmd/crsp), GOOS=windows vet (all touched incl. cmd), GOOS=darwin vet (all touched except cmd/crsp: the systray dependency needs cgo on darwin, unrelated), codegen-drift (none), web typecheck, eslint and Vitest of apps/web/src/screens/machines (48 pass), prettier.
- Known unrelated failures on this Node 22 sandbox (repo wants 24), same on main: AuditLog.test.tsx export test and ConfigExport.test.tsx.
- `docs_check.py` and `docs_fold.py` (luismc-docs plugin) are not in this sandbox: the change notes were written by hand in the same format (docs/features/*/changes/CRSP122.md); run docs_check on the join.
- Open choice: the package endpoint is public (like the GitHub release it mirrors); the file carries the sha256 so TLS trust of the self-signed certificate is not needed for the download.
