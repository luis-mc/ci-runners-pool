# CI Runners Shared Pool

CI Runners Shared Pool manages shared self-hosted GitHub Actions runners on your own machines.
It runs on Windows, Linux and macOS.
One binary, `crsp`, has several modes.
The `controller` mode holds the configuration, talks to GitHub, schedules work, and serves the web console and the API.
The `agent` mode runs on every machine and connects out to the controller.
A `tray` mode is planned.

## Status

Pre-release. Milestone 1 is built and not yet released (v0.1.0 is next).
The controller, the agent, the web console, the CLI, the tray, the slot queue and load gate, persistent runners for Windows, Linux and macOS, backup and the doctor core checks exist.
The feature specs in `docs/features/` say per requirement what is built and what is not.

## Build from source

You need Go 1.27.4, Node 24, pnpm 10 and, to lint, golangci-lint 2.
The Go tools (go-task, oapi-codegen, sqlc, buf) are pinned in `go.mod` and run through `go tool`.

```sh
pnpm install            # web dependencies, and git hooks via core.hooksPath
go tool task build      # web console, embedded, then bin/crsp
go tool task test       # Go tests and web tests
go tool task lint       # gofmt, go vet, golangci-lint, ESLint, Prettier, tsc
go tool task codegen    # regenerate API, query, protocol and TypeScript code
pnpm e2e                # Playwright smoke test against bin/crsp
```

`pnpm build`, `pnpm test`, `pnpm lint` and `pnpm codegen` call the same tasks.

Run the controller:

```sh
CRSP_DATA_DIR=/path/to/data bin/crsp controller
```

Settings are `CRSP_*` environment variables; see `.env.example`.

## Contributing

Read `AGENTS.md` and `docs/architecture/stack-profile.md` first.
Commits carry no AI attribution trailers; a commit hook checks this.

## Licence

MIT. See `LICENSE`.
