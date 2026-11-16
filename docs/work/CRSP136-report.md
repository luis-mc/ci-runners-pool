# CRSP136 report: Docker disk auto-compact

Branch: CRSP136-auto-compact. Base: origin/main f6f720c.

## Plan (steps, pushed one by one)
1. Agent helper `docker-compact` (internal/dockercompact + agent wiring, GOOS-split host).
2. Machine setting (machines.Settings, API, CLI flags, openapi + codegen).
3. Policy decision + controller loop through the maintain path (hold, drain, compact, release).
4. Notices to projects, audit entries.
5. Facts + doctor line for missing admin rights, console action.
6. Console Machine page settings (packages/ui parts), content.md words + CHANGES.
7. Specs (caches, machines, operations), change notes.

## Notes
- The luismc-docs plugin scripts (`docs_fold.py`, `docs_check.py`) are not installed in this sandbox; change notes are written by hand in the existing `changes/<TASK>.md` format. `docs_check.py` was not run.
- Machine settings live in the in-memory repo (no SQL migration).

## Status: code done

Built (R-IDs: caches R5.51 to R5.54, machines R5.66, cli R5.61, doctor R5.44, web-console R5.92; design system C39):
- `internal/dockercompact`: the helper with a `Host` interface, Windows steps (find disks, trim, stop Docker Desktop, `wsl --shutdown`, Optimize-VHD or diskpart script, start, wait for `docker info`), unix prune only, RESULT line, Docker restarted after any failure; `OSHost` with `exec.CommandContext`.
- Agent: `docker-compact` handled in `RunHostCommand`; `DockerDiskReport` in the machine report (proto field 12); `Config.DockerHost` for tests.
- Controller (`internal/machines/compact.go`): settings, `DecideCompact`, `CompactPass` (every 5 min, `cmd/crsp/main.go`), `CompactMachine` (drain, wait, command, always release), `CompactNotifier`, audit entries, `docker_compact_status` on the machine view; `store.QueuedFor` is the queue source.
- API/openapi, CLI `machine settings`, doctor `machine.docker.compact`, Machine page Docker disk section (shared `@crsp/ui` parts only), content.md words + CHANGES C39.
- Specs and change notes: caches, machines, cli, doctor, web-console. `operations` has no maintain text, so it is unchanged.

Checks run: gofmt, golangci-lint v2.15.0 (0 issues), go vet, `GOOS=windows go vet ./...`, `GOOS=darwin go vet` on the touched packages (the full darwin vet fails in the unrelated systray cgo package), `go test -race` on dockercompact, machines, agent, api, cli, doctor, store, cmd/crsp, `scripts/ci/codegen-drift.sh` (none), web typecheck, eslint, prettier, Vitest of `src/screens/machines`.

Not done or open:
- `docs_check.py` / `docs_fold.py` (luismc-docs plugin) are not installed here: change notes were written by hand, `docs_check.py` was not run.
- Full web Vitest: 2 failures (AuditLog and ConfigExport download tests) that also fail on main with Node 22 (the repo wants Node 24); not touched.
- Notices: `Options.Notify` has no production implementation today (only tests set it), so the before/after notices have no delivery channel yet; the audit entries and the Machine page state are the record. Delivery rides notifications R5.1 to R5.5 when built.
- The agent reads the Docker disk on each machine report (every 10 min); on Windows this runs `reg query` and `wsl -d docker-desktop -e df`, which can start the distro when Docker Desktop is off. A later change can skip it when `docker info` does not answer.
- No Playwright/e2e or DOM layout run at 360/393/1300 (no browser run of the new section); the no-app-CSS scan was not run separately (the section uses shared parts and no `style=`).
- `docs/work/` is on the branch only; drop it when the pull request merges.
