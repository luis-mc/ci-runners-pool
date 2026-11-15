# HND21 report: parity gate (parity-plan items 6 to 8)

Branch `HND21-parity-gate`, from origin/main. Written first, kept current.

## Done

- `internal/parity`: soak plan, judge (lost job, duplicate listener, p95 wait, too few jobs), pool checks, report with pass/fail logic, fake source for the dry run. Tests: `parity_test.go`.
- `crsp parity check|soak|report` in `internal/cli/cmd_parity.go`; `doctorRun` helper pulled out of `crsp doctor`. Tests: `cmd_parity_test.go`.
- `.github/workflows/parity.yml`: `workflow_dispatch` and nightly, self-hosted runner (repository variable `PARITY_RUNS_ON`, default `["self-hosted","linux"]`), artifact `parity-report`; added to `artifact-prune.yml`.
- `docs/guides/runbooks/move-to-crsp.md`; parity plan updated (precondition of HND13 and HND14, soak table, status rows).
- cli spec R5.28 and `docs/features/cli/changes/HND21.md`.

## Not done, on purpose

- The soak was not run. Only the dry run with fakes (`crsp parity soak --dry-run`).
- No fixture jobs J1 to J13 in `parity.yml`, and no live collection of a soak from the controller (`soak` reads an observation file). Both stay in v0.7.0.

## Checks run here

- `go test -race ./internal/parity ./internal/cli`: green.
- `GOOS=windows go vet ./...`: see the PR.
- `golangci-lint`: not run. The installed binary is built with Go 1.25 and refuses go.mod's 1.27.4. CI runs it.
- `actionlint`: not run. Downloading the pinned release was denied in this session. YAML parses. CI runs actionlint.
- `docs_check.py`, `docs_fold.py`: the luismc-docs scripts are not in this sandbox. The change note is written by hand in the format of the other notes.
