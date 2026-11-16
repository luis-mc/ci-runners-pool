# CRSP126 report: Windows persistent runner service fails to start

Branch `CRSP126-windows-runner-service`, base `68d30b3`.

## Symptom
Add persistent runner on Windows (LocalSystem agent) fails at `register service`:
`Start-Service : Service '... ' cannot be ...` (truncated). Light runners also `failed`. No runner on GitHub.

## Install path read
`internal/runners/service.go addRunner` -> agent -> `internal/backend/windows/windows.go Start`:
register with GitHub, `scriptAccount`, `rights.Grant` (secedit), hooks/.env, ACL reset + lock, `scriptRegisterService` (New-Service -Credential, Start-Service).

## Suspects
| Suspect | Finding |
|---|---|
| no Log on as a service right | `scriptRightsBody` ends with `if ($lines -notmatch '^\[Unicode\]')`. On an array that returns the non-matching lines, so it is always true and a second `[Unicode]` header is written. secedit then may ignore the INF while exiting 0 (it is piped to Out-Null and never read back). No check that the right was set. Most likely root cause (1069 logon failure). |
| password differs / not passed | Same password goes to `scriptAccount` and `scriptRegisterService` (both `CRSP_PASSWORD`). Not proven wrong, but nothing checks the logon before Start-Service. |
| folder ACL | Lock grants account FullControl; fine. |
| binary path quoting | Quoted exe, fine. |
| account disabled / must change | New-LocalUser enabled, UserMayNotChangePassword. An existing disabled account is not enabled again. Fixed. |
| name > 20 | AccountName caps at 20. Fine. |
| truncated message | `psOK` keeps only `firstLine(stderr+stdout)`; Start-Service text is `... cannot be started due to the following error:` and the reason is in the inner exception. CLIXML noise in stderr. |

## Fix plan
1. Rights by LSA (`LsaAddAccountRights` / `LsaRemoveAccountRights`) for that one account, then read back; no secedit.
2. Check the logon (`LogonUser`, service logon type) before `New-Service`; failure names the reason in plain words.
3. Every script wrapped in try/catch; whole message with inner exceptions, no CLIXML; whole text kept (redacted).
4. Failed add cleans service, account, folder; controller deletes the GitHub registration; text says what is left.
5. Runner record keeps `failed_reason`; API `Runner.failed_reason`; minimal text in the existing row.

## Status
Done. Backend: `internal/backend/windows` (scripts.go LSA + logon check, errtext.go, cleanup.go). Controller: `runners.Service.withRegistrationCleanup`, `Record.FailedReason`. API: `Runner.failed_reason` (openapi, codegen drift clean). Console: reason text after the state word. Spec R5.87, note CRSP126.

Checks: gofmt, golangci-lint 0 issues, go test -race (backend, runners, api, cmd), GOOS=windows/darwin go vet, GOOS=windows test compile, vitest + typecheck of web. Not run: `lsa_windows_test.go` (needs Windows), `docs_check.py` (luismc-docs plugin not in sandbox).

Not verified on a real host: which suspect hit the owner. Best evidence is the secedit `-notmatch` bug plus no read-back; the new logon check will name the real reason on the next try.
Machines/agent notes: none, agent plan untouched.
