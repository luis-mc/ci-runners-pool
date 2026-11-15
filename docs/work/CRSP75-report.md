# CRSP75 report: laptop and desk policy per machine

Branch `CRSP75-machine-policy`. Owner decision D51 (2026-11-15). Branch only, never in the pull request for main.

## Done

- Agent protocol: `MachineSettings` fields 20-24 (mode, pause_on_battery, pause_until, pause_until_resumed, cpu_cap_pct); `AcceptingReport` (SessionRequest 23).
- `internal/machines`: settings `Mode`, `PauseOnBattery`, `PauseUntil`, `PausedUntilResumed`, `CPUCapPct`; `Machine.Accepting` and `Machine.PauseReason`; `Service.Policy`, `Service.Accepting`.
- `internal/power`: battery detection (Linux sysfs, macOS pmset, Windows GetSystemPowerStatus). Unknown is mains.
- `internal/cpucap`: Windows Job Object CPU rate, Linux cgroup v2 cpu.max, macOS not supported.
- Agent: gate holds with `paused` / `on_battery`, policy loop reports, CPU cap applied.
- Scheduler: `WithAccepting` hold with `paused`, `on_battery`, `quiet_hours`.
- Tray: Mode submenu, Pause for 1 hour, Pause until I resume, Resume, header word; channel calls mode, pause, resume.

## Decisions I made (owner may overrule)

1. A pause from the tray holds in every mode, also Always. Always only ignores the battery.
2. `budget` is reported in `PauseReason` but the controller gate does not hold on it: the gate checks the live load itself, and a 15-second-old report would hold a job that now fits.
3. A drained or draining machine reports `Accepting=false` with `PauseReason=paused` (the four values are fixed).
4. Quiet hours (machines R5.28) are not built (M3). `quiet_hours` is a defined value that nothing produces yet; the gate already holds on it.
5. A machine that has reported nothing (an older agent) counts as accepting.
6. The machine settings still live in the in-memory repository (the SQLite adapter is not written), so no migration was added.

## Open

See the pull request.
