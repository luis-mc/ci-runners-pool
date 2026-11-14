# CI Runners Pool

CI Runners Pool manages shared self-hosted GitHub Actions runners on your own machines.
It runs on Windows, Linux and macOS.
One binary, `ci-runners-pool`, has several modes.
The `controller` mode holds the configuration, talks to GitHub, schedules work, and serves the web console and the API.
The `agent` mode runs on every machine and connects out to the controller.
A `tray` mode is planned.

## Status

Pre-alpha. Milestone 1 is in progress.
Only the repository skeleton exists.
The controller starts, answers `/healthz` and serves a placeholder web console.
The agent mode is not implemented yet.

## Build from source

You need Go 1.27.4, Node 24, pnpm 10 and, to lint, golangci-lint 2.
The Go tools (go-task, oapi-codegen, sqlc, buf) are pinned in `go.mod` and run through `go tool`.

```sh
pnpm install            # web dependencies, and git hooks via core.hooksPath
go tool task build      # web console, embedded, then bin/ci-runners-pool
go tool task test       # Go tests and web tests
go tool task lint       # gofmt, go vet, golangci-lint, ESLint, Prettier, tsc
go tool task codegen    # regenerate API, query, protocol and TypeScript code
pnpm e2e                # Playwright smoke test against bin/ci-runners-pool
```

`pnpm build`, `pnpm test`, `pnpm lint` and `pnpm codegen` call the same tasks.

Run the controller:

```sh
CRP_DATA_DIR=/path/to/data bin/ci-runners-pool controller
```

Settings are `CRP_*` environment variables; see `.env.example`.

## Contributing

Read `AGENTS.md` and `docs/architecture/stack-profile.md` first.
Commits carry no AI attribution trailers; a commit hook checks this.

## Licence

MIT. See `LICENSE`.
