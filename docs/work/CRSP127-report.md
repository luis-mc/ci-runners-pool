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
(see commits)
