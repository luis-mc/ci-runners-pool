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

## Done later

- API: `mode`, `pause_on_battery`, `cpu_cap_pct`, `pause_until`, `pause_until_resumed` on machine settings; `accepting`, `pause_reason`, `policy` on the machine; PATCH takes `pause` (one_hour, until_resumed, none). Wait reasons `paused`, `on_battery`.
- Console: When it works section on the machine page, Takes jobs column on the list.
- Specs: machines R5.60 to R5.63, tray R5.42, scheduling R5.66, web-console R5.65; change notes CRSP75 in the four features; content.md Machine policy words; CHANGES C17.

## Checks run

- `go test -race`: power, cpucap, machines, agent, tray, trayserver, api, cmd/crsp, hooks; scheduler new tests (the full scheduler package takes 5 minutes, it passed before the new test file was added).
- golangci-lint v2.15.0 (built with Go 1.27.4) on the touched packages: 0 issues. `GOOS=windows go vet` and golangci-lint clean; `GOOS=darwin go vet` clean for the packages without cgo.
- `pnpm --filter web typecheck lint test`: all green. Prettier on changed files.
- Not run: the Windows tests (`cap_windows_test.go`, they compile under `GOOS=windows go vet`), the e2e suite, Docker, the full suite.
- `docs_fold.py` and `docs_check.py` were not found in this environment (no `<luismc-docs>` path). The change notes were written by hand in the existing format; `docs_check.py` still has to run.
- The `.githooks` files are not executable in this checkout, so git ignored them; the commit-msg rule (no attribution) was kept by hand.

## Open questions

See machines spec M-12 to M-16. In short: a tray pause holds in Always; `budget` is shown but not held by the controller gate; a drained machine reports `paused`; an old settings cache has the battery pause off; the Linux cap needs permission to write the cgroup.
