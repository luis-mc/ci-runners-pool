# HND24 report: crsp machine maintain

Branch: HND24-maintenance-command (from origin/main 83317c3). Source: handover lesson 30 (draft PR #133).

## Plan
1. Proto: `RunHostCommand` (controller to agent), answer in `RunnerResult` (exit_code, output); `host_command` flag in `MachineReport`.
2. Agent: runs argv with `exec.CommandContext`, no shell; output tail kept; timeout.
3. Agent link: `Link.RunHostCommand`.
4. API: `POST /api/v1/machines/{machineId}/command`, owner role; refuses unless the machine is drained and idle.
5. CLI: `crsp machine maintain NAME [--yes] [--command-timeout D] -- COMMAND...`: drain (R5.16 wait), run, always resume (fresh context, confirm), report. Never cancels a job.
6. Spec R5.29 + change note HND24; tests.

## Status
- [x] proto + codegen
- [x] agent (code; tests pending)
- [x] agent link (code; tests pending)
- [x] API (code; tests pending)
- [ ] CLI
- [ ] docs
- [ ] checks, draft PR

## Notes
- Machine already drained before the run: refused (exit 7); the hold is not ours to lift.
- Ctrl-C during the command: the hold is released with a fresh context; the host command keeps its own timeout.
