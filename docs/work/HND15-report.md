# HND15 report: replace runner files over the agent link

Branch `HND15-runner-file-swap`, base origin/main 40f779d. Spec: runners R5.38 and new R5.68; parity-plan row 19 and "What is left" item 4.

## Built
- Proto (agent.v1): `PROTOCOL_VERSION_2`, `UpdateRunnerFiles` (SessionResponse 23), `MachineReport.runner_swap`, `RunnerResult.version` and `rolled_back`. Fields only added; old agents unaffected.
- Version gate: the controller sends the message only when the machine's report says `runner_swap`. An older agent never sets it, so it is sent nothing and the update answers "the agent of this machine cannot update runners yet".
- `internal/runnerswap`: SHA-256 check, tar.gz/zip unpack with path guard, stage folder, rename swap per entry, previous version kept in `.crsp-prev`, rollback on any failure, `ServiceHost` (systemctl, PowerShell, launchctl).
- Agent: `internal/agent/runner_files.go`. `Gate.HoldRunner` (hold and idle check in one step), `waiting` answer on drain timeout, hold released always.
- Controller: `internal/agentlink/update.go` (`Updater`, checks the hash before sending). Wiring in `cmd/crsp` (agent folder lookup from the service list; bundle fetched from the pin URL).
- Docs: runners spec R5.38 text, new R5.68, test map; parity-plan; change note `docs/features/runners/changes/HND15.md`.

## Tests (all pass with -race)
swap ok; checksum mismatch refused (controller and runnerswap); failure mid-swap rolls back (runnerswap and over the link); start failure rolls back; rollback failure said; running job never interrupted (waiting, nothing stopped, runner takes jobs again, then update succeeds); hold keeps new jobs out; older agent not sent the message.

## Not done / notes
- One runner per message; the archive is repeated per runner (limit 512 MiB per message).
- No real remote machine run (parity plan item 2 still open). The service commands per OS are untested on real systems.
- `golangci-lint` here is built with go1.25 and cannot load the repo config; CI lint decides. `GOOS=windows go vet ./...` clean. No shellcheck targets changed.
- `docs_check.py` / `docs_fold.py` (luismc-docs plugin) are not installed here; the change note was written by hand in the format of the existing notes.
- This report is a branch file (docs/work); drop it when the train joins.
