# CRSP18 report (live)

Status: config, audit, settings built and tested. Backup, retention, handlers next.

## Plan
1. config: TOML file, strict schema, placeholders and secrets refused, CRSP_* overrides, per-OS dirs (R5.8-R5.10).
2. store: ops queries wrapper (settings, audit, backups, drills, retention), VACUUM INTO.
3. audit: Record(ctx, actor, action, target, details), same-tx variant, query (R5.24-R5.27 observability).
4. settings: get/update with floor and ceiling (R5.32, R6.8).
5. backup: run, list, restore, drill, prune, schedule (R5.21-R5.27 operations).
6. api/handlers_ops.go: settings, audit, backups, drill, restore. Wire in main.go.
7. docs: change notes, spec status, test paths.

## Done
- config (TOML, strict, per-OS dirs, env override), audit (Record, RecordTx, List, Prune), settings (ranges, audit in same tx), store ops. All with tests.
