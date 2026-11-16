# CRSP120 report: the controller's own agent (machines R5.1, R5.2)

## Found
- Built already: `machines.Service.LocalCredential`, `Join` with `Local`, `agent.Config.LocalCredentialFile`, and `startMachines` in `cmd/crsp/machines_wiring.go` starts the in-process agent over loopback. `local_agent_test.go` exists.
- Gap 1: setup state never set `first_machine` to `done`; the wizard always showed the install command, even with this PC in the pool.
- Gap 2: no duplicate rule against a separately installed agent on the same host.
- Gap 3: the local credential file is written once and lives 10 minutes; a re-join later (key refused) would read an expired one and stop the agent.
- Identity: the agent keeps machine id and key in `<data>/agent/secrets` (0600 files) so a restart reuses them. The machine repository is still in memory (no SQLite adapter yet), so the controller side forgets machines on restart; that is the repository's gap, not this task's.

## Plan
1. Go: duplicate rule in `Service.Join` (Local) and in `startMachines`; refresh the credential file; `GitHubArea.HasMachine` sets `first_machine` done; tests.
2. Web: first-machine step done state, Vitest.
3. Docs: spec text, test table, change notes, design-system next-version content and CHANGES.

## Status
Go (duplicate rule, credential renewal, first_machine setup state, tests) and web (FirstMachineDone, Vitest) pushed. Docs: spec text, test table, change notes, design-system C24. Not run: docs_check.py (luismc-docs plugin not in this sandbox). darwin vet fails on fyne systray (cgo, not touched).
