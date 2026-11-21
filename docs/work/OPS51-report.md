# OPS51 report

Quiet hours dropped everywhere (owner decision 20 Nov: "Drop the concept").

- Contract: `docker_compact_quiet_start/end`, wait reason `quiet_hours`, pause reason `quiet_hours`, taking reason `quiet_hours`, compact skip reason `outside_quiet_hours` removed from `openapi.yaml`; regenerated with `go tool oapi-codegen` (both configs) and `pnpm --filter @crsp/contract run codegen`. Proto `DockerDiskReport` field 7 (`utc_offset_seconds`) and its name are `reserved`; `go tool buf generate` rerun.
- Go: `machines` (compact policy, settings, types, taking), `scheduler` (`WaitQuietHours`, `WarmHoldQuiet`), `api` handlers, `cli` (`--docker-compact-hours`, quiet line), `tray` word, `agent` offset report. Compact now has no time-of-day gate: it runs at any hour when the other checks hold.
- Web: `jobs/words.ts`, `MachinePolicy.tsx`, `MachineDockerDisk.tsx` (hour lists gone; a note says when the compact runs), tests.
- `cmd/crsp/testdata/machine_up.json`: reason `base_image_missing`.
- Docs: machines R5.28 and scheduling R5.56 marked dropped (numbers kept); caches R5.52 says when the compact runs; cli, tray, web-console, observability, github-integration, product, landscape; design-system `next-version` content.md, review-visuals, CHANGES C6. Change notes OPS51 on machines, scheduling, caches, cli, web-console, tray.
- Left alone on purpose: `quiet` in unrelated senses (quiet button style, `demand.quiet` doctor finding, `--quiet` flags, quiet stale sessions).
- `docs_check.py --strict`: only W1 (docs/work files, stripped at the join).
