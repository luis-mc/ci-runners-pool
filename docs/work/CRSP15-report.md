# CRSP15 report: rename product to CI Runners Shared Pool (crsp)

Owner decision 2026-11-14: name "CI Runners Shared Pool", initials CRSP, binary `crsp`.

## Done
- Go module path now github.com/luis-mc/ci-runners-shared-pool (go.mod, imports, .golangci.yml, proto go_package); generated code regenerated with `go tool task codegen`.
- cmd/ci-runners-pool moved to cmd/crsp; binary and artifacts `crsp-<os>-<arch>` (workflows, Taskfile, playwright config, E2E_BINARY).
- Display name, env prefix CRSP_, npm scope @crsp/*, docs and README updated.
- Default data dir name is now `crsp`.

## Checks
go build, go vet, go test (21 passed), gofmt, codegen drift (none), pnpm typecheck and lint, prettier (line endings auto, Windows CRLF checkout), vitest (117 passed), task build + `crsp version`, docs_index build, docs_check (0 errors), design_system check (0 findings).

## Remaining old-name hits
- docs/design-system/v1/CHANGES.md and v1/review-visuals/index.html: approved read-only v1.
- docs/features/**: not touched (orchestrator renames at join); none on main today.
- Task IDs CRP1, CRP2 and history (git log, earlier commits): stay.
