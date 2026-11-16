# CRSP127 report: Linux jobs on a Windows machine

Branch `CRSP127-linux-on-windows`, base main 68d30b3.

## Findings (before work)
- `agentv1.MachineReport.engine` (proto) and `agent.DetectEngine` already exist; the link carries kind/usable/version/reason. Missing: which OS the containers run (`container_os`), and the machines service never records the report (only `agentlink` keeps the raw last report).
- Windows registry has no container backend; `container.Docker` already routes Windows CLI first.
- `runners.chooseBackend` and the web wizard match `machine.os == os` only, so System Linux greys out a Windows machine.
- `wsl --status` non-zero gives "WSL is installed but not ready" even when Docker Desktop's WSL2 engine works.
- Backends list prints the reason twice: `CheckRow` help and `disabledReason` both carry it.

## Plan
1. proto `EngineReport.container_os`; regen; codegen-drift.
2. agent: read engine OS type; WSL2 backend not-ready fix.
3. machines service: record engine (in memory like policy), expose in View and API (`container_os`).
4. runners: Linux container runner on Windows machine; labels; Windows registry gets the container backend.
5. repos: RUNS_ON_LINUX served by such a machine.
6. web: AddRunners eligibility, machine list text, backends text.
7. docs, change notes, design-system content + CHANGES.

## Progress
All steps built.
- proto `EngineReport.container_os` (field 5), regen, codegen-drift none.
- agent: `DetectEngine` reads `docker info {{.OSType}}`; `wsl2` backend usable when docker runs on the WSL2 kernel even if `wsl --status` fails (read only).
- machines: `HandleMachineReport` records the engine in memory (like policy); `View.Engine`; API `container_os`.
- runners: Linux ephemeral container runner on a Windows machine with Linux containers; pool label added; persistent Linux refused on Windows; Windows registry now holds the container backend.
- cmd: demand hosts and `RUNS_ON_LINUX` serving include such a Windows machine (container backend allowed).
- web: AddRunners eligibility and kind, System column text, backend reason once; words in next-version content.md, CHANGES C24.
- specs: runners R5.47 text, machines R5.18 text, change notes CRSP127.
- Tests: Go (agent, machines incl. over the link, runners, container args on Windows, cmd, api), Vitest (runners, machines). golangci-lint 0 issues, GOOS=windows vet clean. GOOS=darwin vet of cmd fails on the fyne systray cgo dependency, same as base; internal packages vet clean.

## Not built / owner check
- crsp binary mount (R5.48) on a Windows host: agent's own file is a Windows binary, so no mount (existing behaviour).
- docs_fold.py / docs_check.py not available in this sandbox; change notes written by hand in the same format.
- No Docker here: nothing run against a real Docker Desktop.

