# CRSP119 report: agent install on Windows

Branch: CRSP119-agent-install-windows (base 68d30b3).

## Bugs
1. Not elevated: install printed the plan and failed at step 2 (Access is denied).
2. `--data-dir` default was `os.UserConfigDir()/crsp-agent`, hiding `defaultDataDir` of internal/agent/plan.go.
3. PowerShell errors came back as raw CLIXML.

## Plan
- internal/agent: `Elevated()` per OS (token elevation on Windows, euid 0 on Unix); `Plan.RunElevated` refuses before the prompt; `ErrNotElevated` one plain line.
- cmd/crsp: no UserConfigDir default for install; `agent run` and `agent join` take the machine-wide default; explicit `--data-dir` kept.
- powershell.exe: `-OutputFormat Text`, `$ProgressPreference='SilentlyContinue'`; osExec decodes leftover CLIXML to the exception message.
- A failed step names what was left behind (the data folder) and how to remove it.
- Tests, spec text, change notes.

## Status
- [ ] code  - [ ] tests  - [ ] docs  - [ ] draft PR
