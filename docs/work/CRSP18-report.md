# CRSP18 report (handoff)

Branch CRSP18-windows-msi, draft PR #21 (https://github.com/luis-mc/ci-runners-shared-pool/pull/21). The PR shows CONFLICTING with main: rebase or merge main (likely .github/workflows/artifact-prune.yml, release.yml, docs generated files; regenerate docs with docs_index.py build).
UpgradeCode: C1D62442-6DB4-4FF0-9F28-A1CE3121B332 (recorded in installer/README.md; spec R5.38).

## Done
- installer/crsp.wxs (WiX 5.0.2 + UI, Util, Firewall extensions), build.ps1 (-Arch x64|arm64, -Version, -EdgeBase, -Build, -ProductVersion, -FailAfterInstall test switch), dotnet-tools.json pin, install-kind marker file ("msi"), README.md, smoke.ps1, ui-test.ps1.
- Output names crsp-windows-amd64.msi / crsp-windows-arm64.msi (contract with CRSP19 kept).
- cmd/crsp/service_windows.go, service_other.go and a 2-line change in main.go: crsp had no Windows service entry point (no svc.Run), so a registered service would fail with error 1053. Now `crsp.exe controller` run by the SCM reports state, Stop cancels the controller, log goes to %ProgramData%\crsp\logs\crsp.log; `crsp tray` calls FreeConsole. Outside the stated file list; CRSP19 should not conflict (only baseContext in runController).
- release.yml: msi job (windows-latest, matrix amd64/arm64, uses build job's windows binary artifact), publish job downloads msi-windows-* and copies both MSIs into dist (count 8, comment marks the place for more installer kinds), checksums and attestation cover dist/crsp-*. Edge ProductVersion = next patch after latest stable tag + run number as 4th field; stable = a.b.c.0.
- .github/workflows/installer.yml (PR/push on installer/**, cmd/crsp/service_*.go): builds both MSIs, x64 runs smoke.ps1 (install, upgrade, downgrade refused, failed-upgrade rollback, silent uninstall keeps data, reinstall, REMOVEDATA=1), ui-test.ps1, admin extract of both. Runs on draft PRs too. artifact-prune.yml lists 'Installer'.
- Spec operations: R5.7 updated, new R5.35 to R5.41, tests table, code map, change note docs/features/operations/changes/CRSP18.md; docs_check passes (0 errors).
- Silent upgrade command (R5.39): `msiexec /i crsp-windows-<amd64|arm64>.msi /qn /norestart /l*v <log>`; suggested log %ProgramData%\crsp\logs\msi-update.log. Exit 0 ok, 1603 refused (downgrade) or failed.
- Owner decisions: data checkbox unchecked by default (REMOVEDATA=0); rollback action starts old service (StartServicesRollback); install-kind written and removed with the product.

## Tested on this PC (before the stop rule), all with the MSI built locally
x64 smoke (install, service/account/failure actions/PATH/firewall Private 8460,8461/shortcut/autostart/data ACL/port 8460 listening, silent upgrade 0.1.0 to 0.1.1 with new service pid and data kept, downgrade 0.0.9 refused with exit 1603 and message, silent uninstall keeping data and no leftovers, reinstall, REMOVEDATA=1 removal): ALL PASSED (second run, after fixing the test script and the exe file name). Not yet run locally or in CI: install-kind check, failed-upgrade rollback, StartServicesRollback, arm64 (only built), the log-file check. Built locally with wix: arm64 MSI, FailAfterInstall MSI, edge-versioned MSI (0.1.1.57).

## Not working / left
- Uninstall dialog (RemoveDataDlg): ui-test.ps1 found no dialog when `msiexec /x` ran with full UI (uninstall ran straight through, data kept). Changed scheduling from Before=ProgressDlg to After=CostFinalize; UNVERIFIED. If it still does not show, check the msiexec /x /l*v log for the Show action, or use a custom WixUI set with a maintenance flow. The ui-test step in installer.yml may need continue-on-error until proven.
- CI has not run: no workflow run appeared for the branch (draft PR; CI/dev-standards runs for other branches exist). Look at the PR checks after the conflict is resolved; workflow_dispatch of installer.yml needs the file on main first.
- Settings > Apps uninstall: package adds its own Apps entry with UninstallString `MsiExec.exe /x [ProductCode]` (full UI) and hides the MSI's own (ARPSYSTEMCOMPONENT); unverified by hand.
- Updater needs elevation: msiexec for a per-machine package must run elevated, but the service runs as NT SERVICE\crsp (non-admin, per R5.4). CRSP19 needs a SYSTEM-run path (e.g. a SYSTEM scheduled task with a fixed action, as comics-organizer does) or the service account choice must change. Not built; decision for the owner.
- A running tray or `crsp-agent` service from the install folder is ended during upgrade (agent service restarted afterwards); an updater process that is itself crsp.exe in that folder is killed too, so it must start msiexec detached and exit.
- WiX warning WIX1149 (core ServiceConfig) is harmless; could move to util:ServiceConfig.
- Windows console flash for `crsp tray` autostart remains brief (FreeConsole after start).

## State of this PC (system changes, all removed)
Ran elevated (UAC) on this PC: msiexec install/upgrade/downgrade/uninstall of the crsp MSIs (smoke.ps1 and ui-test.ps1), which created and removed service crsp, firewall rule "crsp console and agent link (private networks)", system PATH entry, Program Files\crsp, Start Menu crsp.lnk, HKLM Run crsp-tray, Uninstall entries, HKLM\SOFTWARE\crsp, C:\ProgramData\crsp. ui-test leftover C:\ProgramData\crsp was deleted by an elevated Remove-Item. Final read-only check: no service crsp, no crsp firewall rule, no crsp in machine PATH, no Program Files\crsp, no crsp.lnk, no crsp Run value, no Uninstall entry, no HKLM\SOFTWARE\crsp, no C:\ProgramData\crsp. A prepared diag.ps1 in the session scratchpad was NOT run. Also installed: dotnet tool wix 5.0.2 (repo-local manifest) and WiX extension cache under installer/.wix (gitignored).
