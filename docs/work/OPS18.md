# OPS18 report

Bug (v0.1.10, GameRoomPC): `icacls exited 1332` on `/setowner crsp-crsp-light-9433`.

## Cause
1. `runners.AccountName` put `crsp-` before a slug that already started with `crsp-` (runner `crsp-light-comics-organizer-windows`), so the name doubled, did not fit 20 chars and got a hash (`crsp-crsp-light-9433`, exactly 20).
2. `ResetFolderACL` passed the account by name to `icacls /setowner`; Windows could not map it (1332).
3. The user text carried the whole tool output.

## Change
- `internal/runners/account.go`: leading `crsp-` stripped from the slug before the prefix is added; name length rule unchanged (<= 20).
- `internal/backend/windows/scripts.go`, `windows.go`: `scriptAccountSID` reads the SID of the created account after `scriptAccount`; `accountSID` returns it.
- `internal/backend/windows/acl.go`: `ResetFolderACL(ctx, d, folder, account, sid)` runs `icacls <dir> /setowner *<SID> /T /C`; failures return `*FolderResetError` whose `Error()` is "Could not prepare the runner folder"; `Detail` and the log line (`acl`) hold the step, exit code and tool text.
- Tests: `TestAccountNameSinglePrefix`, `TestSIDReadAfterAccountBeforeICACLS`, `TestNoSIDStopsBeforeICACLS`, updated `TestAccountSwitchResetsFolderACL` and `TestACLResetFailureStopsBeforeLock`.
- Spec `docs/features/runners/spec.md` R5.13, R5.58; note `docs/features/runners/changes/OPS18.md`.

## Notes
- A runner whose name starts with `crsp-` gets a new (shorter) account name on its next start. The old `crsp-crsp-…` account is not tracked and stays until removed by hand (`net user` / Remove-LocalUser); the account name is rebuilt from the runner name, so it will not be reused.
- `docs_fold.py` / `docs_check.py` (luismc-docs) are not in this sandbox; the change note was written in the same format as the existing ones. Run `docs_check.py` before merge.
- Checked: `go test ./internal/runners/ ./internal/backend/...`, golangci-lint (below).
