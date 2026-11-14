---
id: 0001-stack
title: One Go binary, embedded SQLite, embedded React console
status: accepted
date: 2026-11-13
supersedes:
superseded_by:
type: explanation
---
# One Go binary, embedded SQLite, embedded React console

## Context and problem

The product runs on the user's own machines, not on a hosted service.
It has four parts: a controller, a node agent on every machine, a web console and a CLI.
Machines run Windows, Linux and macOS, on amd64 and arm64.
Install must be one download and one command.
The agent shares each machine with the owner's work and with running jobs, so it must stay small.
The full stack record is the Stack Profile, `docs/architecture/stack-profile.md`.

## Options considered

1. **Go, one binary.**
   Pros: GitHub's official scale-set client `github.com/actions/scaleset` is Go.
   `go-github` is mature.
   The prior art (Actions Runner Controller, GARM) is Go, so its designs can be read directly.
   Fast compiles.
   Cross-compiles to six targets with `CGO_ENABLED=0`.
   `golang.org/x/sys/windows/svc` runs it as a Windows service.
   Cons: a garbage collector and about 15 to 30 MB of memory per process.
   Weaker types than Rust (nil values, unchecked errors).
2. **Rust, one binary.**
   Pros: the smallest memory use, no garbage collector, the strongest types, SQL checked at compile time.
   Cons: no official scale-set client, so the long-poll protocol of a preview API would be ported and tracked by hand.
   Slower compiles and slower feature work.
3. **Go controller and Rust agent.**
   Cons: two toolchains and two sets of tests for a small gain.

## Decision

Option 1: Go 1.27, one static binary named `ci-runners-pool`, with the modes `controller`, `agent`, `tray` and CLI commands.
The memory Rust would save is small next to the gigabytes each runner uses.
The official client and the faster work matter more.

The rest of the stack:

- HTTP API: the standard library `net/http` with an OpenAPI 3.1 contract, written by hand first (`packages/contract/openapi.yaml`).
  The Go server code and the TypeScript client are generated from it.
- Agent to controller: gRPC with connect-go (see [0004](0004-agent-link.md)).
- Storage: SQLite inside the binary (`modernc.org/sqlite`, pure Go), queries with sqlc, migrations with goose.
  Postgres is a later option for larger teams.
  The job queue is a table in the same database, written in the same transaction as the change that makes the job.
- Web console: a React single-page app (Vite, React Router, TypeScript, pnpm), built to static files and embedded with `go:embed`.
- No email, analytics or third-party error tracking in the first milestones.
  Errors go to local logs, crash files and the doctor.

## Consequences

- One file per OS and architecture installs everything.
- Windows and Linux builds need no C compiler.
  macOS builds run on macOS CI runners, because the tray needs Cocoa through cgo there.
- The contract is the seam: the web app and the CLI use the same generated client.
- SQLite has one writer at a time.
  That is enough for one controller and its machines.
  A large team moves to Postgres.
- SQLite has no statement timeout.
  Every query gets a context deadline, and the database has a busy timeout.
