# CRSP138 report: fast, clear MSI upgrade

Branch `CRSP138-msi-upgrade`. Status: code done, CI result pending.

## Cause
The owner's 0.1.1 to 0.1.2 upgrade took 3 min 36 s. The per-user tray holds `crsp.exe`. The package only ended it after InstallValidate, and the old product's own removal ran the old sequence. Nothing told the user what the wait was.

## Plan
1. `crsp tray --quit` and a tray quit handler (WM_CLOSE on Windows reaches the systray window; SIGTERM/SIGINT elsewhere). The tray exits and releases the exe.
2. MSI: immediate action `CloseTray` before InstallValidate. It asks every tray under the install folder to quit (`taskkill /pid`, no /f), waits 5 s, then ends what is left. Works with any old version, so it does not need the new `--quit`.
3. Service stop stays `ServiceControl Stop=both Wait=yes` plus StopServiceEarly; Stop-Service now has a 20 s bound.
4. `ProgressText` for each step.
5. Spec R5.86, test row, change note.
6. `installer/upgrade-test.ps1` plus a job in `installer.yml`: install previous MSI, start tray, upgrade with /qn and a log, fail over 60 s or on a Files in Use entry.

## Steps
(updated as work lands)

- Step 1 pushed: tray quit handler (`internal/tray/quit*.go`, `tray --quit`), `CloseTray` before InstallValidate, progress text, bounded service stop.
- Step 2: `installer/upgrade-test.ps1` and the installer.yml job; spec R5.86, test row, change note CRSP138.
- Local: `go test -race ./internal/tray` green; `GOOS=windows go vet` clean; WiX XML parses. `golangci-lint` here was built with Go 1.25 and refuses the repo's Go 1.27.4, so lint was not run locally. WiX build and the upgrade timing are not run here (no Windows): CI is the proof.
- `docs_fold.py` is not in this sandbox; the change note was written in the same format by hand.
- Known limit: the old product's own removal runs the OLD package's sequence (0.1.1 has no CloseTray); CloseTray in the new package runs first and removes the tray, which is the main hold.
