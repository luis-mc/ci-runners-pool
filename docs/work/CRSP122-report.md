# CRSP122 report: download-an-installer join option (owner decision D70)

Branch: CRSP122-join-installer (from origin/main 10c39e9). Status: in progress.

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
