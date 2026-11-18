# TRAY4: update asks first and shows progress in the console theme

Branch `TRAY4-update-confirm-progress`, from `origin/main` (fbab8ea). Draft PR: see the PR list.

## What changed

1. **Stage file** (`internal/update/stage.go`, `stage.json` beside `result.json`): `downloading` (percent of the asset bytes), `waiting_for_jobs`, `installing` (rough percent from the msiexec verbose log), `restarting`, `done` (version), `failed` (error, log path, `failed_at`). Written by the manager and by the install helper; `update.Status.Stage` and `GET /api/v1/update` (`stage`, OpenAPI `UpdateStage`) show it. A write error is only logged.
2. **Console page `/update`** (`UpdateCompactPage` in `Updates.tsx`, `CompactGate` in `App.tsx`): no shell, chosen theme, the shared Wizard with steps Review, Downloading, Waiting for jobs, Installing, Restarting, Done. Review text is the owner's sentence; `Not now` / `Update now`; progress bar with percent; `Running jobs are safe.`; `Hide`; failure names the step and the log path; polls through the service restart and ends with `Updated to X.`; opened on a running update it follows without asking; a done stage under 45 min old shows `Updated to X.` after a reload.
3. **Shared UI** (design-system `next-version` first, C87): `Wizard` takes `backLabel` and `hide`; `Page` takes `frame="compact"`; the step bar stays wrapped in the compact frame.
4. **Tray** (`internal/tray/appwindow.go`): `BrowserLookup` (per OS: Windows Program Files / Local AppData, macOS /Applications and ~/Applications, Linux PATH names; Edge before Chrome before Chromium), `AppWindowOpener` runs `--app=<url> --window-size=520,420`, else the default browser. `Opener.Offer` opens `/update` through a one-time link; when no window can open it falls back to the native two-button box (words now `Update now` / `Not now`, body is the owner's sentence). A look while an update runs opens the page on its progress.
5. **Docs**: tray R5.43, operations R5.91, web-console R5.96 and their proof rows; change notes `TRAY4.md` in each feature; design-system words, components, UX-69, C87; screenshots in `docs/review/TRAY4/` (24 PNGs: confirm, running, failed, done x window 520x420, phone 393, desktop 1300 x Phosphor and Tokyo Night, rendered with the built binary and mocked API).

## Where the task text and main differed

- The task says the tray shows a one-button OK box. Main (CRSP147/TRAY2) already had a two-button dialog (`Install now` / `Later`, WinForms, zenity, kdialog, osascript) and the Review wizard at `/settings/updates/review`. I kept that dialog as the fallback (Windows MB_YESNO was not needed: the form already has two buttons) and renamed its words to the owner's.
- The first Wizard step `Reading the service` is not shown on the compact page (the Wizard still has a loading phase); `firstStep={-1}` keeps `Not now` pressable on Review.

## Known limits

- msiexec stops the service part way through the upgrade, so the installing percent freezes there; the page then shows the restart note and waits. The controller tails the log only while it lives. After the restart `recoverMSI` writes `done` or `failed`.
- At 520x420 the failed state is a few pixels taller than the window; the action bar needs a short scroll there. Confirm and running fit.
- Not run here: a real MSI install, a real `--app` browser launch, the OS dialogs (no Windows or desktop in this sandbox). The lookup and the opener are tested with fakes.

## Tests

- Go: `internal/update/stage_test.go` (stage file, percent, MSI log parse incl. UTF-16, manager and helper stages, download progress), `internal/api/handlers_update_test.go` (stage in the API), `internal/tray/appwindow_test.go` and `update_prompt_test.go` (opener lookup per OS, Offer opens the page, fallback, Not now installs nothing).
- Web: `UpdatePage.test.tsx` (first run, asks first, Not now, running with percent and Hide, follows a running update, restart wait and Updated to X, failed, done after reload), `wizards.test.tsx` (`update-page` passes the ten wizard states, known list stays empty).
- e2e: `/update` passes ux-routes, a11y, ux-look; `design-layout.spec.ts` has four `/update` states at 360, 393, 1300 px. The kit's known lists are unchanged.
- Local: golangci-lint 2.15.0 (built with go1.27.4) 0 issues; `go vet`, `go test` of the touched packages, web typecheck, prettier, eslint.

## Notes for the owner

- `pnpm install` ran the repo's `prepare` script, which sets `core.hooksPath=.githooks`. The hook files are not executable in this checkout, so git skipped them; I ran `.githooks/pre-commit` and `.githooks/pre-push` by hand (both pass) and did not use `--no-verify`.
- Node here is 22; the repo wants 24. I ran pnpm with `engine-strict=false`. Two vitest tests fail on main as well (AuditLog and ConfigExport export downloads); not touched.
- The preinstalled Chromium is a different build than Playwright 1.65.1 expects. I ran Playwright with a throwaway config that points at `/opt/pw-browsers/chromium` (not committed).
- `docs_fold.py` and `docs_check.py` (the luismc-docs plugin) are not installed here. I wrote the change notes by hand in the format of the existing ones and did not run `docs_check.py`.
- This report lives in `docs/work/` and must not go into the PR for main.
