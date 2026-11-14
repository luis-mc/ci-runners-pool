# CRSP22 report: persistent runners on Windows, Linux, macOS

Status: in progress. Updated after every step.

## Design
- `internal/backend/sys`: injected seams (Commands, FS, Fetcher) with real and fake implementations. Tests assert exact PowerShell, systemd and launchd calls; nothing real is created.
- `internal/backend/persistent`: shared pieces (env file, meta file, rerun decision, pinned download).
- `internal/backend/{windows,linux,macos}`: script and unit generation (untagged, tested on any OS); `internal/backend/registry` has build-tagged files so each binary holds only its OS backend (R5.24).
- `internal/runners`: labels, version pins and SHA-256, account names, states, plans (add, replace), drain and idle check, remove with remove token.
- `internal/api/handlers_runners.go`: runner operations over a small service interface.
- `packaging/hooks`: embedded hook scripts (.ps1, .sh).

## Steps
1. Report written.
