# CRSP112 / CRSP105 report

## CRSP112 spec drift (status text only)

| Line | Verdict | Evidence |
|---|---|---|
| doctor R5.37 | built in part | `internal/doctor/checks/machine.go` `machineDiskFloor` (check `machine.floor.disk`, fails for `disk_low`, tests `checks_test.go` near line 825); `machineDisk` still warns at 15% / 10 GB. Missing: warn at floor + 20%, name largest crsp folders, `unknown` for an unreadable disk. |
| doctor R5.38 | NOT built | no `security.reach` check; `SECURITY.md` has no "What a job can reach" section. Left unchanged (no change note). |
| github-integration R5.41 | built in part | CRSP82: `internal/repos/public.go`, `reconcile.go`, `internal/github/webhook.go`, tests `public_test.go`, `reconcile_test.go`, `webhook_test.go` (spec R5.47, R5.48). Missing: visibility re-read right before each runner starts, console/doctor naming, one notification, the job-started fork-guard hook (R5.26). |
| machines R5.60 | built in part | CRSP83 as runners R5.83: `internal/runnercache/floor.go` (`floor_test.go`), `internal/agent/run.go`, `policy_test.go`, `internal/config/config.go`. Differs: setting `disk_floor_gib`, default 10 GiB, resume +1 GiB, no percentage form, not counted in gate max wait. |
| runners R5.63 | built in part | CRSP81 `internal/backend/container/pool.go`: fixed `--pids-limit 8192`, `--cap-drop`, `--read-only`, memory/CPU from pool size. Missing: default limits for a machine with none (spec R5.27 says uncapped), the one crsp job network with no inter-container traffic, `CheckRunArgs` refusing a container without limits or with other mounts. |
| runners R5.64 | NOT built | no `SECURITY.md` section, no test. Contents live in runners R5.82 (spec table). Left unchanged (no change note). |
| operations R5.42 | built in part | CRSP88 as github-integration R5.49: `internal/trial`, `internal/api/handlers_trial.go`, `crsp trial`. Differs: modes `observe`, `shadow`, `canary`, `off` (no `live`), no console row for the mode, shadow/canary semantics differ. |
| observability R5.33 | NOT built | CRSP92 built R5.34 (history comparison) only; the by-hand run on both runner kinds does not exist. Left unchanged (no change note). |

## CRSP105
See below once done.
