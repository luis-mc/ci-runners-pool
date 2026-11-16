# CRSP147 report: update asks first, tray returns, one programs-list entry

Branch `CRSP147-update-asks-first`, from `main` at 058456b. Draft PR to main.

## Findings (read from code, v0.1.2 and v0.1.3 MSI sources are the same)

1. **Check installed on its own.** Tray `Look for updates` sends channel call `check` to
   `trayBackend.Check`, which calls `update.Manager.Check`. That method, after looking, starts
   `begin(KindUpdate, "auto-update")` whenever auto-update is on (the default). The note the owner
   saw ("installs by itself once running jobs have finished") was shown by
   `Opener.LookForUpdates` and the install then ran. The same path ran from the console button
   (`POST /api/v1/update/check`).
2. **Tray did not return.** The tray is relaunched by (a) the old tray, when it sees a newer
   service version (`NeedsRelaunch`), and (b) the MSI custom action `LaunchTray`, which is
   skipped when `LogonUser` is SYSTEM (the auto-update from the service). The MSI ends every tray
   in `CloseTray` / `EndProgramProcesses` (forced end), so the old tray cannot relaunch, and (b)
   is skipped for SYSTEM. Nothing started a tray for the signed-in user: it came back only at the
   next sign-in (HKLM Run key).
3. **Two programs-list entries, both 0.1.3.0.** The package authors two entries: its own MSI entry
   (hidden with `ARPSYSTEMCOMPONENT=1`) and a hand-made `Uninstall\crsp` registry key that is meant
   to be the only visible one. Both carry `[ProductVersion]`, so both read 0.1.3.0 once the hidden
   flag is not honoured. One visible entry therefore depends on a flag plus a second hand-made
   key. I could not reproduce on Windows here; the UpgradeCode is the same in v0.1.2 and v0.1.3
   and `MajorUpgrade` is present, so this is not an UpgradeCode gap. Fix: the package keeps
   only its own entry (Windows Installer replaces it on every major upgrade); the hand-made key
   and `ARPSYSTEMCOMPONENT` go. Trade-off: Settings uninstall uses the MSI's basic UI, so the
   remove-data question shows only with the full UI; the silent and Settings uninstall keep data
   (`REMOVEDATA=1` removes it).

## Plan

- `update.Manager.Check` only checks; new `AutoCheck` (used by the periodic `Run`) keeps the
  automatic install. `POST /update/check` and tray `check` never install.
- Tray: new channel call `install` (Install now). `Look for updates` shows a dialog (Later left,
  Install now right, What changed link, jobs count/drain line) when a newer stable release exists.
  The update notification has the same two choices. Settings, Updates says what automatic updates do.
- Relaunch: the updater (controller, after the MSI exits) starts the tray for each signed-in
  user through a one-shot scheduled task in the user's context; the tray shows `Updated to vX` once.
- MSI: one ARP entry; Go test of `crsp.wxs`; `smoke.ps1` counts every ARP entry (both registry views).

## Status

Updated as steps land; see git log.

### Done

- `Manager.Check` only checks; `AutoCheck` is the scheduled look (R5.87). Tests in `internal/update`.
- Tray: update dialog (Windows PowerShell form, zenity/kdialog, osascript), channel call `install`, `Offered` once per version (tray R5.43).
- Relaunch: `AfterInstall` hook runs `tray.StartForSignedInUsers` (WTS + CreateProcessAsUser, linked limited token) at the first start after a successful MSI update (R5.88).
- MSI: hand-made `Uninstall\crsp` key and `ARPSYSTEMCOMPONENT` removed; `installer/wxs_test.go`, `windows-msi-check` step, smoke and upgrade tests count entries (R5.89).
- Spec, change notes (hand-written: `docs_fold.py` / `docs_check.py` are not on this machine), design-system `next-version` content words + C45.

### Not verified here

- No Windows: the PowerShell dialog, `launch_windows.go` and the MSI were compiled/authored but not run. The Windows installer workflow (`installer.yml`) runs smoke and upgrade tests on the PR.
- The cause of the double entry is deduced from the authoring (two entries, one hidden by a flag), not reproduced.
- `apps/web` tests were not run (no node_modules); the one string changed is in `Updates.tsx` and its test.
