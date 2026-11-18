# TRAY5: update window and installer windows, options review

Status: options only. The owner chooses; nothing is shipped. Committed app code is unchanged. Side-by-side page: `index.html` (theme and 100% / 150% switches, every state, today's windows as the baseline). Prototype patches: `patches/option-A.patch`, `option-B.patch`, `option-C.patch` (apply with `tools/proto/apply.sh <A|B|C>`; rebuild every screenshot with `tools/run-all.sh`).

## What the screenshots are, and are not

- Updater: real screenshots of the real `/update` page (the page the tray opens) from the Vite dev server, service answers mocked, Chromium 1243 on Linux. Dark = Phosphor dark, light = Phosphor light. 100% and 150% are device scale 1 and 1.5 at the same window size in device-independent pixels.
- Installer: the same page code (the shared wizard) with an installer route, so it shows what an installer window in options A and B would look like. The real installers are Windows Installer (WiX), Apple Installer (.pkg) and apt/dnf; none can be rendered on this Linux box, so no screenshot is native. Option C's installer is therefore a web replica of an MSI dialog, not a Windows render. The baseline installer (stock WixUI_Minimal) has no screenshot for the same reason.
- The OS title bar is drawn by the review page around the screenshot. Window frames, `resizeTo`, `theme-color`, WebView2 and focus rules are NOT tested on Windows, macOS or a Linux desktop here. Each item marked "verify" must be tried on the real OS before the option is chosen.

## Why today's window looks broken (found while reproducing it)

Reproduced at 1100 x 880: dark Phosphor column of 40 rem, huge empty area, 6-step strip on two rows, buttons at the right end of the column.

1. No `<link rel="icon">` in `apps/web/index.html`, so an app window shows the browser's globe.
2. `--window-size=520,420` is only a hint. A Chromium app window with a profile that already has a remembered size (the owner's Edge) opens at that size. The page cannot fix it without its own profile or `resizeTo`.
3. The compact frame is a 40 rem centered column in a window; the action bar is only at the foot when the shell frame exists, and there is none here.
4. The step names are long, and the compact frame deliberately wraps them.
5. Bug 2 is not in the page: the new tray starts with `--updated` and calls `DesktopNotice` (`internal/tray/run.go:91`), which on Windows is a plain `MessageBox` (`notify_windows.go`). The page already has the right Done state (`done-after-reload`, within 45 minutes); the tray just never opens it after an update.

Independent of the option (small, recommended whichever is chosen): add the favicon; give the tray window its own `--user-data-dir`; after an update the new tray opens the update window on Done (same host) and shows no message box; the Done words are `Now running 0.1.12.` (the prototypes already use them). Not done here because the brief says options first.

## The three options

| | A: compact dialog | B: one frame | C: native look |
|---|---|---|---|
| Idea | Fixed 560 x 420 dialog. Steps are a vertical list on the left, content fills the window, brand at the top of the list. | One frame for updater and installer: header band (icon, name, window name), a one-row step strip with short labels (Review, Download, Jobs, Install, Restart, Done), content, action bar with the primary at the bottom right. | The MSI dialog look: white banner with title, "Step 4 of 6: Installing" and the crsp icon, a body, a grey button bar. Windows light or dark colours. The updater is a web page skinned like it. |
| Theme | Phosphor (follows the console) | Phosphor (follows the console) | Windows light/dark only. Windows Installer cannot follow a web theme, so this goes against the TRAY4 owner decision "theme like the web page" for the installer, and for the updater by choice. |
| Window size | 560 x 420 fixed, every state fits (long failure text scrolls in the right pane). 150% scaling: same size in device-independent pixels (840 x 630 physical). | 560 wide, height 360 to 440 by state: the page asks the host to resize (`window.resizeTo`, verify in an app window); if the host refuses it stays 560 x 440. 150%: same in dips. | 500 x 370 fixed (about a WiX 370 x 270 unit dialog). At 150% the real MSI dialog is not DPI aware: Windows scales it as a bitmap (soft text); the web replica stays sharp, so the two would not match on a 150% screen. |
| Title bar | crsp icon, "Update - CI Runners Shared Pool" (installer: "Setup - ..."), close only. | crsp icon (from the favicon), same title, min, max, close (a Chromium app window cannot hide min and max). | crsp icon, "CI Runners Shared Pool Update" / "Setup", close only. |
| Opens where, on top? | Centered on the screen of the tray icon, brought to the front, not always-on-top (an update must not cover work). The taskbar button flashes when it ends or fails. | Where the browser puts it; the tray can add `--window-position` for the center (Windows needs a work-area call). Not on top. | MSI dialogs center on the screen and take the foreground; the web part as A. |
| Enter | Default button: Update now (Review), Close (done, failed). While it works Enter does nothing (the busy button is disabled). | Same | Same |
| Escape | Not now on Review, Hide while it works, Close on done and failed. It never stops the update. | Same | Same (Cancel on the MSI dialogs) |
| Tab order | Left to right on the bar (Not now, Update now). Step list is not a tab stop (it only informs; the shared wizard part makes the current step focusable today, so the part needs one change). | Same, strip not a tab stop. | Same, banner not a tab stop. |
| Hide / close mid-update | Closes the window only; the service goes on (R5.96). The tray menu item `Update to ... updating` reopens it on the live step. | Same | Same |
| Across the service restart | The host owns the window, so it stays open while the service is down and shows "Restarting the service" (it is already loaded; polling resumes when the service is back). A reload would fail for a web page served by the service, so the host (not the page) shows a waiting page and reloads. Done shows in the same window, no second one. | The page stays loaded and polls (works today). F5 in the app window shows a browser error page while the service is down. If the window was closed, the new tray opens one on Done (`--updated`); a page that sees another update window (`BroadcastChannel`) closes itself so there are never two. | As B for the page; the MSI part is a separate window with its own progress that ends before the service is back. |
| Started from the console or `crsp update` | No tray window opens. The console page shows its own steps; `crsp update` prints the stage lines. After the install the new tray shows Done once in this window only when a window started the update; an automatic update ends with one toast (with the crsp icon, click opens Done), never a modal box. The stage file needs a `started_by` field for this. | Same | Same |

### Per platform: what can and cannot be done, and the fallback

| | A (native host, close only) | B (Chromium app window) | C (native look) |
|---|---|---|---|
| Windows | Edge WebView2 (Evergreen, on Windows 11 and almost every 10) in a window without min, max or resize; pure Go, no cgo (verify). Fallback: B's host. | Edge, then Chrome (TRAY4 lookup). No browser: default browser tab, then the native two-button box (no progress). | MSI dialogs authored in WiX (banner and dialog bitmaps, icon) for the installer; web skin for the updater in either host. Verify at 150%. |
| macOS | WKWebView window with a close button only; needs cgo and a macOS build job for the tray. Fallback: B's host. | Edge, Chrome or Chromium `.app`. Traffic lights always show all three. | The `.pkg` stays Apple's Installer (only a background image, welcome and conclusion text can be branded); it cannot look like the web window. The updater would need a Mac skin. |
| Linux | WebKitGTK (`libwebkit2gtk`), cgo, a package dependency, not on every desktop. Fallback: B's host, then `zenity`/`kdialog` two buttons. | Chromium family on the PATH. | deb and rpm have no window at all; a GTK skin would be a third design. |
| Installer window | Windows: a setup program shows this window and runs the MSI quietly (progress read like the updater does). macOS and Linux: no installer window exists; the tray shows Welcome, Choices and Done once on its first start. | Same as A with B's host. | Windows: the MSI itself (native). macOS and Linux: as A. |

Elevation is a system prompt before any window in every option (the MSI is per machine); no option can restyle it.

## Trade-offs and cost

Sizes are relative (S: days, M: about two weeks, L: more), for one engineer, with the tests the repository asks for (unit tests, layout checks at 360, 393 and 1300 px, wizard states, Windows CI for the MSI parts).

- **A. M to L.** Best result in a window: fixed, calm, close only, the same page for updater and installer. Cost: a native window host per OS (Windows first, pure Go; macOS and Linux need cgo and extra packages) plus a setup program on Windows. The fallback host keeps working, but then min and max come back, so the promise "close only" is Windows and macOS only. Risk: three hosts to keep alive.
- **B. S for the updater, M with the Windows setup program.** Works on all three OSes with the host that exists since TRAY4. Fixes the owner's complaints (icon, size, strip on one row, one flow, Done in the same window). Honest weakness: min and max remain; the size is a request, not a rule, until `resizeTo` and the private profile are proven. Installer window only on Windows (new setup program) and as first-run on the other two.
- **C. L, and does not fit the stated decisions.** Closest to what a Windows person expects and the only one where the installer is the real installer. But: no Phosphor theme, soft text at 150%, a different design on macOS and Linux, WiX dialog authoring that is hard to test (`ui-test.ps1` is local only), and two looks to keep in sync (MSI dialog and web skin). It also drops "theme like the web page".

Recommendation: **B**, with the three independent fixes above (favicon, private profile, Done in the window), then move to A on Windows only if the verify items for min and max still bother the owner. C only if the owner wants a native installer more than one look.

## Open questions for the owner

1. Is "close only" a must, or is min and max acceptable (B)?
2. May the installer on Windows become a small setup program that shows the web window (A, B), or must it stay the MSI dialogs (C)?
3. Automatic updates: end with a toast (recommended) or open the Done window every time?

## Notes on the branch

- `docs/review/TRAY5/` only; no app code, no generated docs, no docs/work. The patches are text diffs you can read; the screenshots are the images they produce.
- `docs_check.py` (luismc-docs) is not available in this sandbox, so it was not run; repository guards were run instead (see the PR).
- Docs: none, review only, no behaviour change.
